import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Request, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AttendanceStatus } from '@prisma/client';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() createLessonDto: CreateLessonDto) {
    return this.lessonsService.create(createLessonDto);
  }

  @Get()
  findByClass(@Query('classId') classId: string, @Request() req) {
    return this.lessonsService.findByClass(classId, req.user?.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id/attendance')
  markAttendance(@Param('id') id: string, @Body() dto: MarkAttendanceDto) {
    return this.lessonsService.markAttendance(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/batch-attendance')
  batchMarkAttendance(
    @Param('id') id: string,
    @Body() body: { studentIds: string[]; status?: AttendanceStatus },
  ) {
    return this.lessonsService.batchMarkAttendance(id, body.studentIds, body.status);
  }

  // ── Upload PDF/Word material for a lesson ──────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),   // keep in RAM, extract text, don't save to disk
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
    }),
  )
  uploadMaterial(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.lessonsService.uploadMaterial(id, file);
  }
}
