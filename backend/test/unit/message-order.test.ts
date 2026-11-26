import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CHRONOLOGICAL, NEWEST_FIRST, pairTimestamps } from '../../src/common/message-order';

test('answer is stamped strictly after its question', () => {
  const now = new Date('2026-11-16T14:22:44.898Z');
  const { questionAt, answerAt } = pairTimestamps(now);
  assert.equal(questionAt.toISOString(), '2026-11-16T14:22:44.898Z');
  assert.equal(answerAt.toISOString(), '2026-11-16T14:22:44.899Z');
  assert.ok(answerAt > questionAt);
});

test('pairTimestamps uses the current time by default', () => {
  const before = Date.now();
  const { questionAt, answerAt } = pairTimestamps();
  assert.ok(questionAt.getTime() >= before);
  assert.equal(answerAt.getTime() - questionAt.getTime(), 1);
});

test('orderings break timestamp ties by sender (enum order: user before ai)', () => {
  assert.deepEqual(CHRONOLOGICAL, [{ sentAt: 'asc' }, { sender: 'asc' }]);
  assert.deepEqual(NEWEST_FIRST, [{ sentAt: 'desc' }, { sender: 'desc' }]);
});

test('newest-first history of 6, reversed, reads question then answer even with tied timestamps', () => {
  // Simulates rows saved before the fix (identical timestamps per pair), sorted like PostgreSQL would.
  const enumRank = { user: 0, ai: 1 } as const;
  const rows = [
    { t: 3, sender: 'ai' as const }, { t: 3, sender: 'user' as const },
    { t: 2, sender: 'user' as const }, { t: 2, sender: 'ai' as const },
    { t: 1, sender: 'ai' as const }, { t: 1, sender: 'user' as const },
  ];
  const newestFirst = [...rows].sort((a, b) => b.t - a.t || enumRank[b.sender] - enumRank[a.sender]);
  const history = newestFirst.slice(0, 6).reverse().map((r) => `${r.t}${r.sender}`);
  assert.deepEqual(history, ['1user', '1ai', '2user', '2ai', '3user', '3ai']);
});
