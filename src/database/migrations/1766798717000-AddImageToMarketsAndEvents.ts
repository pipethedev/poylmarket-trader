import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddImageToMarketsAndEvents1766798717000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'markets',
      new TableColumn({
        name: 'image',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'events',
      new TableColumn({
        name: 'image',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('markets', 'image');
    await queryRunner.dropColumn('events', 'image');
  }
}
