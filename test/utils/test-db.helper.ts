import { DataSource } from 'typeorm';

export class TestDbHelper {
  constructor(private readonly dataSource: DataSource) {}

  async cleanDatabase(): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        }

        await queryRunner.query('SET session_replication_role = replica;');

        const tables = await queryRunner.query(`
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename != 'migrations'
          ORDER BY tablename
        `);

        if (tables.length > 0) {
          try {
            const tableNames = tables.map((t: { tablename: string }) => `"${t.tablename}"`).join(', ');
            await queryRunner.query(`TRUNCATE TABLE ${tableNames} CASCADE;`);
          } catch (batchError) {
            const errorMessage = (batchError as Error).message || String(batchError);
            if (errorMessage.includes('deadlock') || errorMessage.includes('lock')) {
              if (attempt === maxRetries) {
                for (const table of tables) {
                  try {
                    await queryRunner.query(`TRUNCATE TABLE "${table.tablename}" CASCADE;`);
                  } catch (individualError) {
                    console.warn(`Failed to truncate ${table.tablename}:`, (individualError as Error).message);
                  }
                }
              } else {
                throw batchError;
              }
            } else {
              throw batchError;
            }
          }
        }

        await queryRunner.query('SET session_replication_role = DEFAULT;');
        return;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = (error as Error).message || String(error);
        if (attempt < maxRetries && (errorMessage.includes('deadlock') || errorMessage.includes('lock'))) {
          console.warn(`Database cleanup attempt ${attempt} failed, retrying...`, errorMessage);
        } else {
          throw error;
        }
      } finally {
        await queryRunner.release();
      }
    }

    throw lastError || new Error('Database cleanup failed after all retries');
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
