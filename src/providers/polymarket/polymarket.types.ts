import { WalletContext } from '@/types/provider.types';

export type PolymarketGammaEvent = {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  image?: string;
  icon?: string;
  startDate: string;
  creationDate: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  liquidity: number;
  volume: number;
  markets: PolymarketGammaMarket[];
};

export type PolymarketGammaMarket = {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  image?: string;
  icon?: string;
  resolutionSource: string;
  endDate: string;
  liquidity: string;
  startDate: string;
  fee: string;
  volume: string;
  volume24hr: string;
  volumeNum: number;
  liquidityNum: number;
  outcomes: string;
  outcomePrices: string;
  clobTokenIds: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  acceptingOrders: boolean;
  tokens: PolymarketGammaToken[];
};

export type PolymarketGammaToken = {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
};

export type PolymarketEventsResponse = {
  data: PolymarketGammaEvent[];
  next_cursor?: string;
};

export type ClobToken = {
  token_id: string;
  outcome: string;
  price?: number;
};

export type ClobMarketData = {
  condition_id: string;
  question: string;
  description?: string;
  image?: string;
  icon?: string;
  active: boolean;
  closed: boolean;
  category?: string;
  market_slug?: string;
  minimum_order_size?: string;
  minimum_tick_size?: string;
  neg_risk?: boolean;
  tokens?: ClobToken[];
};

export type PaginationPayload = {
  data: unknown[];
  next_cursor?: string;
  limit?: number;
  count?: number;
};

export type PriceResponse = {
  price: string;
};

export type PlaceOrderParams = {
  tokenId: string;
  price: number;
  side: 'BUY' | 'SELL';
  size: number;
  tickSize: string;
  negRisk: boolean;
  walletContext?: WalletContext;
};

export type OrderResponse = {
  orderID: string;
  status?: string;
  error?: string;
};

export type WebSocketMessage = {
  event_type: string;
  [key: string]: unknown;
};

export type PriceChange = {
  asset_id: string;
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
  hash: string;
  best_bid: string;
  best_ask: string;
};

export type BookMessage = {
  event_type: string;
  asset_id: string;
  market: string;
  timestamp: string;
  hash: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
};

export type PriceChangeMessage = {
  event_type: string;
  market: string;
  price_changes: PriceChange[];
  timestamp: string;
};

export type LastTradePriceMessage = {
  event_type: string;
  asset_id: string;
  market: string;
  price: string;
  side: 'BUY' | 'SELL';
  size: string;
  timestamp: string;
};

export type BestBidAskMessage = {
  event_type: string;
  market: string;
  asset_id: string;
  best_bid: string;
  best_ask: string;
  spread: string;
  timestamp: string;
};

export type NewMarketMessage = {
  event_type: string;
  id: string;
  question: string;
  market: string;
  slug: string;
  description: string;
  assets_ids: string[];
  outcomes: string[];
  timestamp: string;
};

export type MarketResolvedMessage = {
  event_type: string;
  id: string;
  question: string;
  market: string;
  winning_asset_id: string;
  winning_outcome: string;
  timestamp: string;
};

export type SubscriptionMessage = {
  type?: 'MARKET' | 'USER';
  operation?: 'subscribe' | 'unsubscribe';
  assets_ids?: string[];
  markets?: string[];
  custom_feature_enabled?: boolean;
};
