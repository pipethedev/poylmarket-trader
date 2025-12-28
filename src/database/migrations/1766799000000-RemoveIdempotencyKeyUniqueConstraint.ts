import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveIdempotencyKeyUniqueConstraint1766799000000 implements MigrationInterface {
  name = 'RemoveIdempotencyKeyUniqueConstraint1766799000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "UQ_orders_idempotency_key"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "UQ_orders_idempotency_key" UNIQUE ("idempotency_key")`);
  }
}
