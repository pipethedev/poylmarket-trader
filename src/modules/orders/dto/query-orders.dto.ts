import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, OrderSide, OrderOutcome } from '../../../database/entities/order.entity';

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
    enum: ['PENDING', 'QUEUED', 'PROCESSING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'FAILED'],
    example: 'PENDING',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Filter by order side',
    enum: ['BUY', 'SELL'],
    example: 'BUY',
  })
  @IsOptional()
  @IsEnum(OrderSide)
  side?: OrderSide;

  @ApiPropertyOptional({
    description: 'Filter by outcome',
    enum: ['YES', 'NO'],
    example: 'YES',
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
