import { Module } from '@nestjs/common';
import { PolymarketProvider } from './polymarket.provider';
import { PolymarketHttpService } from './polymarket-http.service';
import { PolymarketClobService } from './polymarket-clob.service';
import { MARKET_PROVIDER } from '../market-provider.interface';

@Module({
  providers: [
    PolymarketHttpService,
    PolymarketClobService,
    PolymarketProvider,
    {
      provide: MARKET_PROVIDER,
      useExisting: PolymarketProvider,
    },
  ],
  exports: [PolymarketProvider, PolymarketClobService, MARKET_PROVIDER],
})
export class PolymarketModule {}
