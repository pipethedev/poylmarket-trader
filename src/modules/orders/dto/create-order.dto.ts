import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumberString, IsInt, Min, ValidateIf, IsIn, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderSide, OrderType, OrderOutcome } from '@database/entities/order.entity';

function IsPositiveNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPositiveNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const num = parseFloat(value);
          return !isNaN(num) && num > 0;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a positive number greater than 0`;
        },
      },
    });
  };
}

function IsValidPolymarketPrice(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPolymarketPrice',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const num = parseFloat(value);
          return !isNaN(num) && num >= 0.001 && num <= 0.999;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a number between 0.001 and 0.999 (Polymarket price range)`;
        },
      },
    });
  };
}

const OrderSideValues = Object.values(OrderSide);
const OrderTypeValues = Object.values(OrderType);
const OrderOutcomeValues = Object.values(OrderOutcome);

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
    enum: OrderSideValues,
    example: OrderSide.BUY,
  })
  @IsIn(OrderSideValues)
  side: OrderSide;

  @ApiProperty({
    description: 'Order type - MARKET or LIMIT',
    enum: OrderTypeValues,
    example: OrderType.LIMIT,
  })
  @IsIn(OrderTypeValues)
  type: OrderType;

  @ApiProperty({
    description: 'Outcome to trade - YES or NO',
    enum: OrderOutcomeValues,
    example: OrderOutcome.YES,
  })
  @IsIn(OrderOutcomeValues)
  outcome: OrderOutcome;

  @ApiPropertyOptional({
    description: 'Amount in USD to spend (for BUY orders). Either amount or quantity must be provided.',
    example: '10.00',
  })
  @IsOptional()
  @ValidateIf((o: CreateOrderDto) => o.side === OrderSide.BUY && !o.quantity)
  @IsNotEmpty({ message: 'Amount is required for BUY orders when quantity is not provided' })
  @Transform(({ value }) => (typeof value === 'number' ? value.toString() : value))
  @IsNumberString()
  @IsPositiveNumber()
  amount?: string;

  @ApiPropertyOptional({
    description: 'Quantity of tokens to trade. Required for SELL orders, or when amount is not provided for BUY orders.',
    example: '100.00000000',
  })
  @ValidateIf((o: CreateOrderDto) => o.side === OrderSide.SELL || !o.amount)
  @IsNotEmpty({ message: 'Quantity is required for SELL orders, or when amount is not provided' })
  @Transform(({ value }) => (typeof value === 'number' ? value.toString() : value))
  @IsNumberString()
  @IsPositiveNumber()
  quantity?: string;

  @ApiPropertyOptional({
    description: 'Limit price (required for LIMIT orders). Must be between 0.001 and 0.999',
    example: '0.65000000',
  })
  @ValidateIf((o: CreateOrderDto) => o.type === OrderType.LIMIT)
  @IsNotEmpty({ message: 'Price is required for LIMIT orders' })
  @Transform(({ value }) => (typeof value === 'number' ? value.toString() : value))
  @IsNumberString()
  @IsValidPolymarketPrice()
  price?: string;

  @ApiPropertyOptional({
    description: 'Wallet address of the user placing the order',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsOptional()
  @ValidateIf((o: CreateOrderDto) => o.walletAddress !== undefined)
  walletAddress?: string;

  @ApiPropertyOptional({
    description: 'Signature of the order message (required if walletAddress is provided)',
    example: '0x...',
  })
  @IsOptional()
  @ValidateIf((o: CreateOrderDto) => o.walletAddress !== undefined)
  @IsNotEmpty({ message: 'Signature is required when walletAddress is provided' })
  signature?: string;

  @ApiPropertyOptional({
    description: 'Nonce used for message signing (required if walletAddress is provided)',
    example: '1234567890',
  })
  @IsOptional()
  @ValidateIf((o: CreateOrderDto) => o.walletAddress !== undefined)
  @IsNotEmpty({ message: 'Nonce is required when walletAddress is provided' })
  nonce?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the order',
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
