import { TokenFactory } from './token.factory';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import type { ProviderToken } from '@app-types/index';

describe('TokenFactory', () => {
  describe('create', () => {
    it('should create YES token data from provider token', () => {
      const providerToken: ProviderToken = {
        tokenId: 'token-yes-123',
        outcome: 'YES',
        price: '0.65',
      };

      const result = TokenFactory.create(providerToken, 1);

      expect(result.tokenId).toBe('token-yes-123');
      expect(result.marketId).toBe(1);
      expect(result.outcome).toBe(TokenOutcome.YES);
      expect(result.price).toBe('0.65');
    });

    it('should create NO token data from provider token', () => {
      const providerToken: ProviderToken = {
        tokenId: 'token-no-456',
        outcome: 'NO',
        price: '0.35',
      };

      const result = TokenFactory.create(providerToken, 2);

      expect(result.tokenId).toBe('token-no-456');
      expect(result.marketId).toBe(2);
      expect(result.outcome).toBe(TokenOutcome.NO);
      expect(result.price).toBe('0.35');
    });
  });

  describe('update', () => {
    it('should update existing token with new price', () => {
      const existingToken = new Token();
      existingToken.id = 1;
      existingToken.tokenId = 'token-123';
      existingToken.price = '0.50';

      const providerToken: ProviderToken = {
        tokenId: 'token-123',
        outcome: 'YES',
        price: '0.75',
      };

      const result = TokenFactory.update(existingToken, providerToken);

      expect(result.id).toBe(1);
      expect(result.price).toBe('0.75');
    });
  });
});
