import { Prisma } from '@prisma/client';

/**
 * Chat message ordering.
 *
 * A question and its answer are saved in one transaction. With the database default
 * (CURRENT_TIMESTAMP is the transaction start time) both got the same sentAt, so their
 * order after a reload was arbitrary: the answer could appear above its question, and the
 * history sent to the language model could be out of order.
 *
 * Fix: the answer is stamped 1 ms after the question, and every query sorts ties by sender.
 * The MessageSender enum is declared ('user', 'ai'), so in PostgreSQL user sorts before ai.
 * The tie-breaker also orders older rows that already share a timestamp.
 */

/** Oldest first; on equal timestamps the question comes before the answer. */
export const CHRONOLOGICAL: Prisma.MessageOrderByWithRelationInput[] = [{ sentAt: 'asc' }, { sender: 'asc' }];

/** Newest first; on equal timestamps the answer comes before the question. */
export const NEWEST_FIRST: Prisma.MessageOrderByWithRelationInput[] = [{ sentAt: 'desc' }, { sender: 'desc' }];

/** Timestamps for a question/answer pair: the answer is always 1 ms later. */
export function pairTimestamps(now: Date = new Date()): { questionAt: Date; answerAt: Date } {
  return { questionAt: now, answerAt: new Date(now.getTime() + 1) };
}
