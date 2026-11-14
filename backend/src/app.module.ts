import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { LessonsModule } from './lessons/lessons.module';
import { AttendanceModule } from './attendance/attendance.module';
import { GradesModule } from './grades/grades.module';
import { TestsModule } from './tests/tests.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AiModule } from './ai/ai.module';
import { FaceModule } from './face/face.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ClassesModule,
    LessonsModule,
    AttendanceModule,
    GradesModule,
    TestsModule,
    ConversationsModule,
    AiModule,
    FaceModule,
  ],
})
export class AppModule {}
