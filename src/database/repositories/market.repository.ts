import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Market } from '@database/entities/market.entity';
import { BaseRepository } from './base.repository';

@Injectable()
export class MarketRepository extends BaseRepository<Market> {
  constructor(
    @InjectRepository(Market)
    repository: Repository<Market>,
  ) {
    super(repository);
  }

  async findByPolymarketId(polymarketId: string): Promise<Market | null> {
    return this.findOneBy({ polymarketId });
  }

  async findByEventId(eventId: number): Promise<Market[]> {
    return this.findManyBy({ eventId });
  }

  async findActiveMarkets(): Promise<Market[]> {
    return this.findManyBy({ active: true, closed: false });
  }

  async findActiveMarketsWithPriceInfo(): Promise<
    Pick<Market, 'id' | 'polymarketId' | 'conditionId'>[]
  > {
    return this.findMany({
      where: { active: true },
      select: ['id', 'polymarketId', 'conditionId'],
    });
  }

  async countByEventId(eventId: number): Promise<number> {
    return this.count({ eventId });
  }

  async getMarketCountsByEventIds(eventIds: number[]): Promise<Record<number, number>> {
    if (eventIds.length === 0) return {};

    const counts = await this.createQueryBuilder('market')
      .select('market.event_id', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('market.event_id IN (:...eventIds)', { eventIds })
      .groupBy('market.event_id')
      .getRawMany<{ eventId: number; count: string }>();

    return counts.reduce<Record<number, number>>((acc, row) => {
      acc[row.eventId] = parseInt(row.count, 10);
      return acc;
    }, {});
  }
}
