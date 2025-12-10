// 2. 앱의 뼈대 역할. 구성 관리 파일에 해당.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { FxModule } from './fx/fx.module'; // 새로 만들 환율 모듈
import { FeesModule } from './fees/fees.module';
import { APP_GUARD } from '@nestjs/core';
import { TxModule } from './tx/tx.module';
import { AlchemyWebhookController } from './webhooks/alchemy.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { ReceiptModule } from './receipt/receipt.module';
import { AuthController } from './auth/auth.controller';
import { ComplianceModule } from './compliance/compliance.module';
import { DevicesModule } from './devices/devices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotifyModule } from './alchemy/notify.module';
import { HealthController } from './health/health.controller';

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
    CacheModule.register({ isGlobal: true, ttl: 5 }),
    // 간단 레이트리밋(전역)
    ThrottlerModule.forRoot([{
      ttl: 60, // 60s
      limit: 120, // 120번
    }]),
    // 환율 모듈
    FxModule,
    // 수수료 모듈
    FeesModule,
    // 트랜잭션 상태 추적 모듈
    TxModule,
    // 전역 스케줄러 초기화 모듈 (Global Scheduler Module).
    // - @Cron, @Interval, @Timeout 데코레이터를 인식하고 실행
    // - TxCron, TxCleanupCron 등 각 모듈의 주기적 작업을 동작시킴
    // - 앱 전체에서 스케줄 기반 잡을 사용할 수 있도록 전역 환경을 구성
    ScheduleModule.forRoot(),
    ReceiptModule,
    ComplianceModule,
    DevicesModule,
    NotificationsModule,
    NotifyModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // ✅ 전역 가드 활성화
  ],
  controllers: [AlchemyWebhookController, AuthController, HealthController]
})
export class AppModule {}