import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersTable1703600000003 implements MigrationInterface {
  name = 'CreateOrdersTable1703600000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" SERIAL PRIMARY KEY,
        "idempotency_key" character varying NOT NULL,
        "market_id" integer NOT NULL,
        "side" character varying(10) NOT NULL,
        "type" character varying(10) NOT NULL,
        "outcome" character varying(10) NOT NULL,
        "quantity" numeric(18,8) NOT NULL,
        "price" numeric(18,8),
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "filled_quantity" numeric(18,8) NOT NULL DEFAULT 0,
        "average_fill_price" numeric(18,8),
        "external_order_id" character varying,
        "failure_reason" character varying,
        "metadata" jsonb,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_orders_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "FK_orders_market" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_orders_idempotency_key" ON "orders" ("idempotency_key")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_orders_market_id" ON "orders" ("market_id")`);
    await queryRunner.query(`CREATE INDEX "idx_orders_status" ON "orders" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_orders_created_at" ON "orders" ("created_at")`);
    await queryRunner.query(
      `CREATE INDEX "idx_orders_market_status" ON "orders" ("market_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_status_created" ON "orders" ("status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_pending" ON "orders" ("created_at") WHERE status = 'PENDING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_pending"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_market_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_market_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_idempotency_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
  }
}
