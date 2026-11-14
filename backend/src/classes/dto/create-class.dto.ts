import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  subjectCode: string;

  @IsNumber()
  @Min(1)
  creditHours: number;

  @IsString()
  @IsNotEmpty()
  semester: string;
}
