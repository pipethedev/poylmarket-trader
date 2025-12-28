import { Order, OrderStatus } from '@database/entities/order.entity';
import { CreateOrderDto } from '@modules/orders/dto/create-order.dto';
import { OrderResponseDto } from '@modules/orders/dto/order-response.dto';

export interface CreateOrderParams {
  dto: CreateOrderDto;
  idempotencyKey: string;
  userWalletAddress?: string | null;
}

export class OrderFactory {
  static create(params: CreateOrderParams): Partial<Order> {
    const { dto, idempotencyKey, userWalletAddress } = params;

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
      userWalletAddress: userWalletAddress ?? null,
      metadata: dto.metadata,
    };
  }

  static toResponse(order: Order): OrderResponseDto {
    return {
      id: order.id,
      status: order.status,
      filledQuantity: order.filledQuantity,
      averageFillPrice: order.averageFillPrice,
      failureReason: order.failureReason,
      createdAt: order.createdAt,
    };
  }
}
