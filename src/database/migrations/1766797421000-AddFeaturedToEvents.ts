import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddFeaturedToEvents1766797421000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'events',
      new TableColumn({
        name: 'featured',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    await queryRunner.createIndex(
      'events',
      new TableIndex({
        name: 'idx_events_featured',
        columnNames: ['featured'],
      }),
    );

    await queryRunner.query(`
      UPDATE events
      SET featured = COALESCE((metadata->>'featured')::boolean, false)
      WHERE metadata IS NOT NULL AND metadata->>'featured' IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('events', 'idx_events_featured');
    await queryRunner.dropColumn('events', 'featured');
  }
}
