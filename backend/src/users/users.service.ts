import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MIN_ATTENDANCE_RATE,
  cumulativeGpa,
  attendanceRate as attendanceRateOf,
  finalNeededFor,
  isAttendanceAtRisk,
  finalNeededToPass as finalNeededToPassFor,
  formatNeeded,
  maxAllowedAbsences as maxAllowedAbsencesFor,
} from '../common/grading';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        learningGoal: true,
        enrollments: {
          include: {
            class: true,
          },
          orderBy: {
            enrolledAt: 'desc',
          },
        },
        grades: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!user) return null;

    // Shared rule (common/grading.ts)
    const currentGpa = cumulativeGpa(user.grades);

    // Calculate overall attendance rate
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: { studentId: userId },
      include: { lesson: { select: { classId: true } } },
    });
    const presentAtt = attendanceRecords.filter((r) => r.status === 'present').length;
    const attendanceRate = attendanceRateOf(presentAtt, attendanceRecords.length);

    // Per-class rates use the same rule: present / recorded sessions of that class.
    const enrolledClasses = user.enrollments.map((e) => {
      const classRecords = attendanceRecords.filter((r) => r.lesson.classId === e.classId);
      const classPresent = classRecords.filter((r) => r.status === 'present').length;
      const grade = user.grades.find((g) => g.classId === e.classId);

      return {
        ...e.class,
        enrolledAt: e.enrolledAt,
        attendanceRate: attendanceRateOf(classPresent, classRecords.length),
        studentGrade: grade || null,
      };
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      learningGoal: user.learningGoal,
      currentGpa,
      attendanceRate,
      enrolledClassesCount: user.enrollments.length,
      totalCredits: user.enrollments.reduce((acc, e) => acc + (e.class?.creditHours || 3), 0),
      enrolledClasses,
    };
  }

  async updateProfile(userId: string, dto: { name?: string; targetCareer?: string; targetGpa?: number; goalType?: string }) {
    if (dto.name && dto.name.trim()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { name: dto.name.trim() },
      });
    }

    if (dto.targetCareer !== undefined || dto.targetGpa !== undefined || dto.goalType !== undefined) {
      await this.prisma.learningGoal.upsert({
        where: { studentId: userId },
        update: {
          targetCareer: dto.targetCareer,
          targetGpa: dto.targetGpa !== undefined && dto.targetGpa !== null ? Number(dto.targetGpa) : undefined,
          goalType: dto.goalType,
        },
        create: {
          studentId: userId,
          targetCareer: dto.targetCareer || 'AI / ML Engineer',
          targetGpa: dto.targetGpa !== undefined && dto.targetGpa !== null ? Number(dto.targetGpa) : 3.5,
          goalType: dto.goalType || 'career',
        },
      });
    }

    return this.getProfile(userId);
  }

  async getAllStudents() {
    return this.prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async getDashboard(userId: string) {
    const [grades, enrollments, goal, conversations, attendanceRecords, academicRisk] = await Promise.all([
      this.prisma.grade.findMany({ where: { studentId: userId }, include: { class: true } }),
      this.prisma.enrollment.findMany({ where: { studentId: userId }, include: { class: true } }),
      this.prisma.learningGoal.findUnique({ where: { studentId: userId } }),
      this.prisma.conversation.count({ where: { studentId: userId } }),
      this.prisma.attendance.findMany({ where: { studentId: userId }, include: { lesson: true } }),
      this.computeStudentRisk(userId),
    ]);

    let totalCredits = 0;
    for (const g of grades) totalCredits += g.class?.creditHours || 3;

    // null = nothing recorded yet (the UI shows "—" instead of a made-up number)
    const gpa = cumulativeGpa(grades);

    const totalAtt = attendanceRecords.length;
    const presentAtt = attendanceRecords.filter((r) => r.status === 'present').length;
    const attendanceRate = attendanceRateOf(presentAtt, totalAtt);

    // This week's real lessons (Mon–Sun) for the dashboard timetable.
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekLessons = await this.prisma.lesson.findMany({
      where: {
        classId: { in: enrollments.map((e) => e.classId) },
        date: { gte: weekStart, lt: weekEnd },
      },
      include: { class: { include: { creator: { select: { name: true } } } } },
      orderBy: { date: 'asc' },
    });
    const statusByLesson = new Map(attendanceRecords.map((r) => [r.lessonId, r.status]));
    const weekSchedule = weekLessons.map((l) => ({
      lessonId: l.id,
      date: l.date,
      subjectCode: l.class.subjectCode,
      className: l.class.name,
      topic: l.topic,
      room: l.room,
      lecturer: l.class.creator?.name ?? null,
      attendance: statusByLesson.get(l.id) ?? null, // present | absent | late | null (not recorded)
    }));

    return {
      gpa,
      totalCredits,
      grades,
      enrollments,
      goal,
      conversationsCount: conversations,
      attendanceRate,
      totalAtt,
      presentAtt,
      weekSchedule,
      academicRisk,
    };
  }

  // ─── Early Warning System (EWS) Analytics Engine ───────────────────────────

  async computeStudentRisk(userId: string) {
    const [user, grades, enrollments, goal, attendanceRecords, quizAttempts] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
      this.prisma.grade.findMany({ where: { studentId: userId }, include: { class: true } }),
      this.prisma.enrollment.findMany({
        where: { studentId: userId },
        include: {
          class: {
            include: {
              lessons: { select: { id: true, date: true, topic: true } },
              tests: true,
            },
          },
        },
      }),
      this.prisma.learningGoal.findUnique({ where: { studentId: userId } }),
      this.prisma.attendance.findMany({ where: { studentId: userId }, include: { lesson: true } }),
      this.prisma.quizAttempt.findMany({ where: { studentId: userId } }),
    ]);

    if (!user) return null;

    // No invented defaults: without a goal there is no target to compute against.
    const targetGpa = goal?.targetGpa ?? null;
    const targetRawScore = targetGpa !== null ? Math.min(10, (targetGpa / 4.0) * 10) : null;

    const courseRisks = enrollments.map((e) => {
      const cls = e.class;
      const totalLessons = cls.lessons.length > 0 ? cls.lessons.length : 10;
      const classAtt = attendanceRecords.filter((a) => a.lesson.classId === cls.id);
      const presentCount = classAtt.filter((a) => a.status === 'present').length;
      const absentCount = classAtt.filter((a) => a.status === 'absent').length;
      const attRate = attendanceRateOf(presentCount, classAtt.length);

      // Max allowed absences: 25% of total scheduled curriculum
      const maxAllowedAbsences = Math.max(1, maxAllowedAbsencesFor(totalLessons));
      const remainingAbsences = Math.max(0, maxAllowedAbsences - absentCount);
      const isBarred = absentCount > maxAllowedAbsences;
      const attWarning = absentCount === maxAllowedAbsences;

      // Only real grade records are used; a course without grades has no grade-based risk.
      const grade = grades.find((g) => g.classId === cls.id);
      const hasGrades = !!grade;
      const assign = grade?.assignmentAvg ?? null;
      const midterm = grade?.midterm ?? null;
      const finalExam = grade?.finalExam ?? null;

      // Rules live in common/grading.ts (total = 20% assignment + 30% midterm + 50% final).
      const finalNeededToPass = hasGrades ? finalNeededToPassFor(assign, midterm) : null;
      const finalNeededForTarget =
        hasGrades && targetRawScore !== null ? finalNeededFor(targetRawScore, assign, midterm) : null;

      // Quiz assessment performance for this class
      const clsAttempts = quizAttempts.filter(
        (qa) => qa.testId && cls.tests.some((t) => t.id === qa.testId),
      );
      const quizAvg =
        clsAttempts.length > 0
          ? clsAttempts.reduce((acc, curr) => acc + curr.score, 0) / clsAttempts.length
          : null;

      // Calculate composite Risk Score (0 - 100)
      let riskScore = 0;
      const reasons: string[] = [];

      // Attendance impact (up to 45 pts)
      if (isBarred) {
        riskScore += 50;
        reasons.push(`Barred from final exam: ${absentCount}/${totalLessons} absences (>25% limit).`);
      } else if (attWarning) {
        riskScore += 35;
        reasons.push(`Critical attendance warning: ${absentCount} absences recorded. 0 remaining allowed.`);
      } else if (attRate !== null && isAttendanceAtRisk(attRate)) {
        riskScore += 35;
        reasons.push(`Attendance rate ${attRate}% is below the ${MIN_ATTENDANCE_RATE}% minimum.`);
      } else if (absentCount > 0) {
        riskScore += 15;
        reasons.push(`${remainingAbsences} absence(s) remaining before exam cutoff.`);
      }

      // Midterm / Grade impact (up to 40 pts)
      if (hasGrades && midterm < 5.0) {
        riskScore += 35;
        reasons.push(`Deficient midterm exam (${midterm}/10). Needs ${formatNeeded(finalNeededToPass)} on the final to pass.`);
      } else if (hasGrades && midterm < 7.0) {
        riskScore += 15;
        reasons.push(
          finalNeededForTarget !== null
            ? `Moderate midterm score (${midterm}/10). Needs ${formatNeeded(finalNeededForTarget)} on final for GPA goal.`
            : `Moderate midterm score (${midterm}/10).`,
        );
      }

      // Quiz drill impact (up to 15 pts)
      if (quizAvg !== null && quizAvg < 6.0) {
        riskScore += 15;
        reasons.push(`Recent practice drill performance below standard (${quizAvg.toFixed(1)}/10).`);
      }

      const riskLevel = riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MODERATE' : 'LOW';

      return {
        classId: cls.id,
        subjectCode: cls.subjectCode,
        className: cls.name,
        creditHours: cls.creditHours,
        totalLessons,
        presentCount,
        absentCount,
        attendanceRate: attRate,
        maxAllowedAbsences,
        remainingAbsences,
        isBarred,
        attWarning,
        hasGrades,
        assign,
        midterm,
        finalExam,
        finalNeededToPass,
        finalNeededForTarget,
        quizAvg: quizAvg !== null ? parseFloat(quizAvg.toFixed(1)) : null,
        quizAttemptsCount: clsAttempts.length,
        riskScore: Math.min(100, riskScore),
        riskLevel,
        reasons,
      };
    });

    const atRiskCourses = courseRisks.filter((c) => c.riskLevel !== 'LOW');
    const maxRisk = courseRisks.length > 0 ? Math.max(...courseRisks.map((c) => c.riskScore)) : 0;
    const overallRiskStatus = maxRisk >= 50 ? 'CRITICAL' : maxRisk >= 25 ? 'MONITORING' : 'GOOD_STANDING';

    return {
      studentId: user.id,
      studentName: user.name,
      studentEmail: user.email,
      targetGpa,
      overallRiskStatus,
      maxRiskScore: maxRisk,
      atRiskCount: atRiskCourses.length,
      totalEnrolledCount: courseRisks.length,
      courses: courseRisks,
      actionPlan: atRiskCourses.flatMap((c) => c.reasons),
    };
  }

  async getAtRiskStudents() {
    const students = await this.prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true },
    });

    const evaluations = await Promise.all(
      students.map((s) => this.computeStudentRisk(s.id)),
    );

    // Sort students by highest risk score first
    return evaluations
      .filter((e) => e !== null)
      .sort((a, b) => (b?.maxRiskScore ?? 0) - (a?.maxRiskScore ?? 0));
  }
}
