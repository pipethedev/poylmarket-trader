import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { Market } from './market.entity';

export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;

export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

export const OrderType = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
} as const;

export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderOutcome = {
  YES: 'YES',
  NO: 'NO',
} as const;

export type OrderOutcome = (typeof OrderOutcome)[keyof typeof OrderOutcome];

export const OrderStatus = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  FILLED: 'FILLED',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

@Entity('orders')
@Index('idx_orders_market_status', ['marketId', 'status'])
@Index('idx_orders_status_created', ['status', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'idempotency_key', unique: true })
  @Index('idx_orders_idempotency_key')
  idempotencyKey: string;

  @Column({ name: 'market_id' })
  @Index('idx_orders_market_id')
  marketId: number;

  @Column({ length: 10 })
  side: OrderSide;

  @Column({ length: 10 })
  type: OrderType;

  @Column({ length: 10 })
  outcome: OrderOutcome;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
  })
  quantity: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  price: string | null;

  @Column({ length: 20, default: OrderStatus.PENDING })
  @Index('idx_orders_status')
  status: OrderStatus;

  @Column({
    name: 'filled_quantity',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: '0',
  })
  filledQuantity: string;

  @Column({
    name: 'average_fill_price',
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  averageFillPrice: string | null;

  @Column({ name: 'external_order_id', type: 'varchar', nullable: true })
  externalOrderId: string | null;

  @Column({ name: 'user_wallet_address', type: 'varchar', nullable: true })
  @Index('idx_orders_user_wallet_address')
  userWalletAddress: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_orders_created_at')
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Market, (market) => market.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'market_id' })
  market: Market;
}
