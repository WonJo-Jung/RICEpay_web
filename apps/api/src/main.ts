// 1. 애플리케이션 진입점. 실행 담당.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.enableCors({ origin: "http://localhost:3000" })
  app.use(json({ verify: (req: any, _res, buf) => (req.rawBody = buf) }));
  app.use(urlencoded({ extended: true }));
  await app.listen(process.env.PORT || 4000);
  console.log('API on http://localhost:' + (process.env.PORT || 4000));
}
bootstrap();
