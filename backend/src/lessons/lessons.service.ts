import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLessonDto) {
    const classExists = await this.prisma.class.findUnique({ where: { id: dto.classId } });
    if (!classExists) throw new NotFoundException('Class not found');

    return this.prisma.lesson.create({
      data: {
        classId: dto.classId,
        topic: dto.topic,
        date: new Date(dto.date),
        room: dto.room,
      },
      include: { class: true },
    });
  }

  async findByClass(classId?: string, userId?: string) {
    const where = classId ? { classId } : {};
    const lessons = await this.prisma.lesson.findMany({
      where,
      include: {
        class: true,
        attendance: userId
          ? { where: { studentId: userId } }
          : { include: { student: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: { date: 'asc' },
    });

    return lessons.map((lesson) => ({
      ...lesson,
      myAttendance: userId && lesson.attendance?.length > 0 ? lesson.attendance[0] : null,
      hasContent: !!(lesson as any).content,
    }));
  }

  async markAttendance(lessonId: string, dto: MarkAttendanceDto) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const student = await this.prisma.user.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    return this.prisma.attendance.upsert({
      where: { studentId_lessonId: { studentId: dto.studentId, lessonId } },
      update: { status: dto.status },
      create: { studentId: dto.studentId, lessonId, status: dto.status },
      include: {
        student: { select: { id: true, name: true, email: true } },
        lesson: true,
      },
    });
  }

  /**
   * Bulk attendance marking for panoramic face scanning or classroom attendance.
   * Performs idempotent upserts for all recognized students.
   */
  async batchMarkAttendance(
    lessonId: string,
    studentIds: string[],
    status: AttendanceStatus = AttendanceStatus.present,
  ) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const markedStudents: string[] = [];
    for (const studentId of studentIds) {
      const student = await this.prisma.user.findUnique({ where: { id: studentId } });
      if (!student) continue;

      await this.prisma.attendance.upsert({
        where: { studentId_lessonId: { studentId, lessonId } },
        update: { status },
        create: { studentId, lessonId, status },
      });
      markedStudents.push(studentId);
    }

    return {
      lessonId,
      status,
      markedCount: markedStudents.length,
      studentIds: markedStudents,
      message: `Successfully registered attendance for ${markedStudents.length} student(s) as ${status}.`,
    };
  }

  // ─── File upload & text extraction ─────────────────────────────────────────

  async uploadMaterial(lessonId: string, file: Express.Multer.File): Promise<{ success: boolean; message: string; charCount: number }> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const ext = path.extname(file.originalname).toLowerCase();
    let extractedText = '';

    try {
      if (ext === '.pdf') {
        extractedText = await this.extractPdf(file.buffer);
      } else if (ext === '.docx' || ext === '.doc') {
        extractedText = await this.extractDocx(file.buffer);
      } else if (ext === '.txt') {
        extractedText = file.buffer.toString('utf-8');
      } else {
        return { success: false, message: `Unsupported file type: ${ext}. Use PDF, DOCX, or TXT.`, charCount: 0 };
      }
    } catch (err: any) {
      return { success: false, message: `Extraction failed: ${err.message}`, charCount: 0 };
    }

    // Trim to 8000 chars to stay within AI context limits
    const trimmed = extractedText.slice(0, 8000).trim();

    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { content: trimmed } as any,
    });

    return {
      success: true,
      message: `Material uploaded for "${lesson.topic}" (${trimmed.length} chars extracted)`,
      charCount: trimmed.length,
    };
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // pdf-parse v2 exports a PDFParse class (v1's default function no longer exists).
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      await parser.destroy();
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
}
