import { CreateOrderDto } from '@modules/orders/dto/create-order.dto';

export function createOrderMessage(orderParams: CreateOrderDto, nonce: string): string {
  const messageData = {
    marketId: orderParams.marketId,
    side: orderParams.side,
    type: orderParams.type,
    outcome: orderParams.outcome,
    quantity: orderParams.quantity,
    price: orderParams.price,
    nonce,
  };

  return JSON.stringify(messageData);
}
