import type { ProviderEvent, ProviderMarket, ProviderToken } from '@app-types/index';
import type { PolymarketGammaEvent, PolymarketGammaMarket, ClobToken, ClobMarketData } from '@providers/polymarket/polymarket.types';

export class PolymarketFactory {
  static mapEventToProvider(event: PolymarketGammaEvent): ProviderEvent {
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

  static mapMarketToProvider(market: PolymarketGammaMarket, eventId: string): ProviderMarket {
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

  static mapClobMarketToProvider(market: ClobMarketData): ProviderMarket {
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

  private static parseOutcomePrices(outcomePrices: string): string[] {
    try {
      if (!outcomePrices) return [];
      const parsed: unknown = JSON.parse(outcomePrices);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  private static parseTokenIds(tokenIds: string): string[] {
    try {
      if (!tokenIds) return [];
      const parsed: unknown = JSON.parse(tokenIds);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
}
