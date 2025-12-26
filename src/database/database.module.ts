import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { Market } from './entities/market.entity';
import { Token } from './entities/token.entity';
import { Order } from './entities/order.entity';
import {
  EventRepository,
  MarketRepository,
  TokenRepository,
  OrderRepository,
} from './repositories/index';

const entities = [Event, Market, Token, Order];

const repositories = [EventRepository, MarketRepository, TokenRepository, OrderRepository];

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  providers: [...repositories],
  exports: [TypeOrmModule, ...repositories],
})
export class DatabaseModule {}
