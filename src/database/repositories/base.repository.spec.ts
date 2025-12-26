import { Repository, EntityManager, SelectQueryBuilder, QueryRunner } from 'typeorm';
import { BaseRepository, EntityWithId } from './base.repository';

interface TestEntity extends EntityWithId {
  id: number;
  name: string;
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor(repository: Repository<TestEntity>) {
    super(repository);
  }
}

describe('BaseRepository', () => {
  let repository: jest.Mocked<Repository<TestEntity>>;
  let baseRepository: TestRepository;

  beforeEach(() => {
    repository = {
      manager: {} as EntityManager,
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      findBy: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      existsBy: jest.fn(),
      target: class TestEntity {},
    } as unknown as jest.Mocked<Repository<TestEntity>>;

    baseRepository = new TestRepository(repository);
  });

  describe('manager', () => {
    it('should return entity manager', () => {
      expect(baseRepository.manager).toBe(repository.manager);
    });
  });

  describe('createQueryBuilder', () => {
    it('should create query builder', () => {
      const mockQueryBuilder = {} as SelectQueryBuilder<TestEntity>;
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = baseRepository.createQueryBuilder('test');

      expect(result).toBe(mockQueryBuilder);
      expect(repository.createQueryBuilder).toHaveBeenCalledWith('test');
    });
  });

  describe('findById', () => {
    it('should find entity by id', async () => {
      const entity = { id: 1, name: 'Test' };
      repository.findOne.mockResolvedValue(entity);

      const result = await baseRepository.findById(1);

      expect(result).toEqual(entity);
    });

    it('should return null if not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await baseRepository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should find one entity with options', async () => {
      const entity = { id: 1, name: 'Test' };
      repository.findOne.mockResolvedValue(entity);

      const result = await baseRepository.findOne({ where: { id: 1 } });

      expect(result).toEqual(entity);
    });
  });

  describe('findMany', () => {
    it('should find many entities', async () => {
      const entities = [
        { id: 1, name: 'Test1' },
        { id: 2, name: 'Test2' },
      ];
      repository.find.mockResolvedValue(entities);

      const result = await baseRepository.findMany();

      expect(result).toEqual(entities);
    });
  });

  describe('findAndCount', () => {
    it('should find and count entities', async () => {
      const entities = [{ id: 1, name: 'Test' }];
      repository.findAndCount.mockResolvedValue([entities, 1]);

      const result = await baseRepository.findAndCount();

      expect(result).toEqual([entities, 1]);
    });
  });

  describe('create', () => {
    it('should create and save entity', async () => {
      const data = { name: 'New Entity' };
      const createdEntity = { id: 1, name: 'New Entity' };
      repository.create.mockReturnValue(createdEntity);
      repository.save.mockResolvedValue(createdEntity);

      const result = await baseRepository.create(data);

      expect(result).toEqual(createdEntity);
      expect(repository.create).toHaveBeenCalledWith(data);
      expect(repository.save).toHaveBeenCalledWith(createdEntity);
    });
  });

  describe('createMany', () => {
    it('should create and save multiple entities', async () => {
      const data = [{ name: 'Entity1' }, { name: 'Entity2' }];
      const createdEntities = [
        { id: 1, name: 'Entity1' },
        { id: 2, name: 'Entity2' },
      ];
      repository.create.mockReturnValue(createdEntities);
      repository.save.mockResolvedValue(createdEntities);

      const result = await baseRepository.createMany(data);

      expect(result).toEqual(createdEntities);
    });
  });

  describe('update', () => {
    it('should update entity and return updated', async () => {
      const updatedEntity = { id: 1, name: 'Updated' };
      repository.update.mockResolvedValue({ affected: 1 } as never);
      repository.findOne.mockResolvedValue(updatedEntity);

      const result = await baseRepository.update(1, { name: 'Updated' });

      expect(result).toEqual(updatedEntity);
    });
  });

  describe('save', () => {
    it('should save entity', async () => {
      const entity = { id: 1, name: 'Test' };
      repository.save.mockResolvedValue(entity);

      const result = await baseRepository.save(entity);

      expect(result).toEqual(entity);
    });
  });

  describe('delete', () => {
    it('should delete entity and return true', async () => {
      repository.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await baseRepository.delete(1);

      expect(result).toBe(true);
    });

    it('should return false if nothing deleted', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: {} });

      const result = await baseRepository.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should count entities', async () => {
      repository.count.mockResolvedValue(5);

      const result = await baseRepository.count();

      expect(result).toBe(5);
    });
  });

  describe('exists', () => {
    it('should return true if entity exists', async () => {
      repository.existsBy.mockResolvedValue(true);

      const result = await baseRepository.exists({ id: 1 });

      expect(result).toBe(true);
    });

    it('should return false if entity does not exist', async () => {
      repository.existsBy.mockResolvedValue(false);

      const result = await baseRepository.exists({ id: 999 });

      expect(result).toBe(false);
    });
  });

  describe('withQueryRunner', () => {
    it('should return repository from query runner', () => {
      const mockQueryRunner = {
        manager: {
          getRepository: jest.fn().mockReturnValue(repository),
        },
      } as unknown as QueryRunner;

      const result = baseRepository.withQueryRunner(mockQueryRunner);

      expect(result).toBe(repository);
    });
  });
});

