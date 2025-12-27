import { Module } from '@nestjs/common';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';
import { PricesModule } from '../prices/prices.module';

@Module({ imports:[PricesModule], controllers: [FeesController], providers: [FeesService] })
export class FeesModule {}