import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '@database/entities/event.entity';
import { BaseRepository } from './base.repository';

@Injectable()
export class EventRepository extends BaseRepository<Event> {
  constructor(
    @InjectRepository(Event)
    repository: Repository<Event>,
  ) {
    super(repository);
  }

  async findByPolymarketId(polymarketId: string): Promise<Event | null> {
    return this.findOneBy({ polymarketId });
  }

  async findActiveEvents(): Promise<Event[]> {
    return this.findManyBy({ active: true });
  }

  async findWithMarketCounts(): Promise<(Event & { marketCount: number })[]> {
    const results = await this.createQueryBuilder('event')
      .leftJoin('event.markets', 'market')
      .addSelect('COUNT(market.id)', 'marketCount')
      .groupBy('event.id')
      .getRawAndEntities();

    return results.entities.map((event, index) => ({
      ...event,
      marketCount: parseInt(
        String((results.raw[index] as { marketCount?: string })?.marketCount ?? '0'),
        10,
      ),
    }));
  }
}
