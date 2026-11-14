/**
 * One OpenRouter chat-completion request, shared by the chat advisor, quiz generation
 * and short-answer grading.
 *
 * Free OpenRouter models are mostly "reasoning" models. With reasoning on they can spend
 * the whole token budget thinking and return an empty answer (finish_reason "length"), so
 * we first ask with reasoning disabled. Some models refuse that ("Reasoning is mandatory"),
 * so for those we retry once with reasoning on and a larger token budget.
 *
 * Several API keys (e.g. from several free accounts) can be configured:
 *   OPENROUTER_API_KEY, OPENROUTER_API_KEY_2 … OPENROUTER_API_KEY_9
 * Keys are used in that order. When a key hits the free daily limit
 * ("free-models-per-day", HTTP 429) it is skipped until the limit resets (00:00 UTC),
 * and the same request is retried with the next key. Invalid or unpaid keys
 * (HTTP 401/402) are skipped for an hour.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('OpenRouter');

export interface OpenRouterRequest {
  model: string;
  /** Optional OpenRouter-side fallback list (same as the `models` API field). */
  models?: string[];
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  title: string;
}

export interface OpenRouterResult {
  ok: boolean;
  status: number;
  /** Parsed response body (or error body). */
  body: any;
  /** Final answer text ('' if none). */
  content: string;
  /** Model that actually answered (OpenRouter may route to another one). */
  servedBy?: string;
  finishReason?: string;
}

const REASONING_RETRY_MIN_TOKENS = 4000;

// ── Key pool ──────────────────────────────────────────────────────────────────

/** key -> time (ms) until which the key is skipped */
const blockedUntil = new Map<string, number>();

/** All configured keys, in priority order, without placeholders or duplicates. */
export function getOpenRouterKeys(): string[] {
  const names = ['OPENROUTER_API_KEY', ...Array.from({ length: 8 }, (_, i) => `OPENROUTER_API_KEY_${i + 2}`)];
  const keys = names
    .map((n) => (process.env[n] || '').trim())
    .filter((k) => k && !k.includes('your_openrouter_key'));
  return Array.from(new Set(keys));
}

export function hasOpenRouterKey(): boolean {
  return getOpenRouterKeys().length > 0;
}

/** Keys that are currently usable (not blocked). */
export function availableOpenRouterKeys(now = Date.now()): string[] {
  return getOpenRouterKeys().filter((k) => (blockedUntil.get(k) ?? 0) <= now);
}

/** Short, non-secret label for logs. */
export function keyLabel(key: string): string {
  const index = getOpenRouterKeys().indexOf(key);
  return `key #${index + 1} (…${key.slice(-4)})`;
}

function nextUtcMidnight(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** Exposed for tests. */
export function resetOpenRouterKeyState(): void {
  blockedUntil.clear();
}

export function isDailyLimitError(status: number, body: unknown): boolean {
  return status === 429 && /free-models-per-day/i.test(JSON.stringify(body ?? ''));
}

/**
 * Sends the request with the first usable key and switches to the next key when the
 * current one has hit its daily limit or is invalid. If every key is used up, the last
 * error is returned (daily-limit errors keep their 429 so callers can fall back).
 */
export async function openRouterChat(req: OpenRouterRequest): Promise<OpenRouterResult> {
  const keys = availableOpenRouterKeys();
  if (keys.length === 0) {
    return {
      ok: false,
      status: 429,
      body: { error: { message: 'All OpenRouter keys have reached their free-models-per-day limit or are disabled.' } },
      content: '',
    };
  }

  let last: OpenRouterResult | null = null;
  for (const key of keys) {
    last = await sendWithKey(req, key);
    if (isDailyLimitError(last.status, last.body)) {
      blockedUntil.set(key, nextUtcMidnight());
      logger.warn(`${keyLabel(key)} reached the free daily limit; switching to the next key until 00:00 UTC.`);
      continue;
    }
    if (last.status === 401 || last.status === 402) {
      blockedUntil.set(key, Date.now() + 60 * 60 * 1000);
      logger.warn(`${keyLabel(key)} was rejected (HTTP ${last.status}); skipping it for 1 hour.`);
      continue;
    }
    return last;
  }
  return last!;
}

async function sendWithKey(req: OpenRouterRequest, apiKey: string): Promise<OpenRouterResult> {
  const send = async (reasoningOff: boolean, maxTokens: number): Promise<OpenRouterResult> => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(req.timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': req.title,
      },
      body: JSON.stringify({
        model: req.model,
        ...(req.models ? { models: req.models, provider: { allow_fallbacks: true } } : {}),
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: maxTokens,
        ...(reasoningOff ? { reasoning: { enabled: false } } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    const choice = body?.choices?.[0];
    return {
      ok: res.ok,
      status: res.status,
      body,
      content: (choice?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim(),
      servedBy: body?.model,
      finishReason: choice?.finish_reason,
    };
  };

  const first = await send(true, req.maxTokens);
  const reasoningMandatory =
    !first.ok && first.status === 400 && /reasoning is mandatory/i.test(JSON.stringify(first.body));
  if (!reasoningMandatory) return first;
  return send(false, Math.max(req.maxTokens, REASONING_RETRY_MIN_TOKENS));
}
