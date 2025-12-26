import { SelectQueryBuilder } from 'typeorm';
import { paginate } from './paginate';

describe('paginate', () => {
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<{ id: number }>>;

  beforeEach(() => {
    mockQueryBuilder = {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<{ id: number }>>;
  });

  it('should paginate with default options', async () => {
    const mockData = [{ id: 1 }, { id: 2 }];
    mockQueryBuilder.getManyAndCount.mockResolvedValue([mockData, 100]);

    const result = await paginate(mockQueryBuilder, { page: 1, size: 20 });

    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    expect(result.data).toEqual(mockData);
    expect(result.meta).toEqual({
      currentPage: 1,
      perPage: 20,
      total: 100,
      totalPages: 5,
    });
  });

  it('should calculate correct offset for page 2', async () => {
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 50]);

    await paginate(mockQueryBuilder, { page: 2, size: 10 });

    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
  });

  it('should correctly calculate totalPages for page > 1', async () => {
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 30]);

    const result = await paginate(mockQueryBuilder, { page: 2, size: 10 });

    expect(result.meta.currentPage).toBe(2);
    expect(result.meta.totalPages).toBe(3);
  });

  it('should correctly calculate for last page', async () => {
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 20]);

    const result = await paginate(mockQueryBuilder, { page: 2, size: 10 });

    expect(result.meta.totalPages).toBe(2);
  });

  it('should handle empty results', async () => {
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    const result = await paginate(mockQueryBuilder, { page: 1, size: 10 });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(0);
  });

  it('should handle single page of results', async () => {
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[{ id: 1 }], 1]);

    const result = await paginate(mockQueryBuilder, { page: 1, size: 10 });

    expect(result.meta.totalPages).toBe(1);
  });

  it('should handle page less than 1', async () => {
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 10]);

    await paginate(mockQueryBuilder, { page: 0, size: 10 });

    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
  });

  it('should handle size less than 1', async () => {
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 10]);

    await paginate(mockQueryBuilder, { page: 1, size: 0 });

    expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
  });
});
