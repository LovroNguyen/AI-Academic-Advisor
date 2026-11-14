import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FaceService } from './face.service';

// ~15 MB of base64 text, enough for a downscaled phone photo
const MAX_IMAGE_CHARS = 15_000_000;

export class RegisterFaceDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_IMAGE_CHARS)
  imageBase64: string;
}

export class RecognizeFaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_IMAGE_CHARS)
  imageBase64: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(0.6)
  tolerance?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  minFacePx?: number;
}

/** Admin-only proxy to the face recognition service. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('face')
export class FaceController {
  constructor(private readonly face: FaceService) {}

  @Get('students')
  listStudents() {
    return this.face.listStudents();
  }

  @Post('register')
  register(@Body() dto: RegisterFaceDto) {
    return this.face.register(dto.studentId, dto.imageBase64);
  }

  @Post('recognize')
  @HttpCode(200)
  recognize(@Body() dto: RecognizeFaceDto) {
    return this.face.recognize(dto.imageBase64, dto.tolerance, dto.minFacePx);
  }

  @Delete('students/:id')
  remove(@Param('id') id: string) {
    return this.face.remove(id);
  }
}
