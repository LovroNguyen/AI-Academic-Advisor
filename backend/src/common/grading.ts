/**
 * Single source of truth for AcadAI grading and attendance rules.
 * All services (grades, EWS risk engine, AI advisor) must use these values
 * instead of hard-coding thresholds.
 *
 * The pass mark follows the grade scale used to compute GPA (convertTo4Scale):
 * a course total below 4.0 is an F. If the university's official rule differs,
 * change it here only.
 */

export const GRADE_WEIGHTS = { assignment: 0.2, midterm: 0.3, finalExam: 0.5 } as const;

/** Minimum course total (0–10) to pass, i.e. grade D or better. */
export const PASS_TOTAL = 4.0;
/** Minimum course total (0–10) for grade A. */
export const GRADE_A_TOTAL = 8.5;

/** Minimum attendance rate (%) to be allowed to sit the final exam. */
export const MIN_ATTENDANCE_RATE = 75;
/** Maximum share of lessons a student may miss. */
export const MAX_ABSENCE_RATIO = 0.25;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Course total on the 0–10 scale. */
export function courseTotal(assignmentAvg: number, midterm: number, finalExam: number): number {
  return Math.round(
    (assignmentAvg * GRADE_WEIGHTS.assignment + midterm * GRADE_WEIGHTS.midterm + finalExam * GRADE_WEIGHTS.finalExam) * 100,
  ) / 100;
}

/** Points already earned before the final exam (0–5). */
export function pointsBeforeFinal(assignmentAvg: number, midterm: number): number {
  return assignmentAvg * GRADE_WEIGHTS.assignment + midterm * GRADE_WEIGHTS.midterm;
}

/** Final-exam score needed to reach `targetTotal`. May exceed 10 (target not reachable). */
export function finalNeededFor(targetTotal: number, assignmentAvg: number, midterm: number): number {
  return Math.max(0, round1((targetTotal - pointsBeforeFinal(assignmentAvg, midterm)) / GRADE_WEIGHTS.finalExam));
}

export function finalNeededToPass(assignmentAvg: number, midterm: number): number {
  return finalNeededFor(PASS_TOTAL, assignmentAvg, midterm);
}

/** Human-readable form of a needed final score. */
export function formatNeeded(score: number): string {
  return score > 10 ? 'not reachable (>10)' : score.toFixed(1);
}

/** Converts a 0–10 course total to the 4.0 GPA scale. */
export function totalTo4Scale(total: number): number {
  if (total >= GRADE_A_TOTAL) return 4.0;
  if (total >= 7.0) return 3.0;
  if (total >= 5.5) return 2.0;
  if (total >= PASS_TOTAL) return 1.0;
  return 0.0;
}

/**
 * Cumulative GPA (4.0 scale) = credit-weighted average of gpaContribution over ALL recorded
 * grades, including courses the student is no longer enrolled in (a failed course cannot
 * disappear by unenrolling). Rounded to 2 decimals; null when no grades are recorded.
 */
export function cumulativeGpa(grades: { gpaContribution: number; class?: { creditHours?: number | null } | null }[]): number | null {
  let points = 0;
  let credits = 0;
  for (const g of grades) {
    const c = g.class?.creditHours || 3;
    points += g.gpaContribution * c;
    credits += c;
  }
  return credits > 0 ? Math.round((points / credits) * 100) / 100 : null;
}

/**
 * Attendance rate in percent = sessions marked "present" / sessions with a recorded status.
 * Future lessons and lessons without a record do not count. "late" counts as not present.
 * Returns null when nothing has been recorded.
 */
export function attendanceRate(present: number, recorded: number): number | null {
  return recorded > 0 ? Math.round((present / recorded) * 100) : null;
}

export function maxAllowedAbsences(totalLessons: number): number {
  return Math.floor(totalLessons * MAX_ABSENCE_RATIO);
}

export function isAttendanceAtRisk(ratePercent: number): boolean {
  return ratePercent < MIN_ATTENDANCE_RATE;
}
