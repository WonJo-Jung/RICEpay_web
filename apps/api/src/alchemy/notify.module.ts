import { Module } from '@nestjs/common';
import { AlchemyNotifyService } from './notify.service';
import { AlchemyNotifyController } from './notify.controller';

@Module({
  providers: [AlchemyNotifyService],
  controllers: [AlchemyNotifyController],
  exports: [AlchemyNotifyService],
})
export class NotifyModule {}