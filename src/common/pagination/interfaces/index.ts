import { ApiProperty } from '@nestjs/swagger';

export type PaginationOptions = {
  page: number;
  size: number;
};

export type PaginationMeta = {
  total: number;
  perPage: number;
  currentPage: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ description: 'Total number of items', example: 100 })
  total: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  perPage: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  currentPage: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;
}
