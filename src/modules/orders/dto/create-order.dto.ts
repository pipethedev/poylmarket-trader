import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsInt,
  Min,
  ValidateIf,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderSide, OrderType, OrderOutcome } from '@database/entities/order.entity';

export class CreateOrderDto {
  @ApiProperty({
    description: 'The ID of the market to place the order on',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  marketId: number;

  @ApiProperty({
    description: 'Order side - BUY or SELL',
    enum: ['BUY', 'SELL'],
    example: OrderSide.BUY,
  })
  @IsIn(['BUY', 'SELL'])
  side: OrderSide;

  @ApiProperty({
    description: 'Order type - MARKET or LIMIT',
    enum: ['MARKET', 'LIMIT'],
    example: OrderType.LIMIT,
  })
  @IsIn(['MARKET', 'LIMIT'])
  type: OrderType;

  @ApiProperty({
    description: 'Outcome to trade - YES or NO',
    enum: ['YES', 'NO'],
    example: OrderOutcome.YES,
  })
  @IsIn(['YES', 'NO'])
  outcome: OrderOutcome;

  @ApiProperty({
    description: 'Quantity of tokens to trade',
    example: '100.00000000',
  })
  @IsNumberString()
  @IsNotEmpty()
  quantity: string;

  @ApiPropertyOptional({
    description: 'Limit price (required for LIMIT orders)',
    example: '0.65000000',
  })
  @ValidateIf((o: CreateOrderDto) => o.type === OrderType.LIMIT)
  @IsNumberString()
  @IsNotEmpty({ message: 'Price is required for LIMIT orders' })
  price?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the order',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
