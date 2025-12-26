import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePolymarketIdToExternalId1703600000004
  implements MigrationInterface
{
  name = 'RenamePolymarketIdToExternalId1703600000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "provider" character varying NOT NULL DEFAULT 'polymarket'
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      RENAME COLUMN "polymarket_id" TO "external_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      RENAME CONSTRAINT "UQ_events_polymarket_id" TO "UQ_events_external_id"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_events_polymarket_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_events_external_id" ON "events" ("external_id")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_events_provider_external_id" ON "events" ("provider", "external_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "markets"
      ADD COLUMN "provider" character varying NOT NULL DEFAULT 'polymarket'
    `);

    await queryRunner.query(`
      ALTER TABLE "markets"
      RENAME COLUMN "polymarket_id" TO "external_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "markets"
      RENAME CONSTRAINT "UQ_markets_polymarket_id" TO "UQ_markets_external_id"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_markets_polymarket_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_markets_external_id" ON "markets" ("external_id")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_markets_provider_external_id" ON "markets" ("provider", "external_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_markets_provider_external_id"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_markets_external_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_markets_polymarket_id" ON "markets" ("polymarket_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "markets"
      RENAME CONSTRAINT "UQ_markets_external_id" TO "UQ_markets_polymarket_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "markets"
      RENAME COLUMN "external_id" TO "polymarket_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "markets"
      DROP COLUMN "provider"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_events_provider_external_id"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_external_id"`);
    await queryRunner.query(
      `CREATE INDEX "idx_events_polymarket_id" ON "events" ("polymarket_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "events"
      RENAME CONSTRAINT "UQ_events_external_id" TO "UQ_events_polymarket_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      RENAME COLUMN "external_id" TO "polymarket_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "provider"
    `);
  }
}