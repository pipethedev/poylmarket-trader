import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Event } from './event.entity';
import { Token } from './token.entity';
import { Order } from './order.entity';

@Entity('markets')
@Index('idx_markets_event_active', ['eventId', 'active'])
export class Market {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'polymarket_id', unique: true })
  @Index('idx_markets_polymarket_id')
  polymarketId: string;

  @Column({ name: 'condition_id', type: 'varchar', nullable: true })
  @Index('idx_markets_condition_id')
  conditionId: string | null;

  @Column({ name: 'event_id' })
  @Index('idx_markets_event_id')
  eventId: number;

  @Column()
  question: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'outcome_yes_price',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  outcomeYesPrice: string;

  @Column({
    name: 'outcome_no_price',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  outcomeNoPrice: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  volume: string | null;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  liquidity: string | null;

  @Column({ default: true })
  @Index('idx_markets_active')
  active: boolean;

  @Column({ default: false })
  closed: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Event, (event) => event.markets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @OneToMany(() => Token, (token) => token.market)
  tokens: Token[];

  @OneToMany(() => Order, (order) => order.market)
  orders: Order[];
}
