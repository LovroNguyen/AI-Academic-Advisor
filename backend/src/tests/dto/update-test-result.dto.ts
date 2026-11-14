import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class UpdateTestResultDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  result: number;
}
