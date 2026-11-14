import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

// Public self-registration always creates a student account.
// Admin accounts are created by the seed script (prisma/seed.ts) only.
export class RegisterDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;
}
