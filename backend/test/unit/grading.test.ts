import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  PASS_TOTAL,
  attendanceRate,
  courseTotal,
  cumulativeGpa,
  finalNeededFor,
  finalNeededToPass,
  formatNeeded,
  isAttendanceAtRisk,
  maxAllowedAbsences,
  totalTo4Scale,
} from '../../src/common/grading';

test('course total uses 20/30/50 weights', () => {
  assert.equal(courseTotal(10, 10, 10), 10);
  assert.equal(courseTotal(8, 4, 0), 2.8);
  assert.equal(courseTotal(9, 8, 7), 7.7);
});

test('final score needed to pass', () => {
  assert.equal(PASS_TOTAL, 4.0);
  assert.equal(finalNeededToPass(8, 4), 2.4); // (4.0 - 2.8) / 0.5
  assert.equal(finalNeededToPass(10, 10), 0); // already passed before the final
});

test('unreachable targets are reported as such', () => {
  assert.equal(finalNeededFor(8.5, 8, 4), 11.4);
  assert.match(formatNeeded(11.4), /not reachable/);
  assert.equal(formatNeeded(6), '6.0');
});

test('4.0 scale boundaries', () => {
  assert.equal(totalTo4Scale(3.99), 0);
  assert.equal(totalTo4Scale(4.0), 1);
  assert.equal(totalTo4Scale(5.5), 2);
  assert.equal(totalTo4Scale(7.0), 3);
  assert.equal(totalTo4Scale(8.5), 4);
});

test('attendance rate is present / recorded, null when nothing recorded', () => {
  assert.equal(attendanceRate(3, 4), 75);
  assert.equal(attendanceRate(0, 0), null);
  assert.equal(isAttendanceAtRisk(74), true);
  assert.equal(isAttendanceAtRisk(75), false);
  assert.equal(maxAllowedAbsences(10), 2);
});

test('cumulative GPA is credit-weighted over all recorded grades, null when none', () => {
  // demo student: 4 courses at 3,3,3,2 plus a failed course at 0, all 3 credits
  const grades = [3, 3, 3, 2, 0].map((g) => ({ gpaContribution: g, class: { creditHours: 3 } }));
  assert.equal(cumulativeGpa(grades), 2.2);
  assert.equal(cumulativeGpa([{ gpaContribution: 4, class: { creditHours: 4 } }, { gpaContribution: 2, class: { creditHours: 2 } }]), 3.33);
  assert.equal(cumulativeGpa([]), null);
});
