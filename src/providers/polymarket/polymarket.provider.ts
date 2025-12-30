import { Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { AppLogger, LogPrefix } from '@common/logger';
import { ProviderException, ProviderUnavailableException } from '@common/exceptions';
import type { MarketProvider, EventQueryParams, MarketQueryParams, ProviderEvent, ProviderMarket, MarketPrice, OrderRequest, OrderResult, WalletContext, CancelResult } from '@app-types/index';
import { PolymarketHttpService } from './polymarket-http.service';
import { PolymarketClobService } from './polymarket-clob.service';
import { ClobMarketData, ClobToken, PolymarketGammaEvent, PolymarketGammaMarket } from './polymarket.types';
import { PolymarketFactory } from '@common/factories/polymarket.factory';

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

      const queryParams = Object.assign(
        {},
        params?.limit !== undefined && { limit: params.limit },
        params?.offset !== undefined && { offset: params.offset },
        params?.active !== undefined && { active: params.active },
        params?.archived !== undefined && { archived: params.archived },
        params?.closed !== undefined && { closed: params.closed },
        params?.order !== undefined && { order: params.order },
        params?.ascending !== undefined && { ascending: params.ascending },
        params?.startDateMin !== undefined && { start_date_min: params.startDateMin },
        params?.startDateMax !== undefined && { start_date_max: params.startDateMax },
        params?.endDateMin !== undefined && { end_date_min: params.endDateMin },
        params?.endDateMax !== undefined && { end_date_max: params.endDateMax },
      );

      const response = await this.http.gammaGet<PolymarketGammaEvent[]>('/events', {
        params: queryParams,
      });

      this.logger.log(`Fetched ${response.data.length} events`);
      return response.data.map((event) => PolymarketFactory.mapEventToProvider(event));
    } catch (error) {
      throw this.handleError(error, 'getEvents');
    }
  }

  async getEvent(eventId: string): Promise<ProviderEvent | null> {
    try {
      this.logger.debug(`Fetching event ${eventId} from Gamma API`);

      const response = await this.http.gammaGet<PolymarketGammaEvent>(`/events/${eventId}`);

      if (!response.data) {
        return null;
      }

      return PolymarketFactory.mapEventToProvider(response.data);
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        this.logger.debug(`Event ${eventId} not found on Gamma API`);
        return null;
      }
      throw this.handleError(error, 'getEvent');
    }
  }

  async getMarkets(eventId: string, params?: MarketQueryParams): Promise<ProviderMarket[]> {
    try {
      this.logger.setContextData({ eventId }).debug('Fetching markets for event from Gamma API');

      const response = await this.http.gammaGet<PolymarketGammaEvent>(`/events/${eventId}`);

      let markets = (response.data.markets || []).map((market) => PolymarketFactory.mapMarketToProvider(market, eventId));

      if (params?.active !== undefined) {
        markets = markets.filter((m) => m.active === params.active);
      }
      if (params?.offset) {
        markets = markets.slice(params.offset);
      }
      if (params?.limit) {
        markets = markets.slice(0, params.limit);
      }

      this.logger.log(`Fetched ${markets.length} markets for event ${eventId}`);
      return markets;
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

      return filtered.map((market) => PolymarketFactory.mapClobMarketToProvider(market));
    } catch (error) {
      throw this.handleError(error, 'getAllMarkets');
    }
  }

  async searchMarkets(searchTerm: string, params?: MarketQueryParams): Promise<ProviderMarket[]> {
    try {
      const response = await this.http.gammaGet<any>('/public-search', {
        params: {
          q: searchTerm,
          limit: params?.limit || 50,
        },
      });

      const markets: ProviderMarket[] = [];
      const searchResults = response.data?.events || response.data?.results || response.data?.markets || response.data || [];

      for (const item of searchResults) {
        if (item.question || item.conditionId) {
          const market = item as PolymarketGammaMarket;
          let eventId = item.eventId || item.event?.id || item.event;

          if (eventId && typeof eventId === 'object') {
            eventId = eventId.id || eventId;
          }

          if (eventId) {
            try {
              markets.push(PolymarketFactory.mapMarketToProvider(market, String(eventId)));
            } catch (error) {
              this.logger.warn(`Failed to map market ${item.conditionId || item.id}: ${(error as Error).message}`);
            }
          }
        } else if (item.title || (item.id && !item.question)) {
          const event = item as PolymarketGammaEvent;
          if (event.markets && Array.isArray(event.markets)) {
            for (const market of event.markets) {
              try {
                markets.push(PolymarketFactory.mapMarketToProvider(market, event.id));
              } catch (error) {
                this.logger.warn(`Failed to map market from event ${event.id}: ${(error as Error).message}`);
              }
            }
          }
        }
      }

      let filtered = markets;
      if (params?.active !== undefined) {
        filtered = filtered.filter((m) => m.active === params.active);
      }

      this.logger.log(`Found ${filtered.length} markets matching "${searchTerm}"`);
      return filtered;
    } catch (error) {
      this.logger.warn(`Search failed: ${(error as Error).message}`);
      return [];
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
      this.logger.setContextData({ marketId: order.marketId }).log(`Placing ${order.side} order for ${order.outcome} outcome`);

      let market: ClobMarketData;
      try {
        market = (await this.clob.getMarket(order.marketId)) as ClobMarketData;
      } catch (error) {
        if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
          this.logger.error(`Market with conditionId ${order.marketId} not found on Polymarket CLOB. The market may have been removed or the conditionId is invalid.`);
          throw new Error(`Market not found on Polymarket. The conditionId "${order.marketId}" may be invalid or the market may have been removed. Please sync the market from Polymarket.`);
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

      const tickSize = await this.clob.getTickSize(token.token_id);

      const negRisk = market.neg_risk ?? false;

      const MIN_PRICE = 0.001;
      const MAX_PRICE = 0.999;

      let orderPrice: number;
      if (order.type === 'MARKET') {
        const marketPrice = token.price ?? parseFloat(order.outcome === 'YES' ? '0.5' : '0.5');
        orderPrice = Math.max(MIN_PRICE, Math.min(marketPrice, MAX_PRICE));
      } else {
        if (!order.price) {
          throw new Error('Limit orders require a price');
        }
        const limitPrice = parseFloat(order.price);
        orderPrice = Math.max(MIN_PRICE, Math.min(limitPrice, MAX_PRICE));
      }

      const walletContext = order.walletContext;

      const useUserWallet = !!walletContext?.walletAddress;

      const requestedSize = parseFloat(order.quantity);

      const totalOrderValue = requestedSize * orderPrice;

      const minimumOrderValue = 1.0;

      let finalSize = requestedSize;
      if (totalOrderValue < minimumOrderValue) {
        finalSize = Math.ceil(minimumOrderValue / orderPrice);
        this.logger.warn(
          `Order value ($${totalOrderValue.toFixed(4)}) is below minimum ($${minimumOrderValue}). ` + `Adjusting size from ${requestedSize} to ${finalSize} shares to meet minimum order value.`,
        );
      }

      this.logger.log(`Placing order: ${order.side} ${finalSize} @ ${orderPrice} for token ${token.token_id}, negRisk: ${negRisk}, tickSize: ${tickSize}`);

      const response = await this.clob.placeOrder({
        tokenId: token.token_id,
        price: orderPrice,
        side: order.side,
        size: finalSize,
        tickSize: tickSize,
        negRisk: negRisk,
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

  async cancelOrder(orderId: string, walletContext?: WalletContext): Promise<CancelResult> {
    try {
      this.logger.setContextData({ orderId: Number(orderId) }).log(`Cancelling order on Polymarket`);

      const result = await this.clob.cancelOrder(orderId, walletContext);

      if (!result.success) {
        this.logger.error(`Failed to cancel order on Polymarket: ${result.message}`);
        return {
          success: false,
          orderId,
          message: result.message || 'Failed to cancel order',
        };
      }

      this.logger.log(`Order cancelled successfully on Polymarket: ${orderId}`);
      return {
        success: true,
        orderId,
        message: result.message || 'Order cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to cancel order: ${(error as Error).message}`);
      throw this.handleError(error, 'cancelOrder');
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

    return new ProviderException(this.providerName, `${operation} failed: ${(error as Error).message}`);
  }
}
