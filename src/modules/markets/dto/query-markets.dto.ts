import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsInt, Min, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Search by question',
    example: 'Bitcoin',
  })
  @IsOptional()
  @IsString()
  search?: string;

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
