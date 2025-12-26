import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import configuration from '@config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from '@common/common.module';
import { DatabaseModule } from '@database/database.module';
import { ProvidersModule } from '@providers/providers.module';
import { EventsModule } from '@modules/events/events.module';
import { MarketsModule } from '@modules/markets/markets.module';
import { OrdersModule } from '@modules/orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const ssl = configService.get<boolean>('database.ssl');
        const sslMode = configService.get<string>('database.sslMode');
        const channelBinding = configService.get<string>('database.channelBinding');

        return {
          type: 'postgres',
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.database'),
          entities: [__dirname + '/database/entities/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          synchronize: false,
          logging: process.env.NODE_ENV === 'development',
          ...(ssl && {
            ssl: {
              rejectUnauthorized: sslMode === 'require',
            },
          }),
          ...(sslMode && { extra: { sslmode: sslMode } }),
          ...(channelBinding && {
            extra: {
              ...(sslMode && { sslmode: sslMode }),
              channel_binding: channelBinding,
            },
          }),
        };
      },
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          ...(configService.get<string>('redis.username') && {
            username: configService.get<string>('redis.username'),
          }),
          ...(configService.get<string>('redis.password') && {
            password: configService.get<string>('redis.password'),
          }),
          ...(configService.get<boolean>('redis.tls') && { tls: {} }),
        },
      }),
    }),

    DatabaseModule,

    CommonModule,

    ProvidersModule,

    EventsModule,
    MarketsModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
