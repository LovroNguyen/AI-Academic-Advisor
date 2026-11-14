import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { TestsService } from '../../src/tests/tests.service';
import { retrieveLessonSnippets } from '../../src/ai/lesson-retrieval';

const svc = new TestsService(null as any) as any;
const mcq = (i: number, extra: Record<string, unknown> = {}) => ({
  type: 'mcq', question: `Q${i}`, options: ['a', 'b', 'c', 'd'], answer: 'b', explanation: 'e', ...extra,
});

test('quiz validation keeps well-formed questions and renumbers them', () => {
  const out = svc.validateQuestions([
    mcq(1), mcq(2), mcq(3), mcq(4), mcq(5),
    { type: 'short', question: 'S', answer: 'model answer' },
    mcq(6, { options: ['a', 'b'] }), // wrong option count
    mcq(7, { answer: 'E' }), // invalid letter
    null,
  ]);
  assert.equal(out.length, 6);
  assert.deepEqual(out.map((q: any) => q.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(out[0].options[1], 'B. b');
  assert.equal(out[0].answer, 'B');
});

test('quiz validation rejects too few valid questions and non-arrays', () => {
  assert.equal(svc.validateQuestions([mcq(1), mcq(2)]), null);
  assert.equal(svc.validateQuestions('not a list'), null);
});

test('submit: MCQ scoring, empty short answer gets 0 without calling the LLM', async () => {
  // no network in unit tests: remove every configured key
  const saved = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('OPENROUTER_API_KEY')));
  for (const k of Object.keys(saved)) delete process.env[k];
  try {
    const questions = [
      { id: 1, type: 'mcq', question: 'q1', options: [], answer: 'A' },
      { id: 2, type: 'mcq', question: 'q2', options: [], answer: 'B' },
      { id: 3, type: 'short', question: 'q3', answer: 'model' },
      { id: 4, type: 'short', question: 'q4', answer: 'model' },
    ];
    const res = await svc.submitQuiz(
      { testId: 't', studentId: '', answers: [{ questionId: 1, answer: 'A' }, { questionId: 2, answer: 'C' }, { questionId: 4, answer: 'something' }] },
      questions,
    );
    // MCQ 1/2; q3 empty -> 0/1 (graded locally); q4 cannot be graded without an LLM -> excluded
    assert.equal(res.score, 3.3); // 1 point / 3 counted questions * 10
    assert.match(res.scoreDisplay, /1\/2 MCQ correct/);
    assert.match(res.scoreDisplay, /1 short answer\(s\) not auto-graded/);
    assert.equal(res.graded[3].points, null);
  } finally {
    Object.assign(process.env, saved);
  }
});

test('lesson retrieval finds the matching chunk and ignores unrelated lessons', () => {
  const lessons = [
    { topic: 'Attention Mechanisms', content: 'Self-attention lets each token weigh every other token. Transformers stack attention layers.', class: { subjectCode: 'DL401' } },
    { topic: 'Sorting', content: 'Quicksort partitions the array around a pivot element.', class: { subjectCode: 'DSA202' } },
    { topic: 'Empty', content: null, class: { subjectCode: 'X' } },
  ];
  const hits = retrieveLessonSnippets('explain self-attention in transformers', lessons);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].subjectCode, 'DL401');
  assert.deepEqual(retrieveLessonSnippets('hello', lessons), []);
});
