import { test, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  availableOpenRouterKeys,
  getOpenRouterKeys,
  openRouterChat,
  resetOpenRouterKeyState,
} from '../../src/common/openrouter';

// Fake keys and a fake fetch: no network, no real quota used.
const KEYS = { OPENROUTER_API_KEY: 'sk-test-aaaa1111', OPENROUTER_API_KEY_2: 'sk-test-bbbb2222', OPENROUTER_API_KEY_3: 'sk-test-cccc3333' };
const realFetch = globalThis.fetch;
let savedEnv: Record<string, string | undefined> = {};
let calls: string[] = [];

const dailyLimit = () =>
  new Response(JSON.stringify({ error: { message: 'Rate limit exceeded: free-models-per-day.' } }), { status: 429 });
const ok = (text: string) =>
  new Response(JSON.stringify({ model: 'm', choices: [{ message: { content: text }, finish_reason: 'stop' }] }), { status: 200 });

/** behaviour: key -> response factory */
function mockFetch(behaviour: Record<string, () => Response>) {
  globalThis.fetch = (async (_url: any, init: any) => {
    const key = String(init.headers.Authorization).replace('Bearer ', '');
    calls.push(key);
    return behaviour[key]();
  }) as any;
}

const REQ = { model: 'openrouter/free', messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 50, temperature: 0, timeoutMs: 5000, title: 't' };

beforeEach(() => {
  savedEnv = Object.fromEntries(Object.keys(process.env).filter((k) => k.startsWith('OPENROUTER_API_KEY')).map((k) => [k, process.env[k]]));
  for (const k of Object.keys(savedEnv)) delete process.env[k];
  Object.assign(process.env, KEYS);
  resetOpenRouterKeyState();
  calls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of Object.keys(KEYS)) delete process.env[k];
  Object.assign(process.env, savedEnv);
  resetOpenRouterKeyState();
});

test('reads all keys in priority order', () => {
  assert.deepEqual(getOpenRouterKeys(), [KEYS.OPENROUTER_API_KEY, KEYS.OPENROUTER_API_KEY_2, KEYS.OPENROUTER_API_KEY_3]);
});

test('switches to the next key when the first hits the daily limit, and remembers it', async () => {
  mockFetch({ [KEYS.OPENROUTER_API_KEY]: dailyLimit, [KEYS.OPENROUTER_API_KEY_2]: () => ok('hello'), [KEYS.OPENROUTER_API_KEY_3]: () => ok('x') });
  const r = await openRouterChat(REQ);
  assert.equal(r.ok, true);
  assert.equal(r.content, 'hello');
  assert.deepEqual(calls, [KEYS.OPENROUTER_API_KEY, KEYS.OPENROUTER_API_KEY_2]);

  // Next request starts directly with key 2 (key 1 is blocked until 00:00 UTC)
  calls = [];
  await openRouterChat(REQ);
  assert.deepEqual(calls, [KEYS.OPENROUTER_API_KEY_2]);
  assert.deepEqual(availableOpenRouterKeys(), [KEYS.OPENROUTER_API_KEY_2, KEYS.OPENROUTER_API_KEY_3]);
  // ...and key 1 comes back after the reset
  assert.equal(availableOpenRouterKeys(Date.now() + 25 * 3600 * 1000).length, 3);
});

test('when every key is used up, returns the daily-limit error and stops calling the API', async () => {
  mockFetch({ [KEYS.OPENROUTER_API_KEY]: dailyLimit, [KEYS.OPENROUTER_API_KEY_2]: dailyLimit, [KEYS.OPENROUTER_API_KEY_3]: dailyLimit });
  const r = await openRouterChat(REQ);
  assert.equal(r.status, 429);
  assert.equal(calls.length, 3);

  calls = [];
  const again = await openRouterChat(REQ);
  assert.equal(again.status, 429);
  assert.equal(calls.length, 0);
});

test('other errors (e.g. upstream 429 for one model) do not switch keys', async () => {
  mockFetch({
    [KEYS.OPENROUTER_API_KEY]: () => new Response(JSON.stringify({ error: { message: 'temporarily rate-limited upstream' } }), { status: 429 }),
    [KEYS.OPENROUTER_API_KEY_2]: () => ok('x'),
    [KEYS.OPENROUTER_API_KEY_3]: () => ok('x'),
  });
  const r = await openRouterChat(REQ);
  assert.equal(r.status, 429);
  assert.deepEqual(calls, [KEYS.OPENROUTER_API_KEY]);
  assert.equal(availableOpenRouterKeys().length, 3);
});

test('an invalid key (401) is skipped', async () => {
  mockFetch({
    [KEYS.OPENROUTER_API_KEY]: () => new Response(JSON.stringify({ error: { message: 'User not found' } }), { status: 401 }),
    [KEYS.OPENROUTER_API_KEY_2]: () => ok('fine'),
    [KEYS.OPENROUTER_API_KEY_3]: () => ok('x'),
  });
  const r = await openRouterChat(REQ);
  assert.equal(r.content, 'fine');
  assert.deepEqual(availableOpenRouterKeys(), [KEYS.OPENROUTER_API_KEY_2, KEYS.OPENROUTER_API_KEY_3]);
});
