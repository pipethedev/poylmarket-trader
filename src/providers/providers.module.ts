import { Module } from '@nestjs/common';
import { PolymarketModule } from './polymarket/polymarket.module';
import { ProviderManagerService } from './provider-manager.service';

@Module({
  imports: [PolymarketModule],
  providers: [ProviderManagerService],
  exports: [PolymarketModule, ProviderManagerService],
})
export class ProvidersModule {}
