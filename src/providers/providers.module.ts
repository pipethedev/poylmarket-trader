import { Module } from '@nestjs/common';
import { PolymarketModule } from './polymarket/polymarket.module';

@Module({
  imports: [PolymarketModule],
  exports: [PolymarketModule],
})
export class ProvidersModule {}
