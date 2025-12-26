import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@common/filters/index';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Polymart Trader Task')
    .setDescription(
      'A trading system that syncs Polymarket events/markets data, accepts order requests, queues orders for execution, and handles order lifecycle.',
    )
    .setVersion('1.0')
    .addTag('events', 'Event management and synchronization')
    .addTag('markets', 'Market data and pricing')
    .addTag('orders', 'Order creation and management')
    .addApiKey({ type: 'apiKey', name: 'Idempotency-Key', in: 'header' }, 'Idempotency-Key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}
void bootstrap();
