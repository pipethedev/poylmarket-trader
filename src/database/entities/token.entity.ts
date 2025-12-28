import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Market } from './market.entity';

export const TokenOutcome = {
  YES: 'YES',
  NO: 'NO',
} as const;

export type TokenOutcome = (typeof TokenOutcome)[keyof typeof TokenOutcome];

@Entity('tokens')
@Index('idx_tokens_market_outcome', ['marketId', 'outcome'])
export class Token {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'token_id', unique: true })
  @Index('idx_tokens_token_id')
  tokenId: string;

  @Column({ name: 'market_id' })
  @Index('idx_tokens_market_id')
  marketId: number;

  @Column({ length: 10 })
  outcome: TokenOutcome;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  price: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Market, (market) => market.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'market_id' })
  market: Market;
}
