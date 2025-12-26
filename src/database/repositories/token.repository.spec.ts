import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenRepository } from './token.repository';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import { Market } from '@database/entities/market.entity';

describe('TokenRepository', () => {
  let tokenRepository: TokenRepository;
  let repository: jest.Mocked<Repository<Token>>;

  const mockToken: Token = {
    id: 1,
    tokenId: 'token-123',
    marketId: 1,
    outcome: TokenOutcome.YES,
    price: '0.65',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    market: {} as Market,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenRepository,
        {
          provide: getRepositoryToken(Token),
          useValue: {
            findOneBy: jest.fn(),
            findBy: jest.fn(),
            update: jest.fn(),
            manager: {},
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    tokenRepository = module.get<TokenRepository>(TokenRepository);
    repository = module.get(getRepositoryToken(Token));
  });

  describe('findByTokenId', () => {
    it('should find token by token id', async () => {
      repository.findOneBy.mockResolvedValue(mockToken);

      const result = await tokenRepository.findByTokenId('token-123');

      expect(result).toEqual(mockToken);
      expect(repository.findOneBy).toHaveBeenCalledWith({ tokenId: 'token-123' });
    });

    it('should return null if not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await tokenRepository.findByTokenId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByMarketId', () => {
    it('should find tokens by market id', async () => {
      const noToken = {
        ...mockToken,
        id: 2,
        tokenId: 'token-no',
        outcome: TokenOutcome.NO,
        price: '0.35',
      };
      repository.findBy.mockResolvedValue([mockToken, noToken]);

      const result = await tokenRepository.findByMarketId(1);

      expect(result).toHaveLength(2);
      expect(repository.findBy).toHaveBeenCalledWith({ marketId: 1 });
    });
  });

  describe('updatePriceByMarketIdAndOutcome', () => {
    it('should update token price by market id and outcome', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as never);

      await tokenRepository.updatePriceByMarketIdAndOutcome(1, TokenOutcome.YES, '0.70');

      expect(repository.update).toHaveBeenCalledWith(
        { marketId: 1, outcome: TokenOutcome.YES },
        { price: '0.70' },
      );
    });
  });
});
