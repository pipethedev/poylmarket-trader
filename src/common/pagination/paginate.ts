import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import type { PaginationOptions, PaginatedResult, PaginationMeta } from './interfaces';

export async function paginate<T extends ObjectLiteral>(queryBuilder: SelectQueryBuilder<T>, options: PaginationOptions): Promise<PaginatedResult<T>> {
  const { page, size } = resolveOptions(options);
  const offset = (page - 1) * size;

  const [items, total] = await queryBuilder.skip(offset).take(size).getManyAndCount();

  return createPaginationResult(items, total, page, size);
}

function createPaginationResult<T>(items: T[], totalItems: number, page: number, limit: number): PaginatedResult<T> {
  const totalPages = Math.ceil(totalItems / limit);

  const meta: PaginationMeta = {
    total: totalItems,
    perPage: limit,
    currentPage: page,
    totalPages,
  };

  return { data: items, meta };
}

function resolveOptions(options: PaginationOptions): {
  page: number;
  size: number;
} {
  const page = options.page < 1 ? 1 : options.page;
  const size = options.size < 1 ? 20 : options.size;

  return { page, size };
}
