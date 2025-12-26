export const Chain = {
  POLYGON: 137,
};

export class ClobClient {
  constructor(_host: string, _chain: number) {}

  async getOk(): Promise<string> {
    return 'OK';
  }

  async getMarkets(_nextCursor?: string): Promise<{ data: unknown[]; next_cursor: string | null }> {
    return { data: [], next_cursor: null };
  }

  async getMarket(_conditionId: string): Promise<unknown> {
    return {};
  }

  async getOrderBook(_tokenId: string): Promise<{ bids: unknown[]; asks: unknown[] }> {
    return { bids: [], asks: [] };
  }

  async getMidpoint(_tokenId: string): Promise<{ mid: string }> {
    return { mid: '0.50' };
  }

  async getPrice(_tokenId: string, _side: string): Promise<{ price: string }> {
    return { price: '0.50' };
  }

  async getLastTradePrice(_tokenId: string): Promise<{ price: string }> {
    return { price: '0.50' };
  }

  async getTickSize(_tokenId: string): Promise<{ minimum_tick_size: string }> {
    return { minimum_tick_size: '0.01' };
  }
}

export interface OrderBookSummary {
  bids: unknown[];
  asks: unknown[];
}

export interface TickSize {
  minimum_tick_size: string;
}

