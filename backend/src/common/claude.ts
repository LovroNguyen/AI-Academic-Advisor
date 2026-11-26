/**
 * One Claude (Anthropic API) request, shared by the chat advisor, quiz generation and
 * short-answer grading. Claude is the main provider; when it is not configured or a
 * request fails, the callers fall back to the free OpenRouter models and then to the
 * built-in rule-based answers / question bank.
 *
 * Configuration (backend/.env):
 *   ANTHROPIC_API_KEY  - paid API key from platform.claude.com (never commit it)
 *   CLAUDE_MODEL       - optional, defaults to claude-haiku-5-5 (cheapest current model)
 */

import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';

const logger = new Logger('Claude');

export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-5-5';

export interface ClaudeRequest {
  system?: string;
  user: string;
  /** Upper bound for thinking + answer tokens. */
  maxTokens: number;
  timeoutMs: number;
}

export interface ClaudeResult {
  ok: boolean;
  /** Final answer text ('' if none). */
  content: string;
  /** HTTP status for API errors, 0 for network/timeout errors, 200 on success. */
  status: number;
  stopReason?: string | null;
  error?: string;
}

/** The configured key, ignoring empty values and the .env.example placeholder. */
export function getClaudeKey(): string {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  return key && !key.includes('your_anthropic_key') ? key : '';
}

export function hasClaudeKey(): boolean {
  return getClaudeKey() !== '';
}

export function claudeModel(): string {
  return (process.env.CLAUDE_MODEL || '').trim() || DEFAULT_CLAUDE_MODEL;
}

/** Joins the text blocks of a response (thinking blocks are skipped). */
export function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

let client: Anthropic | null = null;
let clientKey = '';
function getClient(): Anthropic {
  const key = getClaudeKey();
  if (!client || clientKey !== key) {
    // One quick retry for 429/5xx/connection errors; the callers have their own fallbacks.
    client = new Anthropic({ apiKey: key, maxRetries: 1 });
    clientKey = key;
  }
  return client;
}

export async function claudeChat(req: ClaudeRequest): Promise<ClaudeResult> {
  if (!hasClaudeKey()) {
    return { ok: false, content: '', status: 0, error: 'ANTHROPIC_API_KEY is not set' };
  }
  try {
    const response = await getClient().messages.create(
      {
        model: claudeModel(),
        max_tokens: req.maxTokens,
        // Short, data-driven answers: low effort keeps thinking (and latency) small.
        output_config: { effort: 'low' },
        ...(req.system ? { system: req.system } : {}),
        messages: [{ role: 'user', content: req.user }],
      },
      { timeout: req.timeoutMs },
    );

    if (response.stop_reason === 'refusal') {
      return { ok: false, content: '', status: 200, stopReason: 'refusal', error: 'request declined' };
    }
    const content = extractText(response.content);
    if (response.stop_reason === 'max_tokens' && !content) {
      return { ok: false, content: '', status: 200, stopReason: 'max_tokens', error: 'ran out of tokens' };
    }
    return { ok: true, content, status: 200, stopReason: response.stop_reason };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      logger.warn('Claude rejected the API key (401). Check ANTHROPIC_API_KEY in backend/.env.');
      return { ok: false, content: '', status: 401, error: 'invalid API key' };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, content: '', status: 429, error: 'rate limited' };
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return { ok: false, content: '', status: 0, error: 'timed out' };
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, content: '', status: err.status ?? 0, error: err.message.slice(0, 200) };
    }
    return { ok: false, content: '', status: 0, error: (err as Error)?.message ?? String(err) };
  }
}
