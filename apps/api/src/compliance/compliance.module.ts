import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceGuard } from './compliance.guard';
import { GeofenceService } from './geofence.service';
import { SanctionsService } from './sanctions.service';
import { LocalSanctionsProvider } from './providers/local.provider';
import { OfacLookupProvider } from './providers/ofaclookup.provider';
import { SanctionsSyncService } from './sync/sanctions.sync.service';
import { ScheduleModule } from '@nestjs/schedule';
// import { TrmSanctionsProvider } from './providers/trm.provider';
// import { ComplyAdvantageProvider } from './providers/comply.provider';

const sanctionsProviderFactory = {
  provide: 'SANCTIONS_PROVIDER',
  useFactory: () => {
    const src = (process.env.SANCTIONS_PROVIDER || 'LOCAL').toUpperCase();
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

    return new LocalSanctionsProvider();
  },
};

@Module({
  imports: [ScheduleModule],
  controllers: [ComplianceController],
  providers: [ComplianceGuard, GeofenceService, SanctionsService, SanctionsSyncService, sanctionsProviderFactory],
  exports: [ComplianceGuard, GeofenceService, SanctionsService, 'SANCTIONS_PROVIDER'],
})
export class ComplianceModule {}