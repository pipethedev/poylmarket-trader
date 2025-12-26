import { Injectable } from '@nestjs/common';
import { MarketRepository, TokenRepository, EventRepository } from '@database/repositories/index';
import { Market } from '@database/entities/market.entity';
import { Token } from '@database/entities/token.entity';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { MarketNotFoundException } from '@common/exceptions/index';
import { QueryMarketsDto } from './dto/query-markets.dto';
import {
  MarketResponseDto,
  MarketListResponseDto,
  MarketDetailResponseDto,
  TokenResponseDto,
} from './dto/market-response.dto';

@Injectable()
export class MarketsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly marketRepository: MarketRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly eventRepository: EventRepository,
    logger: AppLogger,
  ) {
    this.logger = logger.setPrefix(LogPrefix.API).setContext(MarketsService.name);
  }

  async getMarkets(query: QueryMarketsDto): Promise<MarketListResponseDto> {
    this.logger.log('Fetching markets list');

    const qb = this.marketRepository.createQueryBuilder('market');

    if (query.eventId) {
      qb.andWhere('market.event_id = :eventId', { eventId: query.eventId });
    }

    if (query.active !== undefined) {
      qb.andWhere('market.active = :active', { active: query.active });
    }

    if (query.search) {
      qb.andWhere('market.question ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('market.updatedAt', 'DESC');

    const result = await this.marketRepository.paginate(qb, {
      page: query.page ?? 1,
      size: query.pageSize ?? 20,
    });

    this.logger.log(`Found ${result.meta.total} markets`);

    return {
      data: result.data.map((market) => this.mapToResponse(market)),
      meta: result.meta,
    };
  }

  async getMarket(id: number): Promise<MarketDetailResponseDto> {
    this.logger.setContextData({ marketId: id }).log('Fetching market details');

    const market = await this.marketRepository.findById(id);

    if (!market) {
      this.logger.warn('Market not found');
      throw new MarketNotFoundException(String(id));
    }

    const [tokens, event] = await Promise.all([
      this.tokenRepository.findByMarketId(id),
      this.eventRepository.findById(market.eventId),
    ]);

    this.logger.log(`Market found with ${tokens.length} tokens`);

    return {
      ...this.mapToResponse(market),
      tokens: tokens.map((token) => this.mapTokenToResponse(token)),
      eventTitle: event?.title,
    };
  }

  async getMarketByExternalId(
    externalId: string,
    provider = 'polymarket',
  ): Promise<MarketDetailResponseDto> {
    this.logger.setContextData({ externalId, provider }).log('Fetching market by external ID');

    const market = await this.marketRepository.findByExternalId(externalId, provider);

    if (!market) {
      this.logger.warn('Market not found');
      throw new MarketNotFoundException(externalId);
    }

    return this.getMarket(market.id);
  }

  private mapToResponse(market: Market): MarketResponseDto {
    return {
      id: market.id,
      externalId: market.externalId,
      conditionId: market.conditionId,
      eventId: market.eventId,
      question: market.question,
      description: market.description,
      outcomeYesPrice: market.outcomeYesPrice,
      outcomeNoPrice: market.outcomeNoPrice,
      volume: market.volume,
      liquidity: market.liquidity,
      active: market.active,
      closed: market.closed,
      createdAt: market.createdAt,
      updatedAt: market.updatedAt,
    };
  }

  private mapTokenToResponse(token: Token): TokenResponseDto {
    return {
      id: token.id,
      tokenId: token.tokenId,
      outcome: token.outcome,
      price: token.price,
    };
  }
}
