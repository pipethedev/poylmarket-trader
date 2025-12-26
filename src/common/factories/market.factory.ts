import { Market } from '@database/entities/market.entity';
import type { ProviderMarket } from '@app-types/index';

export class MarketFactory {
  static create(
    data: ProviderMarket,
    eventId: number,
    providerName: string,
  ): Partial<Market> {
    return {
      externalId: data.id,
      provider: providerName,
      eventId,
      conditionId: data.conditionId ?? null,
      question: data.question,
      description: data.description ?? null,
      outcomeYesPrice: data.outcomeYesPrice,
      outcomeNoPrice: data.outcomeNoPrice,
      volume: data.volume ?? null,
      liquidity: data.liquidity ?? null,
      active: data.active,
      closed: data.closed,
      metadata: data.metadata ?? null,
    };
  }

  static update(entity: Market, data: ProviderMarket): Market {
    entity.question = data.question;
    entity.description = data.description ?? null;
    entity.conditionId = data.conditionId ?? null;
    entity.outcomeYesPrice = data.outcomeYesPrice;
    entity.outcomeNoPrice = data.outcomeNoPrice;
    entity.volume = data.volume ?? null;
    entity.liquidity = data.liquidity ?? null;
    entity.active = data.active;
    entity.closed = data.closed;
    entity.metadata = data.metadata ?? null;
    return entity;
  }
}
