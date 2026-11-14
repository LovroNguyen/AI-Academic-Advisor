import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { courseTotal, cumulativeGpa, totalTo4Scale } from '../common/grading';

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  calculateRawScore(assignmentAvg: number, midterm: number, finalExam: number): number {
    return courseTotal(assignmentAvg, midterm, finalExam);
  }

  convertTo4Scale(rawScore: number): number {
    return totalTo4Scale(rawScore);
  }

  async updateGrade(dto: UpdateGradeDto) {
    const student = await this.prisma.user.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const classItem = await this.prisma.class.findUnique({ where: { id: dto.classId } });
    if (!classItem) throw new NotFoundException('Class not found');

    // Fetch existing or default to 0
    const existing = await this.prisma.grade.findUnique({
      where: {
        studentId_classId: {
          studentId: dto.studentId,
          classId: dto.classId,
        },
      },
    });

    const assignmentAvg = dto.assignmentAvg !== undefined ? dto.assignmentAvg : existing?.assignmentAvg ?? 0;
    const midterm = dto.midterm !== undefined ? dto.midterm : existing?.midterm ?? 0;
    const finalExam = dto.finalExam !== undefined ? dto.finalExam : existing?.finalExam ?? 0;

    const rawScore = this.calculateRawScore(assignmentAvg, midterm, finalExam);
    const gpaContribution = this.convertTo4Scale(rawScore);

    return this.prisma.grade.upsert({
      where: {
        studentId_classId: {
          studentId: dto.studentId,
          classId: dto.classId,
        },
      },
      update: {
        assignmentAvg,
        midterm,
        finalExam,
        gpaContribution,
      },
      create: {
        studentId: dto.studentId,
        classId: dto.classId,
        assignmentAvg,
        midterm,
        finalExam,
        gpaContribution,
      },
      include: {
        class: true,
        student: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getMyGrades(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: { class: true },
      orderBy: { class: { subjectCode: 'asc' } },
    });

    const grades = await this.prisma.grade.findMany({
      where: { studentId },
      include: { class: true },
    });

    const gradeMap = new Map<string, any>();
    for (const g of grades) {
      gradeMap.set(g.classId, g);
    }

    const enriched = enrollments.map((e) => {
      const g = gradeMap.get(e.classId);
      const assignmentAvg = g?.assignmentAvg ?? 0;
      const midterm = g?.midterm ?? 0;
      const finalExam = g?.finalExam ?? 0;
      const rawScore = this.calculateRawScore(assignmentAvg, midterm, finalExam);
      const gpaContribution = g?.gpaContribution ?? 0;
      return {
        id: g?.id || `enrolled-${e.classId}`,
        studentId,
        classId: e.classId,
        assignmentAvg,
        midterm,
        finalExam,
        gpaContribution,
        rawScore,
        isGraded: !!g,
        isEnrolled: true,
        class: e.class,
      };
    });

    // Grades for courses the student is no longer enrolled in still count toward the GPA,
    // so list them too; otherwise the GPA would not match the courses shown.
    const enrolledIds = new Set(enrollments.map((e) => e.classId));
    for (const g of grades) {
      if (enrolledIds.has(g.classId)) continue;
      enriched.push({
        id: g.id,
        studentId,
        classId: g.classId,
        assignmentAvg: g.assignmentAvg,
        midterm: g.midterm,
        finalExam: g.finalExam,
        gpaContribution: g.gpaContribution,
        rawScore: this.calculateRawScore(g.assignmentAvg, g.midterm, g.finalExam),
        isGraded: true,
        isEnrolled: false,
        class: g.class,
      });
    }

    return {
      // Shared rule (common/grading.ts): all recorded grades; null when there are none
      currentGpa: cumulativeGpa(grades),
      grades: enriched,
    };
  }

  async getAllGrades() {
    return this.prisma.grade.findMany({
      include: {
        class: true,
        student: { select: { id: true, name: true, email: true } },
      },
      orderBy: {
        student: { name: 'asc' },
      },
    });
  }
}
