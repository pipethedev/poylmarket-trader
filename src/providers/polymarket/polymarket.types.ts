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
