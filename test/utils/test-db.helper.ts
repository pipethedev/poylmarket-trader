import { DataSource } from 'typeorm';

export class TestDbHelper {
  constructor(private readonly dataSource: DataSource) {}

  async cleanDatabase(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query('SET session_replication_role = replica;');

      const tables = await queryRunner.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename != 'migrations'
      `);

      for (const table of tables) {
        await queryRunner.query(`TRUNCATE TABLE "${table.tablename}" CASCADE;`);
      }

      await queryRunner.query('SET session_replication_role = DEFAULT;');
    } finally {
      await queryRunner.release();
    }
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work();
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
