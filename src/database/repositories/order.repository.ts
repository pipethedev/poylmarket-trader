import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '@database/entities/order.entity';
import { BaseRepository } from './base.repository';

@Injectable()
export class OrderRepository extends BaseRepository<Order> {
  constructor(
    @InjectRepository(Order)
    repository: Repository<Order>,
  ) {
    super(repository);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Order | null> {
    return this.findOneBy({ idempotencyKey });
  }

  async findByMarketId(marketId: number): Promise<Order[]> {
    return this.findManyBy({ marketId });
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return this.findManyBy({ status });
  }

  async findPendingOrders(): Promise<Order[]> {
    return this.findMany({
      where: [{ status: OrderStatus.PENDING }, { status: OrderStatus.QUEUED }],
      order: { createdAt: 'ASC' },
    });
  }

  async updateStatus(id: number, status: OrderStatus): Promise<void> {
    await this.updateBy({ id } as never, { status });
  }

  async markAsFailed(id: number, reason: string): Promise<void> {
    await this.updateBy({ id } as never, {
      status: OrderStatus.FAILED,
      failureReason: reason,
    });
  }

  async markAsFilled(id: number, filledQuantity: string, averageFillPrice: string, externalOrderId?: string): Promise<void> {
    await this.updateBy({ id } as never, {
      status: OrderStatus.FILLED,
      filledQuantity,
      averageFillPrice,
      externalOrderId,
    });
  }
}
