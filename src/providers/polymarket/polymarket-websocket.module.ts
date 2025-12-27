import { Module } from '@nestjs/common';
import { PolymarketWebSocketService } from './polymarket-websocket.service';
import { MarketUpdateHandlerService } from './market-update-handler.service';

@Module({
  providers: [PolymarketWebSocketService, MarketUpdateHandlerService],
  exports: [PolymarketWebSocketService, MarketUpdateHandlerService],
})
export class PolymarketWebSocketModule {}
