import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTokensTable1703600000002 implements MigrationInterface {
  name = 'CreateTokensTable1703600000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tokens" (
        "id" SERIAL PRIMARY KEY,
        "token_id" character varying NOT NULL,
        "market_id" integer NOT NULL,
        "outcome" character varying(10) NOT NULL,
        "price" numeric(18,8) NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tokens_token_id" UNIQUE ("token_id"),
        CONSTRAINT "FK_tokens_market" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_tokens_token_id" ON "tokens" ("token_id")`);
    await queryRunner.query(`CREATE INDEX "idx_tokens_market_id" ON "tokens" ("market_id")`);
    await queryRunner.query(
      `CREATE INDEX "idx_tokens_market_outcome" ON "tokens" ("market_id", "outcome")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tokens_market_outcome"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tokens_market_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tokens_token_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tokens"`);
  }
}
