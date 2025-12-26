import type { AppConfig } from '../types';

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USERNAME ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'polymarket_trader',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  polymarket: {
    clobApiUrl: process.env.POLYMARKET_CLOB_API_URL ?? 'https://clob.polymarket.com',
    gammaApiUrl: process.env.POLYMARKET_GAMMA_API_URL ?? 'https://gamma-api.polymarket.com',
  },
  scheduler: {
    syncCron: process.env.SYNC_CRON_EXPRESSION ?? '*/15 * * * *',
    priceUpdateCron: process.env.PRICE_UPDATE_CRON_EXPRESSION ?? '*/5 * * * *',
  },
});
