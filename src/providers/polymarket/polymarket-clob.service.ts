import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClobClient, Chain, type OrderBookSummary, type TickSize } from '@polymarket/clob-client';

export interface PaginationPayload {
  data: unknown[];
  next_cursor?: string;
  limit?: number;
  count?: number;
}

export interface PriceResponse {
  price: string;
}

@Injectable()
export class PolymarketClobService {
  private readonly client: ClobClient;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('polymarket.clobApiUrl')!;

    this.client = new ClobClient(host, Chain.POLYGON);
  }

  getClient(): ClobClient {
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getOk();
      return true;
    } catch {
      return false;
    }
  }

  async getMarkets(nextCursor?: string): Promise<PaginationPayload> {
    return this.client.getMarkets(nextCursor) as Promise<PaginationPayload>;
  }

  async getMarket(conditionId: string): Promise<unknown> {
    return this.client.getMarket(conditionId) as Promise<unknown>;
  }

  async getOrderBook(tokenId: string): Promise<OrderBookSummary> {
    return this.client.getOrderBook(tokenId);
  }

  async getMidpoint(tokenId: string): Promise<PriceResponse> {
    return this.client.getMidpoint(tokenId) as Promise<PriceResponse>;
  }

  async getPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<PriceResponse> {
    return this.client.getPrice(tokenId, side) as Promise<PriceResponse>;
  }

  async getLastTradePrice(tokenId: string): Promise<PriceResponse> {
    return this.client.getLastTradePrice(tokenId) as Promise<PriceResponse>;
  }

  async getTickSize(tokenId: string): Promise<TickSize> {
    return this.client.getTickSize(tokenId);
  }
}
