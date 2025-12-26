import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import configuration from '@config/configuration';
import { CommonModule } from '@common/common.module';
import { DatabaseModule } from '@database/database.module';
import { ProvidersModule } from '@providers/providers.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [__dirname + '/database/entities/*.entity{.ts,.js}'],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),

    DatabaseModule,
    CommonModule,
    ProvidersModule,
    SchedulerModule,
  ],
})
class SchedulerAppModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SchedulerAppModule);

  const configService = app.get(ConfigService);
  const syncCron = configService.get<string>('scheduler.syncCron');
  const priceUpdateCron = configService.get<string>('scheduler.priceUpdateCron');

  console.log(`  Sync Cron:         ${syncCron}`);
  console.log(`  Price Update Cron: ${priceUpdateCron}`);
  console.log('Scheduler is running.');

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      void app.close().then(() => process.exit(0));
    });
  });
}

void bootstrap();
