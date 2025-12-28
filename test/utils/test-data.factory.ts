import { DataSource, Repository } from 'typeorm';
import { Event } from '@database/entities/event.entity';
import { Market } from '@database/entities/market.entity';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import { Order, OrderType, OrderSide, OrderStatus, OrderOutcome } from '@database/entities/order.entity';

export class TestDataFactory {
  private eventRepo: Repository<Event>;
  private marketRepo: Repository<Market>;
  private tokenRepo: Repository<Token>;
  private orderRepo: Repository<Order>;

  constructor(private readonly dataSource: DataSource) {
    this.eventRepo = dataSource.getRepository(Event);
    this.marketRepo = dataSource.getRepository(Market);
    this.tokenRepo = dataSource.getRepository(Token);
    this.orderRepo = dataSource.getRepository(Order);
  }

  async createEvent(overrides?: Partial<Event>): Promise<Event> {
    const event = this.eventRepo.create({
      externalId: `event-${Date.now()}-${Math.random()}`,
      provider: 'polymarket',
      slug: 'test-event',
      title: 'Test Event',
      description: 'Test event description',
      active: true,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      ...overrides,
    });
    return this.eventRepo.save(event);
  }

  async createMarket(eventId: number, overrides?: Partial<Market>): Promise<Market> {
    const market = this.marketRepo.create({
      externalId: `market-${Date.now()}-${Math.random()}`,
      provider: 'polymarket',
      conditionId: `condition-${Date.now()}`,
      eventId,
      question: 'Will this happen?',
      description: 'Test market description',
      active: true,
      closed: false,
      outcomeYesPrice: '0.5',
      outcomeNoPrice: '0.5',
      ...overrides,
    });
    return this.marketRepo.save(market);
  }

  async createToken(marketId: number, outcome: TokenOutcome, overrides?: Partial<Token>): Promise<Token> {
    const token = this.tokenRepo.create({
      tokenId: `token-${outcome}-${Date.now()}-${Math.random()}`,
      marketId,
      outcome,
      price: '0.5',
      ...overrides,
    });
    return this.tokenRepo.save(token);
  }

  async createOrder(marketId: number, outcome: OrderOutcome, overrides?: Partial<Order>): Promise<Order> {
    const order = this.orderRepo.create({
      marketId,
      outcome,
      type: OrderType.MARKET,
      side: OrderSide.BUY,
      quantity: '10',
      price: '0.5',
      status: OrderStatus.PENDING,
      idempotencyKey: `idem-${Date.now()}-${Math.random()}`,
      ...overrides,
    });
    return this.orderRepo.save(order);
  }

  async createCompleteEventWithMarkets(): Promise<{
    event: Event;
    markets: Market[];
    tokens: Token[];
  }> {
    const event = await this.createEvent();
    const market1 = await this.createMarket(event.id, {
      question: 'Market 1?',
    });
    const market2 = await this.createMarket(event.id, {
      question: 'Market 2?',
    });

    const tokensM1 = await Promise.all([this.createToken(market1.id, TokenOutcome.YES), this.createToken(market1.id, TokenOutcome.NO)]);

    const tokensM2 = await Promise.all([this.createToken(market2.id, TokenOutcome.YES), this.createToken(market2.id, TokenOutcome.NO)]);

    return {
      event,
      markets: [market1, market2],
      tokens: [...tokensM1, ...tokensM2],
    };
  }
}
