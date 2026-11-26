/**
 * LIVE evaluation of the AI features against the real AI provider (Claude, then OpenRouter as
 * backup) and the seeded demo data. Uses real API credit (about 15-30 requests per run). Run:  npm run test:ai-live [output.json]
 *
 * Asks 12 questions (EN + VI, every intent) as the seeded student nva@fpt.edu.vn and checks:
 * answered by the LLM or by the built-in fallback, intent, required facts, and invented course codes.
 * Then generates a quiz and checks that short-answer grading separates a correct from a wrong answer.
 * The expected facts below match prisma/seed.ts; update them if the seed data changes.
 * Chat messages created by the run are deleted at the end; quiz submissions are not saved.
 */
import '../../src/env';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { AiService } from '../../src/ai/ai.service';
import { TestsService } from '../../src/tests/tests.service';
import { hasClaudeKey } from '../../src/common/claude';

// Capture service warnings: they tell us whether an answer came from the LLM or the fallback,
// and which API key was switched.
const warnings: string[] = [];
Logger.overrideLogger({ log() {}, error: (m: any) => warnings.push('ERROR ' + m), warn: (m: any) => warnings.push('WARN ' + m), debug() {}, verbose() {} });

const ENROLLED = new Set(['DSA202', 'SE301', 'DL401', 'WEB201']);
interface Case { q: string; intent: string; must: RegExp[] }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** "Nov 27", "27 Nov", "November 27" or "11/27" for a date. */
function dateRe(d: Date): RegExp {
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  return new RegExp(`${mon}[a-z]*\\.? ${day}\\b|\\b${day} ${mon}|\\b${d.getMonth() + 1}/${day}\\b`, 'i');
}

/**
 * Builds the test cases. Facts that depend on today's date (next exam, next class) are read
 * from the database at run time; the other facts match prisma/seed.ts.
 */
function buildCases(nextExam: { code: string; name: string; room: string; at: Date }, nextClass: { code: string; name: string; room: string; topic: string }): Case[] {
  const exam = [new RegExp(`${nextExam.code}|${esc(nextExam.name)}`), new RegExp(esc(nextExam.room).replace(/\d/, '\\s?$&'), 'i')];
  return [
    { q: 'What is my current GPA?', intent: 'GPA', must: [/2\.20?/] },
    { q: 'How far am I from my target GPA?', intent: 'GPA', must: [/3\.80?/, /1\.60?/] },
    { q: 'Am I at risk in any course?', intent: 'ATTENDANCE', must: [/DSA202/, /60\s?%/] },
    { q: 'What is my attendance in SE301?', intent: 'ATTENDANCE', must: [/70\s?%/] },
    { q: 'When is my next exam?', intent: 'EXAM', must: [...exam, dateRe(nextExam.at)] },
    { q: 'What is my next class?', intent: 'LOCATOR', must: [new RegExp(`${nextClass.code}|${esc(nextClass.name)}`), new RegExp(esc(nextClass.room).replace(/(\D)(\d)/, '$1\\s?$2'), 'i'), new RegExp(esc(nextClass.topic.split(' ')[0]), 'i')] },
    { q: 'Where is room 204?', intent: 'LOCATOR', must: [/elevator/i] },
    { q: 'Show my career roadmap', intent: 'CAREER', must: [/AI Engineer/i] },
    { q: 'Điểm GPA của tôi là bao nhiêu?', intent: 'GPA', must: [/2\.20?/] },
    { q: 'Lịch thi sắp tới của tôi', intent: 'EXAM', must: exam },
    { q: 'What score do I need on the DSA202 final?', intent: 'GPA', must: [/DSA202/, /7\.6|complet|already|recorded|6\.6/i] },
    { q: 'Explain what a binary search tree is', intent: 'GENERAL', must: [/left/i, /right/i] },
  ];
}

