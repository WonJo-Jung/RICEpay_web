// 2. 앱의 뼈대 역할. 구성 관리 파일에 해당.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { FxModule } from './fx/fx.module'; // 새로 만들 환율 모듈
import { FeesModule } from './fees/fees.module';

@Module({
  imports: [
    // .env 로딩 (전역)
    ConfigModule.forRoot({ isGlobal: true }),
    // 외부 HTTP 호출용 (프로바이더들이 사용)
    HttpModule.register({
      timeout: Number(process.env.FX_TIMEOUT_MS ?? 2500),
      maxRedirects: 0,
    }),
    // 메모리 캐시 (전역)
    CacheModule.register({ isGlobal: true }),
    // 간단 레이트리밋
    ThrottlerModule.forRoot([{
      ttl: 1000, // 1s
      limit: 10, // 초당 10회
    }]),
    // 환율 모듈
    FxModule,
    // 수수료 모듈
    FeesModule,
  ],
  providers: [],
})
export class AppModule {}