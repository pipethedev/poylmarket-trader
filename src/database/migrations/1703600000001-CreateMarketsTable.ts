import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMarketsTable1703600000001 implements MigrationInterface {
  name = 'CreateMarketsTable1703600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "markets" (
        "id" SERIAL PRIMARY KEY,
        "polymarket_id" character varying NOT NULL,
        "condition_id" character varying,
        "event_id" integer NOT NULL,
        "question" character varying NOT NULL,
        "description" text,
        "outcome_yes_price" numeric(18,8) NOT NULL DEFAULT 0,
        "outcome_no_price" numeric(18,8) NOT NULL DEFAULT 0,
        "volume" numeric(18,8),
        "liquidity" numeric(18,8),
        "active" boolean NOT NULL DEFAULT true,
        "closed" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_markets_polymarket_id" UNIQUE ("polymarket_id"),
        CONSTRAINT "FK_markets_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_markets_polymarket_id" ON "markets" ("polymarket_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_markets_condition_id" ON "markets" ("condition_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_markets_event_id" ON "markets" ("event_id")`);
    await queryRunner.query(`CREATE INDEX "idx_markets_active" ON "markets" ("active")`);
    await queryRunner.query(
      `CREATE INDEX "idx_markets_event_active" ON "markets" ("event_id", "active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_markets_event_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_markets_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_markets_event_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_markets_condition_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_markets_polymarket_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "markets"`);
  }
}
