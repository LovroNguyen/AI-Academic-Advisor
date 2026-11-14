import './env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Face images are sent as base64 JSON, so allow larger bodies than the 100 kB default.
  app.use(json({ limit: '16mb' }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: 'http://localhost:5173', credentials: true });
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
  console.log(`backend running on http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
