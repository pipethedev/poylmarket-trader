export type EventQueryParams = {
  limit?: number;
  offset?: number;
  active?: boolean;
  slug?: string;
};

export type MarketQueryParams = {
  limit?: number;
  offset?: number;
  active?: boolean;
};

export type ProviderEvent = {
  id: string;
  title: string;
  description?: string;
  slug?: string;
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  metadata?: Record<string, unknown>;
};

export type ProviderMarket = {
  id: string;
  eventId: string;
  conditionId?: string;
  question: string;
  description?: string;
  outcomeYesPrice: string;
  outcomeNoPrice: string;
  volume?: string;
  liquidity?: string;
  active: boolean;
  closed: boolean;
  tokens: ProviderToken[];
  metadata?: Record<string, unknown>;
};

export type ProviderToken = {
  tokenId: string;
  outcome: 'YES' | 'NO';
  price: string;
};

export type MarketPrice = {
  marketId: string;
  yesPrice: string;
  noPrice: string;
  timestamp: Date;
};

export type OrderRequest = {
  marketId: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  outcome: 'YES' | 'NO';
  quantity: string;
  price?: string;
};

export type OrderResult = {
  orderId: string;
  status: 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'FAILED';
  filledQuantity: string;
  averagePrice?: string;
  message?: string;
};

export type CancelResult = {
  success: boolean;
  orderId: string;
  message?: string;
};

export type OrderStatus = {
  orderId: string;
  status: 'PENDING' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'FAILED';
  filledQuantity: string;
  remainingQuantity: string;
  averagePrice?: string;
};

export type MarketProvider = {
  readonly providerName: string;
  getEvents(params?: EventQueryParams): Promise<ProviderEvent[]>;
  getMarkets(eventId: string, params?: MarketQueryParams): Promise<ProviderMarket[]>;
  getAllMarkets(params?: MarketQueryParams): Promise<ProviderMarket[]>;
  getMarketPrice(marketId: string): Promise<MarketPrice | null>;
  placeOrder?(order: OrderRequest): Promise<OrderResult>;
  cancelOrder?(orderId: string): Promise<CancelResult>;
  getOrderStatus?(orderId: string): Promise<OrderStatus>;
  healthCheck(): Promise<boolean>;
};
