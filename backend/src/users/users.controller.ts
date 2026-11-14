import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  getMe(@Request() req) {
    return this.users.getProfile(req.user.id);
  }

  @Get('profile')
  getProfile(@Request() req) {
    return this.users.getProfile(req.user.id);
  }

  @Patch('profile')
  updateProfile(
    @Request() req,
    @Body() body: { name?: string; targetCareer?: string; targetGpa?: number; goalType?: string },
  ) {
    return this.users.updateProfile(req.user.id, body);
  }

  @Get('dashboard')
  getDashboard(@Request() req) {
    return this.users.getDashboard(req.user.id);
  }

  @Get('academic-risk')
  getAcademicRisk(@Request() req) {
    return this.users.computeStudentRisk(req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('at-risk-students')
  getAtRiskStudents() {
    return this.users.getAtRiskStudents();
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('students')
  getAllStudents() {
    return this.users.getAllStudents();
  }
}
