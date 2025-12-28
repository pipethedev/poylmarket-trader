import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@common/pagination';
import { OrderStatus } from '@database/entities/order.entity';

const OrderStatusValues = [...Object.values(OrderStatus)];

export class OrderResponseDto {
  @ApiProperty({
    description: 'Unique order ID',
    example: 1,
  })
  id: number;

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
    description: 'Average fill price (available after order is filled)',
    example: '0.65000000',
  })
  averageFillPrice?: string | null;

  @ApiPropertyOptional({
    description: 'Reason for failure if status is FAILED',
  })
  failureReason?: string | null;

  @ApiProperty({
    description: 'Order creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;
}

export class OrderStatsDto {
  @ApiProperty({
    description: 'Total number of orders in the database',
    example: 150,
  })
  totalOrders: number;

  @ApiProperty({
    description: 'Number of open orders on CLOB (requires real trading)',
    example: 5,
  })
  openOrders: number;

  @ApiProperty({
    description: 'Number of trades executed (requires real trading)',
    example: 45,
  })
  trades: number;
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

  @ApiPropertyOptional({
    description: 'Order statistics (only available when real trading is enabled)',
    type: OrderStatsDto,
  })
  stats?: OrderStatsDto;
}
