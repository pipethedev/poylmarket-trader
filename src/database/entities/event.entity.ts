import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Market } from './market.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'polymarket_id', unique: true })
  @Index('idx_events_polymarket_id')
  polymarketId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  slug: string | null;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  @Index('idx_events_start_date')
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  @Index('idx_events_end_date')
  endDate: Date | null;

  @Column({ default: true })
  @Index('idx_events_active')
  active: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Market, (market) => market.event)
  markets: Market[];
}
