/**
 * Frontend copy of the grading rules in backend/src/common/grading.ts.
 * Keep the two files in sync; never hard-code these values in pages.
 */

export const GRADE_WEIGHTS = { assignment: 0.2, midterm: 0.3, finalExam: 0.5 } as const;
export const PASS_TOTAL = 4.0;
export const GRADE_A_TOTAL = 8.5;
export const MIN_ATTENDANCE_RATE = 75;
export const MAX_ABSENCE_RATIO = 0.25;

/** Course total on the 0–10 scale. A final of 0 is treated as "not taken yet". */
export function courseTotal(assignmentAvg: number, midterm: number, finalExam: number): number {
  return (
    assignmentAvg * GRADE_WEIGHTS.assignment +
    midterm * GRADE_WEIGHTS.midterm +
    (finalExam > 0 ? finalExam * GRADE_WEIGHTS.finalExam : 0)
  );
}

export function totalTo4Scale(total: number): number {
  if (total >= GRADE_A_TOTAL) return 4.0;
  if (total >= 7.0) return 3.0;
  if (total >= 5.5) return 2.0;
  if (total >= PASS_TOTAL) return 1.0;
  return 0.0;
}

export function letterGrade(total: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  return (['F', 'D', 'C', 'B', 'A'] as const)[totalTo4Scale(total)];
}

/** present / recorded sessions, in percent; null when nothing is recorded. "late" is not present. */
export function attendanceRate(present: number, recorded: number): number | null {
  return recorded > 0 ? Math.round((present / recorded) * 100) : null;
}

export function isAttendanceAtRisk(rate: number | null): boolean {
  return rate !== null && rate < MIN_ATTENDANCE_RATE;
}

export function maxAllowedAbsences(totalLessons: number): number {
  return Math.floor(totalLessons * MAX_ABSENCE_RATIO);
}