(async () => {
  const prisma = new PrismaClient();
  const ai = new AiService(prisma as any);
  const quiz = new TestsService(prisma as any);
  const student = await prisma.user.findUnique({ where: { email: 'nva@fpt.edu.vn' } });
  const classIds = (await prisma.enrollment.findMany({ where: { studentId: student!.id } })).map((e) => e.classId);
  const now = new Date();
  const exam = await prisma.test.findFirst({ where: { classId: { in: classIds }, scheduledAt: { gte: now } }, include: { class: true }, orderBy: { scheduledAt: 'asc' } });
  // the next class is the first lesson that has not started yet (a class earlier today is already over)
  const lesson = await prisma.lesson.findFirst({ where: { classId: { in: classIds }, date: { gt: now } }, include: { class: true }, orderBy: { date: 'asc' } });
  const CASES = buildCases(
    { code: exam!.class.subjectCode, name: exam!.class.name, room: exam!.room || '', at: exam!.scheduledAt },
    { code: lesson!.class.subjectCode, name: lesson!.class.name, room: lesson!.room || '', topic: lesson!.topic },
  );
  console.log(`Expected today: next exam ${exam!.class.subjectCode} ${exam!.scheduledAt.toDateString()} in ${exam!.room}; next class ${lesson!.class.subjectCode} "${lesson!.topic}" in ${lesson!.room} on ${lesson!.date.toDateString()}`);
  const startedAt = new Date();
  const results: any[] = [];

  for (const c of CASES) {
    warnings.length = 0;
    const t = Date.now();
    const r = await ai.chat({ conversationId: 'conv-default', message: c.q } as any, student!.id);
    const secs = (Date.now() - t) / 1000;
    const source = warnings.some((w) => /using the built-in answer/.test(w)) ? 'fallback' : 'AI';
    // Claude is tried first; a 'Claude (...)' warning means OpenRouter (or the fallback) answered instead.
    const provider = source === 'fallback' ? 'built-in' : hasClaudeKey() && !warnings.some((w) => /Claude \(/.test(w)) ? 'Claude' : 'OpenRouter';
    const missing = c.must.filter((re) => !re.test(r.response)).map(String);
    if (/at risk/i.test(c.q) && /overall[^%\d]*?(\d+)\s?%/i.exec(r.response)?.[1] === '60') missing.push('WRONG: overall rate given as 60% (it is 75%)');
    const codes = Array.from(new Set(r.response.match(/\b[A-Z]{2,4}\d{3}\b/g) || []));
    const invented = codes.filter((x) => !ENROLLED.has(x));
    const keySwitches = warnings.filter((w) => /reached the free daily limit|was rejected/.test(w));
    results.push({ q: c.q, provider, intentOk: r.intent === c.intent, intent: r.intent, source, secs, factsOk: missing.length === 0, missing, invented, keySwitches: keySwitches.length });
    console.log(`\n[${source}/${provider}] ${secs.toFixed(1)}s intent=${r.intent}${r.intent !== c.intent ? ' (expected ' + c.intent + ')' : ''} facts=${missing.length ? 'MISSING ' + missing.join(' ') : 'ok'}${invented.length ? ' INVENTED CODES ' + invented.join(',') : ''}  — ${c.q}`);
    if (keySwitches.length) console.log('  key switch:', keySwitches.join(' | '));
    if (source === 'fallback') console.log('  why:', warnings.filter((w) => /OpenRouter|Claude/.test(w)).map((w) => w.slice(0, 140)).join(' | '));
    console.log('  ' + r.response.slice(0, 300).replace(/\n/g, '\n  '));
  }

  // Quiz generation + grading discrimination (correct vs. wrong short answers)
  const test = await prisma.test.findFirst({ where: { scheduledAt: { gte: new Date() }, class: { lessons: { some: {} } } }, include: { class: true }, orderBy: { scheduledAt: 'asc' } });
  warnings.length = 0;
  let t = Date.now();
  const g = await quiz.generateQuiz(test!.id);
  const genSecs = (Date.now() - t) / 1000;
  console.log(`\nQUIZ generate ${test!.class.subjectCode}: ${genSecs.toFixed(1)}s source=${g.source} (${g.basedOn}), ${g.questions.length} questions`);
  if (warnings.length) console.log('  warnings:', warnings.map((w) => w.slice(0, 140)).join(' | '));
  g.questions.slice(0, 3).forEach((q) => console.log(`  - [${q.type}] ${q.question}`));

  const shorts = g.questions.filter((q) => q.type === 'short');
  const answers = g.questions.map((q) => {
    if (q.type === 'mcq') return { questionId: q.id, answer: q.answer };
    // first short answer: give the model answer (should score high); others: an unrelated wrong answer
    return { questionId: q.id, answer: q.id === shorts[0]?.id ? q.answer : 'Photosynthesis converts sunlight into chemical energy in plants.' };
  });
  warnings.length = 0;
  t = Date.now();
  const s = await quiz.submitQuiz({ testId: test!.id, studentId: '', answers }, g.questions); // studentId '' => nothing saved
  const gradeSecs = (Date.now() - t) / 1000;
  console.log(`QUIZ submit: ${gradeSecs.toFixed(1)}s -> ${s.scoreDisplay}`);
  s.graded.filter((q: any) => q.type === 'short').forEach((q: any, i: number) =>
    console.log(`  short ${i === 0 ? '(model answer given)' : '(wrong answer given)'}: points=${q.points} "${q.feedback ?? ''}"`));
  if (warnings.length) console.log('  warnings:', warnings.map((w) => w.slice(0, 140)).join(' | '));

  // Summary
  const ai_ = results.filter((r) => r.source === 'AI');
  const secsSorted = results.map((r) => r.secs).sort((a, b) => a - b);
  const summary = {
    chatQuestions: results.length,
    answeredByAI: ai_.length,
    answeredByClaude: results.filter((r) => r.provider === 'Claude').length,
    intentCorrect: results.filter((r) => r.intentOk).length,
    factsCorrectAll: results.filter((r) => r.factsOk).length,
    factsCorrectAIOnly: `${ai_.filter((r) => r.factsOk).length}/${ai_.length}`,
    answersWithInventedCourseCodes: results.filter((r) => r.invented.length).length,
    medianSecs: secsSorted[Math.floor(secsSorted.length / 2)],
    maxSecs: secsSorted[secsSorted.length - 1],
    keySwitches: results.reduce((a, r) => a + r.keySwitches, 0),
    quiz: { source: g.source, genSecs, gradeSecs, score: s.scoreDisplay, shortPoints: s.graded.filter((q: any) => q.type === 'short').map((q: any) => q.points) },
  };
  console.log('\nSUMMARY ' + JSON.stringify(summary, null, 1));
  fs.writeFileSync(process.argv[2] || 'ai-eval-result.json', JSON.stringify({ when: new Date().toISOString(), summary, results }, null, 2));
  // Remove the chat messages this run created
  await prisma.message.deleteMany({ where: { sentAt: { gte: startedAt }, conversation: { studentId: student!.id } } });
  await prisma.$disconnect();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
