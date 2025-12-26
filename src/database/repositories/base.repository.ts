import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  FindOneOptions,
  DeepPartial,
  ObjectLiteral,
  SelectQueryBuilder,
  EntityManager,
  QueryRunner,
} from 'typeorm';
import { paginate, PaginatedResult, PaginationOptions } from '@common/pagination/index';

export interface EntityWithId extends ObjectLiteral {
  id: number;
}

export abstract class BaseRepository<T extends EntityWithId> {
  constructor(protected readonly repository: Repository<T>) {}

  get manager(): EntityManager {
    return this.repository.manager;
  }

  createQueryBuilder(alias?: string): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias);
  }

  async findById(id: number): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  async findOneBy(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.repository.findOneBy(where);
  }

  async findMany(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  async findManyBy(where: FindOptionsWhere<T>): Promise<T[]> {
    return this.repository.findBy(where);
  }

  async findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return this.repository.findAndCount(options);
  }

  async paginate(
    queryBuilder: SelectQueryBuilder<T>,
    options: PaginationOptions,
  ): Promise<PaginatedResult<T>> {
    return paginate(queryBuilder, options);
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async createMany(data: DeepPartial<T>[]): Promise<T[]> {
    const entities = this.repository.create(data);
    return this.repository.save(entities);
  }

  async update(id: number, data: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id, data as never);
    return this.findById(id);
  }

  async updateBy(where: FindOptionsWhere<T>, data: DeepPartial<T>): Promise<void> {
    await this.repository.update(where, data as never);
  }

  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }

  async saveMany(entities: T[]): Promise<T[]> {
    return this.repository.save(entities);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async deleteBy(where: FindOptionsWhere<T>): Promise<number> {
    const result = await this.repository.delete(where);
    return result.affected ?? 0;
  }

  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({ where });
  }

  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    return this.repository.existsBy(where);
  }

  withQueryRunner(queryRunner: QueryRunner): Repository<T> {
    return queryRunner.manager.getRepository(this.repository.target as new () => T);
  }
}
