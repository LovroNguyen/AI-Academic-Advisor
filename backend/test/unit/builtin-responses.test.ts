import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { AiService } from '../../src/ai/ai.service';
import { getJwtSecret } from '../../src/auth/jwt-secret';

// The built-in (no-LLM) answers must only contain real data and never leak
// "undefined", "NaN", "null" or invented values.
const svc = new AiService(null as any);
const day = (n: number) => new Date(Date.now() + n * 864e5);
const cls = (id: string, code: string) => ({ id, subjectCode: code, name: `${code} Course`, semester: 'Fall', creator: { name: 'Dr. X' } });
const A = cls('a', 'DSA202');
const B = cls('b', 'SE301');

const full: any = {
  currentGpa: '2.80', targetGpa: '3.50', targetCareer: 'AI / ML Engineer',
  enrolledClasses: [{ classId: 'a', class: A }, { classId: 'b', class: B }],
  enrolledLessons: [
    { classId: 'a', class: A, topic: 'Trees', date: day(-3), room: 'B201' },
    { classId: 'a', class: A, topic: 'Graphs', date: day(1), room: '204' },
    { classId: 'b', class: B, topic: 'CI/CD', date: day(9), room: null },
  ],
  grades: [{ class: A, assignmentAvg: 8, midterm: 4, finalExam: 0 }, { class: B, assignmentAvg: 9, midterm: 8, finalExam: 7 }],
  attendanceRecords: [
    { status: 'absent', lesson: { date: day(-3), room: 'B201', classId: 'a', class: A } },
    { status: 'present', lesson: { date: day(-10), room: 'B201', classId: 'a', class: A } },
  ],
  overallAttRate: 50, presentCount: 1, absentCount: 1, lateCount: 0, isOverallAtRisk: true,
  enrolledTests: [{ classId: 'a', class: A, title: 'Final Exam', scheduledAt: day(5), room: '204', daysRemaining: 5, isUrgent: true }],
  classRoomsMap: { a: ['B201', '204'] },
  classAttendanceMap: { a: { total: 2, present: 1, absent: 1, late: 0, rate: 50 }, b: { total: 0, present: 0, absent: 0, late: 0, rate: null } },
  roadmapChunks: [{ section: '1. Math Foundations', content: 'Linear algebra and statistics.', chunkIndex: 0 }],
  lessonSnippets: [],
};
const empty: any = {
  currentGpa: null, targetGpa: null, targetCareer: null, enrolledClasses: [], enrolledLessons: [], grades: [],
  attendanceRecords: [], overallAttRate: null, presentCount: 0, absentCount: 0, lateCount: 0, isOverallAtRisk: false,
  enrolledTests: [], classRoomsMap: {}, classAttendanceMap: {}, roadmapChunks: [], lessonSnippets: [],
};

const QUERIES: [any, string][] = [
  ['LOCATOR', 'when does the semester end'], ['LOCATOR', 'classes in november'], ['LOCATOR', 'how many class this week'],
  ['LOCATOR', 'next class'], ['LOCATOR', 'where is room 204'], ['LOCATOR', 'where is dsa202'], ['LOCATOR', 'where are my classes'],
  ['ATTENDANCE', 'lowest attendance'], ['ATTENDANCE', 'am i disqualified'], ['ATTENDANCE', 'my attendance'],
  ['GPA', 'score needed dsa202'], ['GPA', 'my gpa'], ['EXAM', 'next exam'], ['CAREER', 'roadmap'], ['GENERAL', 'hello'],
];

for (const [label, ctx] of [['full data', full], ['empty data', empty]] as const) {
  test(`built-in answers are clean with ${label}`, () => {
    for (const [intent, msg] of QUERIES) {
      const out = svc.generateBuiltinResponse(intent, {}, msg, ctx);
      assert.ok(out.length > 20, `${intent} "${msg}" is empty`);
      assert.doesNotMatch(out, /undefined|NaN|\bnull\b|\[object/, `${intent} "${msg}" leaked a bad value:\n${out}`);
    }
  });
}

test('built-in answers use real values and say when data is missing', () => {
  assert.match(svc.generateBuiltinResponse('GPA', {}, 'score needed dsa202', full), /at least \*\*2\.4\*\*/);
  assert.match(svc.generateBuiltinResponse('ATTENDANCE', {}, 'am i disqualified', full), /exceeded the absence limit/);
  assert.match(svc.generateBuiltinResponse('GPA', {}, 'my gpa', empty), /No grades have been recorded/);
  assert.doesNotMatch(svc.generateBuiltinResponse('GENERAL', {}, 'hello', empty), /3\.12|2\.20/);
});

test('JWT secret: refuses missing or weak secrets', () => {
  const saved = process.env.JWT_SECRET;
  try {
    process.env.JWT_SECRET = 'secret';
    assert.throws(() => getJwtSecret());
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret());
    process.env.JWT_SECRET = 'a-sufficiently-long-test-secret';
    assert.equal(getJwtSecret(), 'a-sufficiently-long-test-secret');
  } finally {
    if (saved === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved;
  }
});
