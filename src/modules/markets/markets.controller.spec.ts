import { Test, TestingModule } from '@nestjs/testing';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';
import { TokenOutcome } from '@database/entities/token.entity';

describe('MarketsController', () => {
  let controller: MarketsController;
  let service: jest.Mocked<MarketsService>;

  const mockMarketResponse = {
    id: 1,
    externalId: 'market-123',
    eventId: 1,
    conditionId: 'condition-456',
    question: 'Test question?',
    description: 'Test description',
    outcomeYesPrice: '0.65',
    outcomeNoPrice: '0.35',
    volume: '10000',
    liquidity: '5000',
    active: true,
    closed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMarketDetailResponse = {
    ...mockMarketResponse,
    tokens: [
      { id: 1, tokenId: 'token-yes', outcome: TokenOutcome.YES, price: '0.65' },
      { id: 2, tokenId: 'token-no', outcome: TokenOutcome.NO, price: '0.35' },
    ],
    eventTitle: 'Test Event',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketsController],
      providers: [
        {
          provide: MarketsService,
          useValue: {
            getMarket: jest.fn(),
            getMarkets: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MarketsController>(MarketsController);
    service = module.get(MarketsService);
  });

  describe('getMarket', () => {
    it('should return market by id', async () => {
      service.getMarket.mockResolvedValue(mockMarketDetailResponse);

      const result = await controller.getMarket(1);

      expect(result.id).toBe(1);
      expect(result.tokens).toHaveLength(2);
      expect(result.eventTitle).toBe('Test Event');
      expect(service.getMarket).toHaveBeenCalledWith(1);
    });
  });

  describe('getMarkets', () => {
    it('should return paginated markets', async () => {
      const marketsResponse = {
        data: [mockMarketResponse],
        meta: { currentPage: 1, perPage: 20, total: 1, totalPages: 1 },
      };
      service.getMarkets.mockResolvedValue(marketsResponse);

      const result = await controller.getMarkets({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(service.getMarkets).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    });

    it('should filter by eventId', async () => {
      service.getMarkets.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await controller.getMarkets({ eventId: 1 });

      expect(service.getMarkets).toHaveBeenCalledWith({ eventId: 1 });
    });
  });
});
