import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import { BaseRepository } from './base.repository';

@Injectable()
export class TokenRepository extends BaseRepository<Token> {
  constructor(
    @InjectRepository(Token)
    repository: Repository<Token>,
  ) {
    super(repository);
  }

  async findByTokenId(tokenId: string): Promise<Token | null> {
    return this.findOneBy({ tokenId });
  }

  async findByMarketId(marketId: number): Promise<Token[]> {
    return this.findManyBy({ marketId });
  }

  async findByMarketIds(marketIds: number[]): Promise<Token[]> {
    if (marketIds.length === 0) return [];
    return this.createQueryBuilder('token')
      .where('token.market_id IN (:...marketIds)', { marketIds })
      .getMany();
  }

  async findByMarketIdAndOutcome(marketId: number, outcome: TokenOutcome): Promise<Token | null> {
    return this.findOneBy({ marketId, outcome });
  }

  async updatePriceByMarketIdAndOutcome(
    marketId: number,
    outcome: TokenOutcome,
    price: string,
  ): Promise<void> {
    await this.updateBy({ marketId, outcome }, { price });
  }

  async findTokenIdsByMarketIds(marketIds: number[]): Promise<Map<number, string[]>> {
    if (marketIds.length === 0) return new Map();

    const tokens = await this.createQueryBuilder('token')
      .where('token.market_id IN (:...marketIds)', { marketIds })
      .getMany();

    const tokenMap = new Map<number, string[]>();
    for (const token of tokens) {
      const existing = tokenMap.get(token.marketId) || [];
      existing.push(token.tokenId);
      tokenMap.set(token.marketId, existing);
    }

    return tokenMap;
  }
}
