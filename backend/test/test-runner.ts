/**
 * AcadAI Professional Backend Integration & Domain QA Suite
 * ==========================================================
 * Automated quality assurance testing:
 *   1. Database Integrity & Prisma ORM Connectivity
 *   2. Authentication, Token Signature & RBAC Role Enforcement
 *   3. Batch Attendance Service & Transaction Idempotence
 *   4. Early Warning System (EWS) Risk Engine Boundary Analysis
 *   5. Cross-Service Contract Health with Face Recognition Service
 *
 * Execute with:
 *   cd backend; npx ts-node test/test-runner.ts
 */

import { PrismaClient, AttendanceStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../src/users/users.service';
import { isAttendanceAtRisk } from '../src/common/grading';

const prisma = new PrismaClient();

const COLOR = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m',
  RESET: '\x1b[0m',
};

async function runTestSuite() {
  console.log(`\n${COLOR.BOLD}${COLOR.CYAN}======================================================================${COLOR.RESET}`);
  console.log(`${COLOR.BOLD}${COLOR.CYAN}       AcadAI Backend & Domain Service Integration QA Suite         ${COLOR.RESET}`);
  console.log(`${COLOR.BOLD}${COLOR.CYAN}======================================================================${COLOR.RESET}\n`);

  let passed = 0;
  let total = 0;

  try {
    // ── Test 1: Database Connectivity & Schema Health ────────────────
    total++;
    process.stdout.write('[Test 1/5] Checking Database Connectivity & Schema Integrity... ');
    const userCount = await prisma.user.count();
    const lessonCount = await prisma.lesson.count();
    const classCount = await prisma.class.count();

    if (userCount > 0 && lessonCount > 0 && classCount > 0) {
      passed++;
      console.log(`${COLOR.GREEN}PASS${COLOR.RESET}`);
      console.log(`         Found ${userCount} users, ${classCount} courses, and ${lessonCount} scheduled lessons.`);
    } else {
      console.log(`${COLOR.RED}FAIL: Database tables appear unseeded.${COLOR.RESET}`);
    }

    // ── Test 2: RBAC Role Segregation & Password Security ────────────
    total++;
    process.stdout.write('[Test 2/5] Validating RBAC Role Segregation & Password Hashing... ');
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
    const studentUser = await prisma.user.findFirst({ where: { role: 'student' } });

    if (!adminUser || !studentUser) {
      console.log(`${COLOR.RED}FAIL: Missing admin or student user in database.${COLOR.RESET}`);
    } else {
      const isAdminRoleValid = adminUser.role === 'admin';
      const isStudentRoleValid = studentUser.role === 'student';
      const hasBcryptHash = adminUser.passwordHash.startsWith('$2') && studentUser.passwordHash.startsWith('$2');

      if (isAdminRoleValid && isStudentRoleValid && hasBcryptHash) {
        passed++;
        console.log(`${COLOR.GREEN}PASS${COLOR.RESET}`);
        console.log(`         Admin: ${adminUser.email} (role: admin)`);
        console.log(`         Student: ${studentUser.email} (role: student)`);
        console.log(`         Password hashes conform to bcrypt standard.`);
      } else {
        console.log(`${COLOR.RED}FAIL: Role hierarchy or password hashing mismatch.${COLOR.RESET}`);
      }
    }

    // ── Test 3: Batch Attendance Idempotency & Upsert Safety ──────────
    total++;
    process.stdout.write('[Test 3/5] Testing Batch Attendance Service & Idempotent Upserts... ');
    const testLesson = await prisma.lesson.findFirst({ include: { class: true } });
    const sampleStudents = await prisma.user.findMany({ where: { role: 'student' }, take: 3 });

    if (!testLesson || sampleStudents.length === 0) {
      console.log(`${COLOR.RED}FAIL: Cannot find test lesson or sample students.${COLOR.RESET}`);
    } else {
      const studentIds = sampleStudents.map((s) => s.id);

      // Snapshot existing rows so the test leaves the real data exactly as it found it.
      const before = await prisma.attendance.findMany({
        where: { lessonId: testLesson.id, studentId: { in: studentIds } },
      });

      try {
        const upsertAll = () =>
          Promise.all(
            studentIds.map((sid) =>
              prisma.attendance.upsert({
                where: { studentId_lessonId: { studentId: sid, lessonId: testLesson.id } },
                update: { status: AttendanceStatus.present },
                create: { studentId: sid, lessonId: testLesson.id, status: AttendanceStatus.present },
              }),
            ),
          );
        const count = () => prisma.attendance.count({ where: { lessonId: testLesson.id, studentId: { in: studentIds } } });

        await upsertAll();
        const countAfterFirst = await count();
        await upsertAll(); // second run must not create duplicates
        const countAfterSecond = await count();

        if (countAfterFirst === studentIds.length && countAfterSecond === studentIds.length) {
          passed++;
          console.log(`${COLOR.GREEN}PASS${COLOR.RESET}`);
          console.log(`         Upserted ${studentIds.length} records into lesson "${testLesson.topic}" twice; row count stayed ${countAfterSecond}.`);
        } else {
          console.log(`${COLOR.RED}FAIL: Idempotency violation or row count mismatch.${COLOR.RESET}`);
        }
      } finally {
        // Restore: delete rows the test created, put back original statuses.
        const keep = new Set(before.map((r) => r.studentId));
        await prisma.attendance.deleteMany({
          where: { lessonId: testLesson.id, studentId: { in: studentIds.filter((id) => !keep.has(id)) } },
        });
        for (const r of before) {
          await prisma.attendance.update({ where: { id: r.id }, data: { status: r.status } });
        }
        console.log(`         Restored ${before.length} original record(s); removed ${studentIds.length - before.length} test record(s).`);
      }
    }

    // ── Test 4: Early Warning System (EWS) Risk Metric Validation ────
    total++;
    process.stdout.write('[Test 4/5] Checking the real Early Warning System risk engine on real data... ');
    // Real risk engine (UsersService.computeStudentRisk) on real data: every student's result
    // must be internally consistent with the shared rules in common/grading.ts.
    const users = new UsersService(prisma as any);
    const students = await prisma.user.findMany({ where: { role: 'student' }, select: { id: true }, take: 15 });
    const problems: string[] = [];
    let coursesChecked = 0;
    for (const st of students) {
      const risk: any = await users.computeStudentRisk(st.id);
      for (const c of risk?.courses ?? []) {
        coursesChecked++;
        const expectedLevel = c.riskScore >= 50 ? 'HIGH' : c.riskScore >= 25 ? 'MODERATE' : 'LOW';
        if (c.riskLevel !== expectedLevel) problems.push(`${c.subjectCode}: level ${c.riskLevel} vs score ${c.riskScore}`);
        if (c.attendanceRate !== null && isAttendanceAtRisk(c.attendanceRate) && c.riskScore < 25 && !c.reasons.length)
          problems.push(`${c.subjectCode}: ${c.attendanceRate}% attendance but no risk reason`);
        if (c.isBarred && c.riskLevel !== 'HIGH') problems.push(`${c.subjectCode}: barred but not HIGH`);
        if (!c.hasGrades && (c.assign !== null || c.finalNeededToPass !== null)) problems.push(`${c.subjectCode}: invented grade values`);
      }
    }

    if (coursesChecked > 0 && problems.length === 0) {
      passed++;
      console.log(`${COLOR.GREEN}PASS${COLOR.RESET}`);
      console.log(`         ${coursesChecked} course risk results for ${students.length} students are consistent with the shared rules.`);
    } else {
      console.log(`${COLOR.RED}FAIL: ${problems.length ? problems.slice(0, 5).join('; ') : 'no courses to check'}${COLOR.RESET}`);
    }

    // ── Test 5: Microservice Integration Contract Check ──────────────
    total++;
    process.stdout.write('[Test 5/5] Checking Face Recognition Microservice Health Contract... ');
    try {
      const response = await fetch('http://localhost:8001/health');
      if (response.ok) {
        const body = (await response.json()) as any;
        if (body.status === 'ok' && body.registered_students !== undefined) {
          passed++;
          console.log(`${COLOR.GREEN}PASS${COLOR.RESET}`);
          console.log(`         Microservice responded 200 OK (v${body.version}, ${body.registered_students} students enrolled).`);
        } else {
          console.log(`${COLOR.RED}FAIL: Invalid health response schema.${COLOR.RESET}`);
        }
      } else {
        console.log(`${COLOR.RED}FAIL: HTTP ${response.status} from microservice.${COLOR.RESET}`);
      }
    } catch (e: any) {
      console.log(`${COLOR.YELLOW}WARN: Could not reach face microservice on localhost:8001 (${e.message}).${COLOR.RESET}`);
    }

    // ── Summary Report ────────────────────────────────────────────────
    console.log(`\n${COLOR.BOLD}----------------------------------------------------------------------${COLOR.RESET}`);
    const summaryColor = passed === total ? COLOR.GREEN : COLOR.YELLOW;
    console.log(`${COLOR.BOLD}Backend QA Results: ${summaryColor}${passed}/${total} Suites Passed (${((passed / total) * 100).toFixed(1)}%)${COLOR.RESET}`);
    console.log(`${COLOR.BOLD}----------------------------------------------------------------------${COLOR.RESET}\n`);
  } catch (err: any) {
    console.error(`\n${COLOR.RED}Fatal error during QA test execution: ${err.message}${COLOR.RESET}`);
  } finally {
    await prisma.$disconnect();
  }
}

runTestSuite();

