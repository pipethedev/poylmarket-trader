import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

export class TestAppFactory {
  private static app: INestApplication;
  private static moduleFixture: TestingModule;

  static async createApp(): Promise<INestApplication> {
    this.moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = this.moduleFixture.createNestApplication();

    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await this.app.init();

    return this.app;
  }

  static async closeApp(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }

  static getApp(): INestApplication {
    return this.app;
  }

  static getDataSource(): DataSource {
    return this.moduleFixture.get<DataSource>(DataSource);
  }

  static getConfigService(): ConfigService {
    return this.moduleFixture.get<ConfigService>(ConfigService);
  }
}
