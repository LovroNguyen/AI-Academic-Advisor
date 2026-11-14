import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { attendanceRate as attendanceRateFor } from '../common/grading';
import { CreateClassDto } from './dto/create-class.dto';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClassDto, userId: string) {
    return this.prisma.class.create({
      data: {
        name: dto.name,
        subjectCode: dto.subjectCode,
        creditHours: dto.creditHours,
        semester: dto.semester,
        createdBy: userId,
      },
    });
  }

  async findAll(userId?: string, enrolledOnly?: boolean) {
    const where: any = {};
    if (userId && enrolledOnly) {
      where.enrollments = {
        some: { studentId: userId },
      };
    }

    const classes = await this.prisma.class.findMany({
      where,
      include: {
        _count: {
          select: {
            enrollments: true,
            lessons: true,
            tests: true,
          },
        },
        enrollments: userId
          ? {
              where: { studentId: userId },
            }
          : false,
        grades: userId
          ? {
              where: { studentId: userId },
            }
          : false,
      },
      orderBy: { subjectCode: 'asc' },
    });

    if (!userId) {
      return classes;
    }

    // Enrich with attendance rate for the student
    const result = await Promise.all(
      classes.map(async (c) => {
        const isEnrolled = c.enrollments && c.enrollments.length > 0;
        let attendanceRate: number | null = null;
        let gradeScore: number | null = null;

        if (isEnrolled) {
          // Shared rule (common/grading.ts): present / recorded sessions; null if none recorded.
          const [recorded, presentCount] = await Promise.all([
            this.prisma.attendance.count({ where: { studentId: userId, lesson: { classId: c.id } } }),
            this.prisma.attendance.count({ where: { studentId: userId, lesson: { classId: c.id }, status: 'present' } }),
          ]);
          attendanceRate = attendanceRateFor(presentCount, recorded);

          if (c.grades && c.grades.length > 0) {
            gradeScore = c.grades[0].gpaContribution;
          }
        }

        return {
          ...c,
          isEnrolled,
          attendanceRate,
          studentGrade: c.grades?.[0] || null,
        };
      }),
    );

    return result;
  }

  async findOne(id: string) {
    const classItem = await this.prisma.class.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { date: 'asc' } },
        tests: { orderBy: { scheduledAt: 'asc' } },
        enrollments: { include: { student: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!classItem) throw new NotFoundException('Class not found');
    return classItem;
  }

  async enroll(classId: string, studentId: string) {
    const classItem = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!classItem) throw new NotFoundException('Class not found');

    const existing = await this.prisma.enrollment.findUnique({
      where: {
        studentId_classId: { studentId, classId },
      },
    });
    if (existing) {
      throw new ConflictException('Student is already enrolled in this class');
    }

    return this.prisma.enrollment.create({
      data: {
        studentId,
        classId,
      },
      include: {
        class: true,
      },
    });
  }

  async adminEnroll(classId: string, studentId: string) {
    return this.enroll(classId, studentId);
  }

  async unenroll(classId: string, studentId: string) {
    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_classId: { studentId, classId } },
    });
    if (!existing) throw new NotFoundException('Enrollment not found');
    return this.prisma.enrollment.delete({
      where: { studentId_classId: { studentId, classId } },
    });
  }

  async getEnrolledStudents(classId: string) {
    return this.prisma.enrollment.findMany({
      where: { classId },
      include: { student: { select: { id: true, name: true, email: true } } },
      orderBy: { enrolledAt: 'asc' },
    });
  }
}
