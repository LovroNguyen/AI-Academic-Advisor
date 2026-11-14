import { Controller, Get, Post, Body, Query, Request, UseGuards, HttpCode } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('me')
  getMyAttendance(@Request() req, @Query('classId') classId?: string) {
    return this.attendanceService.getMyAttendance(req.user.id, classId);
  }

  // Admin: mark attendance from face recognition result
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('face-mark')
  @HttpCode(200)
  faceMark(@Body() body: { lessonId: string; studentIds: string[] }) {
    return this.attendanceService.faceMarkAttendance(body.lessonId, body.studentIds);
  }
}
