import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventsTable1703600000000 implements MigrationInterface {
  name = 'CreateEventsTable1703600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" SERIAL PRIMARY KEY,
        "polymarket_id" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "slug" character varying,
        "start_date" TIMESTAMP WITH TIME ZONE,
        "end_date" TIMESTAMP WITH TIME ZONE,
        "active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_events_polymarket_id" UNIQUE ("polymarket_id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_events_polymarket_id" ON "events" ("polymarket_id")`);
    await queryRunner.query(`CREATE INDEX "idx_events_start_date" ON "events" ("start_date")`);
    await queryRunner.query(`CREATE INDEX "idx_events_end_date" ON "events" ("end_date")`);
    await queryRunner.query(`CREATE INDEX "idx_events_active" ON "events" ("active")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_end_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_start_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_polymarket_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events"`);
  }
}
