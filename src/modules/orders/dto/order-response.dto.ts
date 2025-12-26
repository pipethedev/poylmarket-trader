import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@common/pagination';
import {
  OrderSide,
  OrderType,
  OrderOutcome,
  OrderStatus,
} from '@database/entities/order.entity';

const OrderSideValues = [...Object.values(OrderSide)];
const OrderTypeValues = [...Object.values(OrderType)];
const OrderOutcomeValues = [...Object.values(OrderOutcome)];
const OrderStatusValues = [...Object.values(OrderStatus)];

export class OrderResponseDto {
  @ApiProperty({
    description: 'Unique order ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Idempotency key used when creating this order',
    example: 'order-123-abc',
  })
  idempotencyKey: string;

  @ApiProperty({
    description: 'Market ID this order belongs to',
    example: 1,
  })
  marketId: number;

  @ApiProperty({
    description: 'Order side',
    enum: OrderSideValues,
    example: OrderSide.BUY,
  })
  side: OrderSide;

  @ApiProperty({
    description: 'Order type',
    enum: OrderTypeValues,
    example: OrderType.LIMIT,
  })
  type: OrderType;

  @ApiProperty({
    description: 'Outcome being traded',
    enum: OrderOutcomeValues,
    example: OrderOutcome.YES,
  })
  outcome: OrderOutcome;

  @ApiProperty({
    description: 'Order quantity',
    example: '100.00000000',
  })
  quantity: string;

  @ApiPropertyOptional({
    description: 'Limit price',
    example: '0.65000000',
  })
  price?: string | null;

  @ApiProperty({
    description: 'Current order status',
    enum: OrderStatusValues,
    example: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Quantity that has been filled',
    example: '0.00000000',
  })
  filledQuantity: string;

  @ApiPropertyOptional({
    description: 'Average fill price',
    example: '0.65000000',
  })
  averageFillPrice?: string | null;

  @ApiPropertyOptional({
    description: 'External order ID from the provider',
  })
  externalOrderId?: string | null;

  @ApiPropertyOptional({
    description: 'Reason for failure if status is FAILED',
  })
  failureReason?: string | null;

  @ApiProperty({
    description: 'Order creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Order last update timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}

export class OrderListResponseDto {
  @ApiProperty({
    description: 'List of orders',
    type: [OrderResponseDto],
  })
  data: OrderResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;
}
