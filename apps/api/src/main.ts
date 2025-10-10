// 1. 애플리케이션 진입점. 실행 담당.
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'body-parser';

const corsAllowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix(process.env.GLOBAL_PREFIX!);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  app.enableCors({
    origin(origin, cb) {
    // 모바일/서버 간 통신은 origin이 null/undefined일 수 있음 → 허용
    if (!origin) return cb(null, true);

    // 정확히 일치하는 origin만 허용 (URL 형태만 기대)
    if (corsAllowed.includes(origin)) return cb(null, true);

    // 그 외는 차단
    return cb(new Error('CORS blocked'), false);
    },
    credentials: true,
    // ✅ 커스텀 헤더를 허용해야 cf-ipcountry, cf-region이 전달됨
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      ...(process.env.ALLOW_DEV_HEADERS === 'true'
        ? ['cf-ipcountry', 'cf-region']
        : []),
    ],
  })
  app.use(json({ verify: (req: any, _res, buf) => (req.rawBody = buf) }));
  app.use(urlencoded({ extended: true }));
  await app.listen(process.env.PORT || 4000);
  console.log('API on http://localhost:' + (process.env.PORT || 4000));
}
bootstrap();
