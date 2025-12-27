import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddUserWalletAddressToOrders1703600000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'user_wallet_address',
        type: 'varchar',
        length: '42',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_user_wallet_address',
        columnNames: ['user_wallet_address'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('orders', 'idx_orders_user_wallet_address');

    await queryRunner.dropColumn('orders', 'user_wallet_address');
  }
}
