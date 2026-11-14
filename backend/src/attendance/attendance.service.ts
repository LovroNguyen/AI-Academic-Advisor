import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MIN_ATTENDANCE_RATE, attendanceRate, isAttendanceAtRisk, maxAllowedAbsences } from "../common/grading";

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getMyAttendance(studentId: string, classId?: string) {
    const where: any = { studentId };
    if (classId) {
      where.lesson = { classId };
    }

    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        lesson: {
          include: { class: true },
        },
      },
      orderBy: {
        lesson: { date: "asc" },
      },
    });

    const total   = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const absent  = records.filter((r) => r.status === "absent").length;
    const late    = records.filter((r) => r.status === "late").length;
    // Shared rule (common/grading.ts): rate = present / recorded sessions; null when nothing is recorded.
    const rate = attendanceRate(present, total);

    const minRequiredRate = MIN_ATTENDANCE_RATE;
    const isAtRisk = rate !== null && isAttendanceAtRisk(rate);
    const isQualified = !isAtRisk;

    return { rate, total, present, absent, late, minRequiredRate, isQualified, maxAllowedAbsences: maxAllowedAbsences(total), isAtRisk, records };
  }

  /**
   * Admin: Bulk-mark students as present via face recognition.
   * Uses upsert so duplicate calls are safe.
   */
  async faceMarkAttendance(lessonId: string, studentIds: string[]) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException("Lesson not found");

    const marked: string[] = [];

    for (const studentId of studentIds) {
      await this.prisma.attendance.upsert({
        where:  { studentId_lessonId: { studentId, lessonId } },
        update: { status: "present" },
        create: { studentId, lessonId, status: "present" },
      });
      marked.push(studentId);
    }

    return {
      lessonId,
      markedPresent: marked.length,
      studentIds:    marked,
      message:       `Marked ${marked.length} student(s) as present via face recognition.`,
    };
  }
}
