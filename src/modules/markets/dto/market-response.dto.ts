import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination';

export class TokenResponseDto {
  @ApiProperty({
    description: 'Token ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'External token ID',
    example: '0x1234567890abcdef',
  })
  tokenId: string;

  @ApiProperty({
    description: 'Token outcome',
    example: 'YES',
    enum: ['YES', 'NO'],
  })
  outcome: string;

  @ApiProperty({
    description: 'Current token price',
    example: '0.65000000',
  })
  price: string;
}

export class MarketResponseDto {
  @ApiProperty({
    description: 'Market ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'External market ID',
    example: '0x1234567890',
  })
  externalId: string;

  @ApiPropertyOptional({
    description: 'Condition ID',
    example: '0xabcdef1234567890',
  })
  conditionId?: string | null;

  @ApiProperty({
    description: 'Event ID this market belongs to',
    example: 1,
  })
  eventId: number;

  @ApiProperty({
    description: 'Market question',
    example: 'Will Bitcoin reach $100k by end of 2024?',
  })
  question: string;

  @ApiPropertyOptional({
    description: 'Market description',
  })
  description?: string | null;

  @ApiProperty({
    description: 'YES outcome price',
    example: '0.65000000',
  })
  outcomeYesPrice: string;

  @ApiProperty({
    description: 'NO outcome price',
    example: '0.35000000',
  })
  outcomeNoPrice: string;

  @ApiPropertyOptional({
    description: 'Total market volume',
    example: '1000000.00',
  })
  volume?: string | null;

  @ApiPropertyOptional({
    description: 'Market liquidity',
    example: '50000.00',
  })
  liquidity?: string | null;

  @ApiProperty({
    description: 'Whether the market is active',
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description: 'Whether the market is closed',
    example: false,
  })
  closed: boolean;

  @ApiProperty({
    description: 'Market creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Market last update timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}

export class MarketDetailResponseDto extends MarketResponseDto {
  @ApiPropertyOptional({
    description: 'Tokens for this market',
    type: [TokenResponseDto],
  })
  tokens?: TokenResponseDto[];

  @ApiPropertyOptional({
    description: 'Event title',
    example: 'Bitcoin Price Predictions 2024',
  })
  eventTitle?: string;

  @ApiPropertyOptional({
    description: 'Event details',
    type: Object,
  })
  event?: {
    id: number;
    title: string;
    slug: string | null;
    description: string | null;
    active: boolean;
    startDate: Date | null;
    endDate: Date | null;
  };
}

export class MarketListResponseDto {
  @ApiProperty({
    description: 'List of markets',
    type: [MarketResponseDto],
  })
  data: MarketResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;
}
