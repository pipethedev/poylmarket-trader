import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrderStatus, OrderSide, OrderOutcome } from '@database/entities/order.entity';

const OrderStatusValues = Object.values(OrderStatus);
const OrderSideValues = Object.values(OrderSide);
const OrderOutcomeValues = Object.values(OrderOutcome);

export class QueryOrdersDto {
  @ApiPropertyOptional({
    description: 'Filter by market ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  marketId?: number;

  @ApiPropertyOptional({
    description: 'Filter by order status',
    enum: OrderStatusValues,
    example: OrderStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Filter by order side',
    enum: OrderSideValues,
    example: OrderSide.BUY,
  })
  @IsOptional()
  @IsEnum(OrderSide)
  side?: OrderSide;

  @ApiPropertyOptional({
    description: 'Filter by outcome',
    enum: OrderOutcomeValues,
    example: OrderOutcome.YES,
  })
  @IsOptional()
  @IsEnum(OrderOutcome)
  outcome?: OrderOutcome;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num) || num < 1) return 20;
    return Math.min(num, 100);
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of items per page (alias for pageSize)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num) || num < 1) return 20;
    return Math.min(num, 100);
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
