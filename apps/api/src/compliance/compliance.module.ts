import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceGuard } from './compliance.guard';
import { GeofenceService } from './geofence.service';
import { SanctionsService } from './sanctions.service';
// import { LocalSanctionsProvider } from './providers/local.provider';
import { OfacLookupProvider } from './providers/ofaclookup.provider';
import { ScheduleModule } from '@nestjs/schedule';
import { OpenSanctionsProvider } from './providers/opensanctions.provider';
// import { TrmSanctionsProvider } from './providers/trm.provider';
// import { ComplyAdvantageProvider } from './providers/comply.provider';

const sanctionsProviderFactory = {
  provide: 'SANCTIONS_PROVIDER',
  useFactory: () => {
    const src = (process.env.SANCTIONS_PROVIDER!).toUpperCase();
    // if (src === 'TRM') {
    //   const key = process.env.SANCTIONS_PROVIDER_API_KEY!;
    //   return new TrmSanctionsProvider(key);
    // }
    // if (src === 'COMPLY_ADVANTAGE') {
    //   const key = process.env.COMPLY_ADVANTAGE_API_KEY!;
    //   return new ComplyAdvantageProvider(key);
    // }
    if (src === 'OFACLOOKUP') {
      return new OfacLookupProvider();
    }

    return new OpenSanctionsProvider(); // 제재리스트를 온프레미스로 전환시 LocalSanctionsProvider로 전환
  },
};

@Module({
  imports: [ScheduleModule],
  controllers: [ComplianceController],
  providers: [ComplianceGuard, GeofenceService, SanctionsService, sanctionsProviderFactory], // 제재리스트를 온프레미스로 전환시 SanctionsSyncService 추가
  exports: [ComplianceGuard, GeofenceService, SanctionsService, 'SANCTIONS_PROVIDER'],
})
export class ComplianceModule {}