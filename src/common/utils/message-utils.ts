import { CreateOrderDto } from '@modules/orders/dto/create-order.dto';

export function createOrderMessage(orderParams: CreateOrderDto, nonce: string): string {
  const messageData: Record<string, unknown> = {
    marketId: orderParams.marketId,
    side: orderParams.side,
    type: orderParams.type,
    outcome: orderParams.outcome,
    nonce,
  };

  if (orderParams.amount !== undefined) {
    const amountValue = orderParams.amount;
    messageData.amount = typeof amountValue === 'number' ? String(amountValue) : amountValue;
  } else if (orderParams.quantity !== undefined) {
    const quantityValue = orderParams.quantity;
    messageData.quantity = typeof quantityValue === 'number' ? String(quantityValue) : quantityValue;
  }

  if (orderParams.price !== undefined) {
    const priceValue = orderParams.price;
    messageData.price = typeof priceValue === 'number' ? String(priceValue) : priceValue;
  }

  return JSON.stringify(messageData);
}
