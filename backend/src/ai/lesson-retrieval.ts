/**
 * Minimal retrieval over uploaded lesson material (Lesson.content) for the AI advisor.
 * Keyword overlap only (no embeddings): the material is split into ~600-character chunks,
 * and each chunk is scored by how many distinct query words it contains, plus a bonus when the
 * lesson topic matches. Good enough for "explain X from my lesson" questions on a small corpus.
 */

export interface LessonSnippet {
  subjectCode: string;
  topic: string;
  text: string;
  score: number;
}

const STOPWORDS = new Set([
  'what', 'which', 'where', 'when', 'about', 'explain', 'does', 'mean', 'with', 'from', 'that', 'this', 'there',
  'have', 'your', 'lesson', 'lessons', 'class', 'course', 'please', 'tell', 'show', 'give', 'learn', 'learned',
  'the', 'and', 'for', 'how', 'why', 'are', 'can', 'you', 'my', 'is', 'in', 'of', 'to', 'a', 'an',
  'là', 'gì', 'của', 'trong', 'và', 'cho', 'tôi', 'bài', 'học', 'môn', 'giải', 'thích', 'nào', 'như', 'thế',
]);

function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  );
}

function chunk(text: string, size = 600): string[] {
  const paragraphs = text.split(/\n\s*\n|(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if (current && current.length + p.length > size) {
      chunks.push(current.trim());
      current = '';
    }
    current += p + ' ';
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function retrieveLessonSnippets(
  query: string,
  lessons: { topic: string; content?: string | null; class: { subjectCode: string } }[],
  maxSnippets = 2,
  minScore = 2,
): LessonSnippet[] {
  const words = keywords(query);
  if (words.length === 0) return [];

  const candidates: LessonSnippet[] = [];
  for (const lesson of lessons) {
    if (!lesson.content) continue;
    const topicWords = new Set(keywords(lesson.topic));
    const topicBonus = words.some((w) => topicWords.has(w)) ? 2 : 0;
    for (const text of chunk(lesson.content)) {
      const lower = text.toLowerCase();
      const hits = words.filter((w) => lower.includes(w)).length;
      const score = hits + (hits > 0 ? topicBonus : 0);
      if (score >= minScore) {
        candidates.push({ subjectCode: lesson.class.subjectCode, topic: lesson.topic, text, score });
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, maxSnippets);
}
