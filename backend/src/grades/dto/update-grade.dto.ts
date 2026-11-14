import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateGradeDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  assignmentAvg?: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  midterm?: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  finalExam?: number;
}
