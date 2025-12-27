export interface PolymarketGammaEvent {
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
}

export interface PolymarketGammaMarket {
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
}

export interface PolymarketGammaToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface PolymarketEventsResponse {
  data: PolymarketGammaEvent[];
  next_cursor?: string;
}
