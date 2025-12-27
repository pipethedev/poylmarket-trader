import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';
import { Job } from 'bullmq';
import { OrdersProcessor } from './orders.processor';
import { OrderRepository } from '@database/repositories/order.repository';
import { MarketRepository } from '@database/repositories/market.repository';
import {
  Order,
  OrderStatus,
  OrderSide,
  OrderType,
  OrderOutcome,
} from '@database/entities/order.entity';
import { Market } from '@database/entities/market.entity';
import { AppLogger } from '@common/logger/app-logger.service';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import { UsdcTokenService } from '@common/services/usdc-token.service';

describe('OrdersProcessor', () => {
  let processor: OrdersProcessor;
  let orderRepository: jest.Mocked<OrderRepository>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };

  const mockOrder: Order = {
    id: 1,
    idempotencyKey: 'idem-123',
    marketId: 1,
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    outcome: OrderOutcome.YES,
    quantity: '100',
    price: '0.65',
    status: OrderStatus.QUEUED,
    filledQuantity: '0',
    averageFillPrice: null,
    externalOrderId: null,
    failureReason: null,
    metadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    market: {} as Market,
  };

  const mockMarket: Market = {
    id: 1,
    externalId: 'market-123',
    provider: 'polymarket',
    eventId: 1,
    conditionId: 'condition-456',
    question: 'Test?',
    description: null,
    outcomeYesPrice: '0.65',
    outcomeNoPrice: '0.35',
    volume: null,
    liquidity: null,
    active: true,
    closed: false,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    event: {} as never,
    tokens: [],
    orders: [],
  };

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
      },
    } as unknown as jest.Mocked<QueryRunner>;

    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersProcessor,
        {
          provide: OrderRepository,
          useValue: {
            markAsFailed: jest.fn(),
          },
        },
        {
          provide: MarketRepository,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: MARKET_PROVIDER,
          useValue: {
            getName: jest.fn().mockReturnValue('polymarket'),
            placeOrder: jest.fn(),
            cancelOrder: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: UsdcTokenService,
          useValue: {
            getBalance: jest.fn().mockResolvedValue('1000.0'),
            getAllowance: jest.fn().mockResolvedValue('1000.0'),
            transferFromUser: jest.fn().mockResolvedValue('0x123'),
            getFunderAddress: jest.fn().mockReturnValue('0xfunder'),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    processor = module.get<OrdersProcessor>(OrdersProcessor);
    orderRepository = module.get(OrderRepository);
  });

  describe('process', () => {
    it('should successfully fill a limit order', async () => {
      const job = { data: { orderId: 1, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockOrder })
        .mockResolvedValueOnce({ ...mockMarket });
      queryRunner.manager.save.mockImplementation((entity, data) => Promise.resolve(data));

      await processor.process(job);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.manager.save).toHaveBeenCalled();
    });

    it('should skip if order not found', async () => {
      const job = { data: { orderId: 999, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne.mockResolvedValue(null);

      await processor.process(job);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should skip if order is not processable', async () => {
      const filledOrder = { ...mockOrder, status: OrderStatus.FILLED };
      const job = { data: { orderId: 1, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne.mockResolvedValueOnce(filledOrder);

      await processor.process(job);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should fail order if market not found', async () => {
      const job = { data: { orderId: 1, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockOrder })
        .mockResolvedValueOnce(null);
      queryRunner.manager.save.mockImplementation((entity, data) => Promise.resolve(data));

      await processor.process(job);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should fail order if market is closed', async () => {
      const closedMarket = { ...mockMarket, closed: true };
      const job = { data: { orderId: 1, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ ...mockOrder })
        .mockResolvedValueOnce(closedMarket);
      queryRunner.manager.save.mockImplementation((entity, data) => Promise.resolve(data));

      await processor.process(job);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle market order', async () => {
      const marketOrder = { ...mockOrder, type: OrderType.MARKET, price: null };
      const job = { data: { orderId: 1, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne
        .mockResolvedValueOnce(marketOrder)
        .mockResolvedValueOnce({ ...mockMarket });
      queryRunner.manager.save.mockImplementation((entity, data) => Promise.resolve(data));

      await processor.process(job);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle NO outcome order', async () => {
      const noOutcomeOrder = { ...mockOrder, outcome: 'NO' };
      const job = { data: { orderId: 1, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne
        .mockResolvedValueOnce(noOutcomeOrder)
        .mockResolvedValueOnce({ ...mockMarket });
      queryRunner.manager.save.mockImplementation((entity, data) => Promise.resolve(data));

      await processor.process(job);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle SELL order', async () => {
      const sellOrder = { ...mockOrder, side: 'SELL' };
      const job = { data: { orderId: 1, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne
        .mockResolvedValueOnce(sellOrder)
        .mockResolvedValueOnce({ ...mockMarket });
      queryRunner.manager.save.mockImplementation((entity, data) => Promise.resolve(data));

      await processor.process(job);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle errors during processing', async () => {
      const job = { data: { orderId: 1, attempt: 1 }, id: 'job-1' } as Job;
      queryRunner.manager.findOne.mockRejectedValue(new Error('Database error'));

      await expect(processor.process(job)).rejects.toThrow('Database error');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('onFailed', () => {
    it('should mark order as failed after max attempts', async () => {
      const job = {
        data: { orderId: 1 },
        id: 'job-1',
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as unknown as Job;
      const error = new Error('Processing failed');

      await processor.onFailed(job, error);

      expect(orderRepository.markAsFailed).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Processing failed after 3 attempts'),
      );
    });

    it('should not mark as failed if attempts remaining', async () => {
      const job = {
        data: { orderId: 1 },
        id: 'job-1',
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as unknown as Job;
      const error = new Error('Retry error');

      await processor.onFailed(job, error);

      expect(orderRepository.markAsFailed).not.toHaveBeenCalled();
    });

    it('should use default 10 attempts when opts.attempts is undefined', async () => {
      const job = {
        data: { orderId: 1 },
        id: 'job-1',
        attemptsMade: 10,
        opts: {},
      } as unknown as Job;
      const error = new Error('Processing failed');

      await processor.onFailed(job, error);

      expect(orderRepository.markAsFailed).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Processing failed after 10 attempts'),
      );
    });
  });

  describe('onCompleted', () => {
    it('should log job completion', () => {
      const job = { data: { orderId: 1 }, id: 'job-1' } as Job;

      processor.onCompleted(job);

      expect(mockLogger.child).toHaveBeenCalled();
    });
  });
});
