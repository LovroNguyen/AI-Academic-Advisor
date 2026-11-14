import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() createClassDto: CreateClassDto, @Request() req) {
    return this.classesService.create(createClassDto, req.user.id);
  }

  @Get()
  findAll(@Request() req, @Query('enrolledOnly') enrolledOnly?: string) {
    return this.classesService.findAll(req.user?.id, enrolledOnly === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
  }

  @Post(':id/enroll')
  enroll(@Param('id') id: string, @Request() req) {
    return this.classesService.enroll(id, req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/admin-enroll')
  adminEnroll(@Param('id') id: string, @Body() body: { studentId: string }) {
    return this.classesService.adminEnroll(id, body.studentId);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id/enrollments/:studentId')
  unenroll(@Param('id') id: string, @Param('studentId') studentId: string) {
    return this.classesService.unenroll(id, studentId);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get(':id/enrollments')
  getEnrolledStudents(@Param('id') id: string) {
    return this.classesService.getEnrolledStudents(id);
  }
}
