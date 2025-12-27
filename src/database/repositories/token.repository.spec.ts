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

      expect(repository.update).toHaveBeenCalledWith({ marketId: 1, outcome: TokenOutcome.YES }, { price: '0.70' });
    });
  });

  describe('findByMarketIds', () => {
    it('should return empty array when no market ids provided', async () => {
      const result = await tokenRepository.findByMarketIds([]);

      expect(result).toEqual([]);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should find tokens by multiple market ids', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockToken]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await tokenRepository.findByMarketIds([1, 2, 3]);

      expect(result).toEqual([mockToken]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('token.market_id IN (:...marketIds)', {
        marketIds: [1, 2, 3],
      });
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
    });

    it('should handle single market id', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockToken]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await tokenRepository.findByMarketIds([1]);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('token.market_id IN (:...marketIds)', {
        marketIds: [1],
      });
    });
  });

  describe('findByMarketIdAndOutcome', () => {
    it('should find token by market id and YES outcome', async () => {
      repository.findOneBy.mockResolvedValue(mockToken);

      const result = await tokenRepository.findByMarketIdAndOutcome(1, TokenOutcome.YES);

      expect(result).toEqual(mockToken);
      expect(repository.findOneBy).toHaveBeenCalledWith({ marketId: 1, outcome: TokenOutcome.YES });
    });

    it('should find token by market id and NO outcome', async () => {
      const noToken = { ...mockToken, outcome: TokenOutcome.NO };
      repository.findOneBy.mockResolvedValue(noToken);

      const result = await tokenRepository.findByMarketIdAndOutcome(1, TokenOutcome.NO);

      expect(result).toEqual(noToken);
      expect(repository.findOneBy).toHaveBeenCalledWith({ marketId: 1, outcome: TokenOutcome.NO });
    });

    it('should return null if not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await tokenRepository.findByMarketIdAndOutcome(999, TokenOutcome.YES);

      expect(result).toBeNull();
    });
  });

  describe('findTokenIdsByMarketIds', () => {
    it('should return empty map when no market ids provided', async () => {
      const result = await tokenRepository.findTokenIdsByMarketIds([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should group token ids by market id', async () => {
      const token1 = { ...mockToken, marketId: 1, tokenId: 'token-1' };
      const token2 = { ...mockToken, marketId: 1, tokenId: 'token-2' };
      const token3 = { ...mockToken, marketId: 2, tokenId: 'token-3' };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([token1, token2, token3]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await tokenRepository.findTokenIdsByMarketIds([1, 2]);

      expect(result).toBeInstanceOf(Map);
      expect(result.get(1)).toEqual(['token-1', 'token-2']);
      expect(result.get(2)).toEqual(['token-3']);
    });

    it('should handle single market with multiple tokens', async () => {
      const token1 = { ...mockToken, marketId: 5, tokenId: 'token-a' };
      const token2 = { ...mockToken, marketId: 5, tokenId: 'token-b' };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([token1, token2]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await tokenRepository.findTokenIdsByMarketIds([5]);

      expect(result.get(5)).toEqual(['token-a', 'token-b']);
    });

    it('should handle markets with no tokens', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await tokenRepository.findTokenIdsByMarketIds([1, 2, 3]);

      expect(result.size).toBe(0);
    });
  });
});
