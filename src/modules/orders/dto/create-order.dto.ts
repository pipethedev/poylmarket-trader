import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumberString, IsInt, Min, ValidateIf, IsIn, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Type } from 'class-transformer';
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

  @ApiProperty({
    description: 'Quantity of tokens to trade',
    example: '100.00000000',
  })
  @IsNumberString()
  @IsPositiveNumber()
  @IsNotEmpty()
  quantity: string;

  @ApiPropertyOptional({
    description: 'Limit price (required for LIMIT orders)',
    example: '0.65000000',
  })
  @ValidateIf((o: CreateOrderDto) => o.type === OrderType.LIMIT)
  @IsNotEmpty({ message: 'Price is required for LIMIT orders' })
  @IsNumberString()
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
