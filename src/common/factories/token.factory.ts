import { Token, TokenOutcome } from '@database/entities/token.entity';
import type { ProviderToken } from '@app-types/index';

export class TokenFactory {
  static create(data: ProviderToken, marketId: number): Partial<Token> {
    return {
      tokenId: data.tokenId,
      marketId,
      outcome: data.outcome === 'YES' ? TokenOutcome.YES : TokenOutcome.NO,
      price: data.price,
    };
  }

  static update(entity: Token, data: ProviderToken): Token {
    entity.price = data.price;
    return entity;
  }
}
