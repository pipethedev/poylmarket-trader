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
      userWalletAddress: order.userWalletAddress,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
