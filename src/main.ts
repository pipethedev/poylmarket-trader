import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@common/filters/index';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const corsConfig = configService.get('cors');

  app.enableCors({
    origin: corsConfig.origins,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
    credentials: corsConfig.credentials,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Polymart Trader Task')
    .setDescription('A trading system that syncs Polymarket events/markets data, accepts order requests, queues orders for execution, and handles order lifecycle.')
    .setVersion('1.0')
    .addTag('events', 'Event management and synchronization')
    .addTag('markets', 'Market data and pricing')
    .addTag('orders', 'Order creation and management')
    .addApiKey({ type: 'apiKey', name: 'x-idempotency-key', in: 'header' }, 'x-idempotency-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  try {
    const ordersQueue = app.get(getQueueToken('orders'));
    const syncQueue = app.get(getQueueToken('sync'));

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullMQAdapter(ordersQueue), new BullMQAdapter(syncQueue)],
      serverAdapter,
    });

    app.use('/admin/queues', serverAdapter.getRouter());
  } catch (error) {
    console.warn('Bull Board setup failed:', (error as Error).message);
  }

  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
  console.log(`Bull Board UI available at: http://localhost:${port}/admin/queues`);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, starting graceful shutdown...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
void bootstrap();
