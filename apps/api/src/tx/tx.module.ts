import { Module } from '@nestjs/common';
import { TxService } from './tx.service';
import { TxController } from './tx.controller';
import { TxStream } from './tx.stream';
import { TxCron } from './tx.cron';
import { ScheduleModule } from '@nestjs/schedule';
import { TxReindexController } from './tx.reindex.controller';
import { TxCleanupCron } from './tx.cleanup.cron';
import { TxCleanupController } from './tx.cleanup.controller';
import { MaintenanceGuard } from '../common/guards/maintenance.guard';
import { FeesService } from '../fees/fees.service';
import { FxModule } from '../fx/fx.module';
import { ReceiptModule } from '../receipt/receipt.module';

/**
 * TxModule
 *
 * 트랜잭션 상태 추적 모듈 (Transaction Tracking Module).
 * - 사용자가 생성한 txHash를 DB에 기록 (PENDING 상태)
 * - Alchemy webhook 이벤트를 수신하여 상태(CONFIRMED/FAILED 등) 업데이트
 * - SSE를 통해 클라이언트(web/app)에 상태 변경을 실시간 전달
 *
 * ⚖️ 비수탁 원칙: 서버는 온체인 데이터를 '조회·기록·알림'만 담당하며,
 *    프라이빗 키나 송금 집행은 일절 하지 않음.
 */
@Module({
  imports: [FxModule, ScheduleModule, ReceiptModule],
  providers: [TxService, TxStream, TxCron, TxCleanupCron, MaintenanceGuard, FeesService],
  controllers: [TxController, TxReindexController, TxCleanupController],
  exports: [TxService, TxStream],
})
export class TxModule {}