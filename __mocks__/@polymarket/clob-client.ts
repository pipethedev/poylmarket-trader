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

  async cancelOrder(_orderId: { orderID: string } | string): Promise<{ canceled: string[]; not_canceled?: Record<string, string>; error?: string }> {
    const orderId = typeof _orderId === 'string' ? _orderId : _orderId.orderID;
    return { canceled: [orderId] };
  }

  async cancelOrders(_orderIds: { orderID: string }[] | string[]): Promise<{ canceled: string[]; not_canceled?: Record<string, string>; error?: string }> {
    const orderIds = Array.isArray(_orderIds) && _orderIds.length > 0 && typeof _orderIds[0] === 'string'
      ? _orderIds as string[]
      : (_orderIds as { orderID: string }[]).map(o => o.orderID);
    return { canceled: orderIds };
  }

  async cancelAll(): Promise<{ canceled: string[]; not_canceled?: Record<string, string>; error?: string }> {
    return { canceled: [] };
  }

  async cancelMarketOrders(_params: { market: string; asset_id: string }): Promise<{ canceled: string[]; not_canceled?: Record<string, string>; error?: string }> {
    return { canceled: [] };
  }
}

export interface OrderBookSummary {
  bids: unknown[];
  asks: unknown[];
}

export interface TickSize {
  minimum_tick_size: string;
}

