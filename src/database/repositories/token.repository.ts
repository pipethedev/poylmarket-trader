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
}
