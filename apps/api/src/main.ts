// 1. 애플리케이션 진입점. 실행 담당.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  await app.listen(process.env.PORT || 4000);
  console.log('API on http://localhost:' + (process.env.PORT || 4000));
}
bootstrap();
