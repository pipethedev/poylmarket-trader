import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Polymart Trader Task')
    .setDescription(
      'A trading system that syncs Polymarket events/markets data, accepts order requests, queues orders for execution, and handles order lifecycle.',
    )
    .setVersion('1.0')
    .addTag('events', 'Event management and synchronization')
    .addTag('markets', 'Market data and pricing')
    .addTag('orders', 'Order creation and management')
    .addApiKey({ type: 'apiKey', name: 'x-idempotency-key', in: 'header' }, 'x-idempotency-key')
    .build();
}

function generateAndWriteSwagger(app: INestApplication): void {
  const config = createSwaggerConfig();
  const document = SwaggerModule.createDocument(app, config);
  const outputPath = join(process.cwd(), 'swagger.json');

  writeFileSync(outputPath, JSON.stringify(document, null, 2), { encoding: 'utf8' });
  console.log(`✓ Swagger JSON generated at: ${outputPath}`);
}

async function generateSwagger() {
  const loggerOptions: Array<false | ('error' | 'warn')[]> = [['error', 'warn'], false];

  for (const logger of loggerOptions) {
    try {
      const app = await NestFactory.create(AppModule, {
        logger,
        abortOnError: false,
      });

      generateAndWriteSwagger(app);
      await app.close();
      return;
    } catch (error) {
      if (logger === false) {
        throw error;
      }
      console.warn('Warning during Swagger generation:', error.message);
    }
  }
}

generateSwagger().catch((error) => {
  console.error('Error generating Swagger JSON:', error);
  process.exit(1);
});
