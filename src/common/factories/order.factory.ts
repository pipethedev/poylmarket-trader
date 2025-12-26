import { Order, OrderStatus } from '@database/entities/order.entity';
import { CreateOrderDto } from '@modules/orders/dto/create-order.dto';
import { OrderResponseDto } from '@modules/orders/dto/order-response.dto';

export interface CreateOrderParams {
  dto: CreateOrderDto;
  idempotencyKey: string;
}

export class OrderFactory {
  static create(params: CreateOrderParams): Partial<Order> {
    const { dto, idempotencyKey } = params;

    return {
      idempotencyKey,
      marketId: dto.marketId,
      side: dto.side,
      type: dto.type,
      outcome: dto.outcome,
      quantity: dto.quantity,
      price: dto.price,
      status: OrderStatus.PENDING,
      filledQuantity: '0',
      metadata: dto.metadata,
    };
  }

  static toResponse(order: Order): OrderResponseDto {
    return {
      id: order.id,
      idempotencyKey: order.idempotencyKey,
      marketId: order.marketId,
      side: order.side,
      type: order.type,
      outcome: order.outcome,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      filledQuantity: order.filledQuantity,
      averageFillPrice: order.averageFillPrice,
      externalOrderId: order.externalOrderId,
      failureReason: order.failureReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
