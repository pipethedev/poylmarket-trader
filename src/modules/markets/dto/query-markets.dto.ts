import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsString,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

function normalizeBoolean(value: unknown): boolean | undefined {
  if (value === 'true' || value === true || value === 1 || value === '1') return true;
  if (value === 'false' || value === false || value === 0 || value === '0') return false;
  return undefined;
}

export class QueryMarketsDto {
  @ApiPropertyOptional({
    description: 'Filter by event ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId?: number;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by closed status',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  closed?: boolean;

  @ApiPropertyOptional({
    description: 'Search by question',
    example: 'Bitcoin',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Minimum volume',
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumeMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum volume',
    example: 1000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumeMax?: number;

  @ApiPropertyOptional({
    description: 'Minimum liquidity',
    example: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liquidityMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum liquidity',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liquidityMax?: number;

  @ApiPropertyOptional({
    description: 'Minimum creation date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtMin?: string;

  @ApiPropertyOptional({
    description: 'Maximum creation date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  createdAtMax?: string;

  @ApiPropertyOptional({
    description: 'Minimum update date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  updatedAtMin?: string;

  @ApiPropertyOptional({
    description: 'Maximum update date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  updatedAtMax?: string;

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
