import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { GradesService } from './grades.service';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Put()
  updateGrade(@Body() updateGradeDto: UpdateGradeDto) {
    return this.gradesService.updateGrade(updateGradeDto);
  }

  @Get('me')
  getMyGrades(@Request() req) {
    return this.gradesService.getMyGrades(req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('all')
  getAllGrades() {
    return this.gradesService.getAllGrades();
  }
}
