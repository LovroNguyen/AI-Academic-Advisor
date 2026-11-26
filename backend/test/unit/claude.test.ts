import { test, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { claudeChat, claudeModel, DEFAULT_CLAUDE_MODEL, extractText, hasClaudeKey } from '../../src/common/claude';

// No network: these tests only cover configuration handling and response parsing.
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, CLAUDE_MODEL: process.env.CLAUDE_MODEL };
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test('no key, an empty key, or the .env.example placeholder means Claude is off', () => {
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(hasClaudeKey(), false);
  process.env.ANTHROPIC_API_KEY = '   ';
  assert.equal(hasClaudeKey(), false);
  process.env.ANTHROPIC_API_KEY = 'your_anthropic_key_here';
  assert.equal(hasClaudeKey(), false);
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-0000';
  assert.equal(hasClaudeKey(), true);
});

test('the model defaults to Claude Haiku 5.5 and can be overridden', () => {
  delete process.env.CLAUDE_MODEL;
  assert.equal(claudeModel(), DEFAULT_CLAUDE_MODEL);
  assert.equal(DEFAULT_CLAUDE_MODEL, 'claude-haiku-5-5');
  process.env.CLAUDE_MODEL = 'claude-sonnet-5-5';
  assert.equal(claudeModel(), 'claude-sonnet-5-5');
});

test('extractText keeps only text blocks and skips thinking blocks', () => {
  const content = [
    { type: 'thinking', thinking: 'internal', signature: 's' },
    { type: 'text', text: 'Your GPA is ', citations: null },
    { type: 'text', text: '2.20.', citations: null },
  ] as any;
  assert.equal(extractText(content), 'Your GPA is 2.20.');
});

test('claudeChat without a key fails fast, so callers fall back to OpenRouter', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const r = await claudeChat({ user: 'hi', maxTokens: 50, timeoutMs: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.content, '');
});
