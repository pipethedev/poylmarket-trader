import { Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { AppLogger, LogPrefix } from '@common/logger';
import { ProviderException, ProviderUnavailableException } from '@common/exceptions';
import type {
  MarketProvider,
  EventQueryParams,
  MarketQueryParams,
  ProviderEvent,
  ProviderMarket,
  MarketPrice,
  ProviderToken,
  OrderRequest,
  OrderResult,
} from '@app-types/index';
import { PolymarketHttpService } from './polymarket-http.service';
import { PolymarketClobService } from './polymarket-clob.service';
import { PolymarketGammaEvent, PolymarketGammaMarket } from './polymarket.types';

@Injectable()
export class PolymarketProvider implements MarketProvider {
  readonly providerName = 'polymarket';

  private readonly logger: AppLogger;

  constructor(
    private readonly http: PolymarketHttpService,
    private readonly clob: PolymarketClobService,
    logger: AppLogger,
  ) {
    this.logger = logger.setPrefix(LogPrefix.PROVIDER).setContext(PolymarketProvider.name);
  }

  getName(): string {
    return this.providerName;
  }

  async getEvents(params?: EventQueryParams): Promise<ProviderEvent[]> {
    try {
      this.logger.debug('Fetching events from Gamma API');

      const response = await this.http.gammaGet<PolymarketGammaEvent[]>('/events', {
        params: {
          limit: params?.limit,
          offset: params?.offset,
          active: params?.active,
          closed: params?.closed,
          start_date_min: params?.startDateMin,
          start_date_max: params?.startDateMax,
          end_date_min: params?.endDateMin,
          end_date_max: params?.endDateMax,
        },
      });

      this.logger.log(`Fetched ${response.data.length} events`);
      return response.data.map((event) => this.mapEventToProvider(event));
    } catch (error) {
      throw this.handleError(error, 'getEvents');
    }
  }

  async getMarkets(eventId: string, _params?: MarketQueryParams): Promise<ProviderMarket[]> {
    try {
      this.logger.setContextData({ eventId }).debug('Fetching markets for event from Gamma API');

      const response = await this.http.gammaGet<PolymarketGammaEvent>(`/events/${eventId}`);

      const markets = response.data.markets || [];
      this.logger.log(`Fetched ${markets.length} markets for event ${eventId}`);
      return markets.map((market) => this.mapMarketToProvider(market, eventId));
    } catch (error) {
      throw this.handleError(error, 'getMarkets');
    }
  }

  async getAllMarkets(params?: MarketQueryParams): Promise<ProviderMarket[]> {
    try {
      this.logger.debug('Fetching all markets from CLOB API');

      const result = await this.clob.getMarkets();
      const markets = (result.data || []) as ClobMarketData[];

      this.logger.log(`Fetched ${markets.length} markets`);

      let filtered = markets;
      if (params?.active !== undefined) {
        filtered = filtered.filter((m) => m.active === params.active);
      }
      if (params?.limit) {
        filtered = filtered.slice(0, params.limit);
      }

      return filtered.map((market) => this.mapClobMarketToProvider(market));
    } catch (error) {
      throw this.handleError(error, 'getAllMarkets');
    }
  }

  async getMarketPrice(conditionId: string): Promise<MarketPrice | null> {
    try {
      this.logger.setContextData({ conditionId }).debug('Fetching market price from CLOB API');

      const market = (await this.clob.getMarket(conditionId)) as ClobMarketData;

      const yesToken = market.tokens?.find((t: ClobToken) => t.outcome === 'Yes');
      const noToken = market.tokens?.find((t: ClobToken) => t.outcome === 'No');

      return {
        marketId: market.condition_id,
        yesPrice: yesToken?.price?.toString() || '0',
        noPrice: noToken?.price?.toString() || '0',
        timestamp: new Date(),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        this.logger.debug('Market not found on CLOB API, skipping price update');
        return null;
      }
      throw this.handleError(error, 'getMarketPrice');
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.clob.healthCheck();
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    try {
      this.logger
        .setContextData({ marketId: order.marketId })
        .log(`Placing ${order.side} order for ${order.outcome} outcome`);

      let market: ClobMarketData;
      try {
        market = (await this.clob.getMarket(order.marketId)) as ClobMarketData;
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('404') || error.message.includes('not found'))
        ) {
          this.logger.error(
            `Market with conditionId ${order.marketId} not found on Polymarket CLOB. The market may have been removed or the conditionId is invalid.`,
          );
          throw new Error(
            `Market not found on Polymarket. The conditionId "${order.marketId}" may be invalid or the market may have been removed. Please sync the market from Polymarket.`,
          );
        }
        throw error;
      }

      if (!market) {
        throw new Error(`Market ${order.marketId} not found`);
      }

      const outcomeString = order.outcome === 'YES' ? 'Yes' : 'No';
      const token = market.tokens?.find((t: ClobToken) => t.outcome === outcomeString);

      if (!token) {
        throw new Error(`Token for ${order.outcome} outcome not found in market ${order.marketId}`);
      }

      const tickSizeData = await this.clob.getTickSize(token.token_id);

      let orderPrice: number;
      if (order.type === 'MARKET') {
        orderPrice = token.price ?? parseFloat(order.outcome === 'YES' ? '0.5' : '0.5');
      } else {
        if (!order.price) {
          throw new Error('Limit orders require a price');
        }
        orderPrice = parseFloat(order.price);
      }

      const walletContext = order.walletContext;

      const useUserWallet = !!walletContext?.walletAddress;

      const response = await this.clob.placeOrder({
        tokenId: token.token_id,
        price: orderPrice,
        side: order.side,
        size: parseFloat(order.quantity),
        tickSize: tickSizeData,
        negRisk: market.neg_risk ?? false,
        walletContext: useUserWallet ? walletContext : undefined,
      });

      this.logger.log(`Order placed successfully with ID: ${response.orderID}`);

      return {
        orderId: response.orderID,
        status: 'PENDING',
        filledQuantity: '0',
        message: 'Order placed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to place order: ${(error as Error).message}`);
      throw this.handleError(error, 'placeOrder');
    }
  }

  private mapEventToProvider(event: PolymarketGammaEvent): ProviderEvent {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      slug: event.slug,
      image: event.image || event.icon || undefined,
      startDate: event.startDate ? new Date(event.startDate) : undefined,
      endDate: event.endDate ? new Date(event.endDate) : undefined,
      active: event.active && !event.closed && !event.archived,
      metadata: {
        ticker: event.ticker,
        featured: event.featured,
        restricted: event.restricted,
        liquidity: event.liquidity,
        volume: event.volume,
      },
    };
  }

  private mapMarketToProvider(market: PolymarketGammaMarket, eventId: string): ProviderMarket {
    const outcomePrices = this.parseOutcomePrices(market.outcomePrices);
    const tokenIds = this.parseTokenIds(market.clobTokenIds);

    const tokens: ProviderToken[] = [];
    if (tokenIds.length >= 2) {
      tokens.push({
        tokenId: tokenIds[0],
        outcome: 'YES',
        price: outcomePrices[0] || '0',
      });
      tokens.push({
        tokenId: tokenIds[1],
        outcome: 'NO',
        price: outcomePrices[1] || '0',
      });
    }

    return {
      id: market.conditionId || market.id,
      eventId,
      conditionId: market.conditionId,
      question: market.question,
      description: undefined,
      image: market.image || market.icon || undefined,
      outcomeYesPrice: outcomePrices[0] || '0',
      outcomeNoPrice: outcomePrices[1] || '0',
      volume: market.volume,
      liquidity: market.liquidity,
      active: market.active && market.acceptingOrders,
      closed: market.closed,
      tokens,
      metadata: {
        slug: market.slug,
        resolutionSource: market.resolutionSource,
        fee: market.fee,
      },
    };
  }

  private mapClobMarketToProvider(market: ClobMarketData): ProviderMarket {
    const yesToken = market.tokens?.find((t: ClobToken) => t.outcome === 'Yes');
    const noToken = market.tokens?.find((t: ClobToken) => t.outcome === 'No');

    const tokens: ProviderToken[] = [];
    if (yesToken) {
      tokens.push({
        tokenId: yesToken.token_id,
        outcome: 'YES',
        price: yesToken.price?.toString() || '0',
      });
    }
    if (noToken) {
      tokens.push({
        tokenId: noToken.token_id,
        outcome: 'NO',
        price: noToken.price?.toString() || '0',
      });
    }

    return {
      id: market.condition_id,
      eventId: '',
      conditionId: market.condition_id,
      question: market.question,
      description: market.description,
      image: market.image || market.icon || undefined,
      outcomeYesPrice: yesToken?.price?.toString() || '0',
      outcomeNoPrice: noToken?.price?.toString() || '0',
      volume: undefined,
      liquidity: undefined,
      active: market.active,
      closed: market.closed,
      tokens,
      metadata: {
        category: market.category,
        marketSlug: market.market_slug,
        minimumOrderSize: market.minimum_order_size,
        minimumTickSize: market.minimum_tick_size,
      },
    };
  }

  private parseOutcomePrices(outcomePrices: string): string[] {
    try {
      if (!outcomePrices) return [];
      const parsed: unknown = JSON.parse(outcomePrices);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private parseTokenIds(tokenIds: string): string[] {
    try {
      if (!tokenIds) return [];
      const parsed: unknown = JSON.parse(tokenIds);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }

  private handleError(error: unknown, operation: string): ProviderException {
    if (error instanceof ProviderException) {
      return error;
    }

    if (error instanceof AxiosError) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return new ProviderUnavailableException(this.providerName);
      }

      const status = error.response?.status;
      const message = error.response?.data ? JSON.stringify(error.response.data) : error.message;

      return new ProviderException(this.providerName, `${operation} failed: ${message}`, {
        status,
        code: error.code,
      });
    }

    return new ProviderException(
      this.providerName,
      `${operation} failed: ${(error as Error).message}`,
    );
  }
}

interface ClobToken {
  token_id: string;
  outcome: string;
  price?: number;
}

interface ClobMarketData {
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
}
