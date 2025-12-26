import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination';

export class EventResponseDto {
  @ApiProperty({
    description: 'Unique event ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'External event ID',
    example: '0x1234567890',
  })
  externalId: string;

  @ApiProperty({
    description: 'Event title',
    example: 'Will Bitcoin reach $100k by end of 2024?',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Event description',
    example: 'This market resolves YES if Bitcoin price reaches $100,000 USD...',
  })
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Event slug',
    example: 'bitcoin-100k-2024',
  })
  slug?: string | null;

  @ApiPropertyOptional({
    description: 'Event start date',
    example: '2024-01-01T00:00:00.000Z',
  })
  startDate?: Date | null;

  @ApiPropertyOptional({
    description: 'Event end date',
    example: '2024-12-31T23:59:59.000Z',
  })
  endDate?: Date | null;

  @ApiProperty({
    description: 'Whether the event is active',
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description: 'Event creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Event last update timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Number of markets in this event',
    example: 3,
  })
  marketCount?: number;
}

export class EventListResponseDto {
  @ApiProperty({
    description: 'List of events',
    type: [EventResponseDto],
  })
  data: EventResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;
}

export class EventDetailResponseDto extends EventResponseDto {
  @ApiPropertyOptional({
    description: 'Markets belonging to this event',
  })
  markets?: MarketSummaryDto[];
}

export class MarketSummaryDto {
  @ApiProperty({
    description: 'Market ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Market question',
    example: 'Will Bitcoin reach $100k?',
  })
  question: string;

  @ApiProperty({
    description: 'YES outcome price',
    example: '0.65',
  })
  outcomeYesPrice: string;

  @ApiProperty({
    description: 'NO outcome price',
    example: '0.35',
  })
  outcomeNoPrice: string;

  @ApiProperty({
    description: 'Whether the market is active',
    example: true,
  })
  active: boolean;

  @ApiPropertyOptional({
    description: 'Tokens for this market',
    type: Array,
  })
  tokens?: Array<{
    id: number;
    tokenId: string;
    outcome: string;
    price: string;
  }>;
}
