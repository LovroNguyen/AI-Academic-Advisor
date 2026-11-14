import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } })],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
