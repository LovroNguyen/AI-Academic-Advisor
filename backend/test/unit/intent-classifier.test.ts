import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyIntent } from '../../src/ai/intent-classifier';

// Labelled English + Vietnamese queries. The original regex classifier got 22/30 of these;
// note that this set was written while tuning the new rules, so it is a regression test,
// not an unbiased accuracy benchmark.
const CASES: [string, string][] = [
  ['which room is my exam in', 'EXAM'],
  ['where is my midterm', 'EXAM'],
  ['when is my next exam', 'EXAM'],
  ['lịch thi của tôi', 'EXAM'],
  ['phòng thi môn DSA202 ở đâu', 'EXAM'],
  ['điểm danh môn SE301', 'ATTENDANCE'],
  ['am i disqualified', 'ATTENDANCE'],
  ['am I eligible for the final exam', 'ATTENDANCE'],
  ['tôi vắng bao nhiêu buổi', 'ATTENDANCE'],
  ['how many absences do I have', 'ATTENDANCE'],
  ['tôi có bị cấm thi không', 'ATTENDANCE'],
  ['Am I at risk in any course?', 'ATTENDANCE'],
  ['tôi có nguy cơ gì không', 'ATTENDANCE'],
  ['what is my gpa', 'GPA'],
  ['điểm của tôi', 'GPA'],
  ['what score do I need on the final to pass', 'GPA'],
  ['bảng điểm', 'GPA'],
  ['What score do I need on the DSA202 final?', 'GPA'],
  ['cần bao nhiêu điểm để qua môn', 'GPA'],
  ['where is room 204', 'LOCATOR'],
  ['where is the elevator', 'LOCATOR'],
  ['nhà vệ sinh ở đâu', 'LOCATOR'],
  ['next class', 'LOCATOR'],
  ['how many class this week', 'LOCATOR'],
  ['lịch học tuần này', 'LOCATOR'],
  ['where is DSA202 held', 'LOCATOR'],
  ['when does the semester end', 'LOCATOR'],
  ['AI engineer career roadmap', 'CAREER'],
  ['lộ trình frontend', 'CAREER'],
  ['what skills do I need for backend', 'CAREER'],
  ['hello', 'GENERAL'],
  ['xin chào', 'GENERAL'],
  ['thanks', 'GENERAL'],
];

for (const [message, expected] of CASES) {
  test(`"${message}" -> ${expected}`, () => {
    assert.equal(classifyIntent(message), expected);
  });
}
