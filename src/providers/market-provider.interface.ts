import type { EventQueryParams, MarketQueryParams, ProviderEvent, ProviderMarket, MarketPrice, OrderRequest, OrderResult, CancelResult, OrderStatus, MarketProvider, WalletContext } from '../types';

export type { MarketProvider as IMarketProvider };

export type { EventQueryParams, MarketQueryParams, ProviderEvent, ProviderMarket, MarketPrice, OrderRequest, OrderResult, CancelResult, OrderStatus, WalletContext };

export const MARKET_PROVIDER = Symbol('MARKET_PROVIDER');
