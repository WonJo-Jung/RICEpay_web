// 4. 환율 도메인을 하나의 모듈로 묶음.
import { Module } from '@nestjs/common';
import { FxController } from './fx.controller';
import { FxService } from './fx.service';
import { FrankfurterProvider } from './providers/frankfurter.provider';
import { OxrProvider } from './providers/oxr.provider';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [FxController],
  providers: [FxService, FrankfurterProvider, OxrProvider],
  exports: [FxService],
})
export class FxModule {}