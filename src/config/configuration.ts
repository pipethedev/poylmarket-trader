import type { AppConfig } from '../types';

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  defaultProvider: process.env.DEFAULT_PROVIDER ?? 'polymarket',
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USERNAME ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'polymarket_trader',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  polymarket: {
    clobApiUrl: process.env.POLYMARKET_CLOB_API_URL ?? 'https://clob.polymarket.com',
    gammaApiUrl: process.env.POLYMARKET_GAMMA_API_URL ?? 'https://gamma-api.polymarket.com',
    walletPrivateKey: process.env.POLYMARKET_WALLET_PRIVATE_KEY,
    funderAddress: process.env.POLYMARKET_FUNDER_ADDRESS,
    signatureType: process.env.POLYMARKET_SIGNATURE_TYPE
      ? parseInt(process.env.POLYMARKET_SIGNATURE_TYPE, 10)
      : 1,
    chainId: process.env.POLYMARKET_CHAIN_ID ? parseInt(process.env.POLYMARKET_CHAIN_ID, 10) : 137,
    enableRealTrading: process.env.POLYMARKET_ENABLE_REAL_TRADING === 'true',
  },
  scheduler: {
    syncCron: process.env.SYNC_CRON_EXPRESSION ?? '*/15 * * * *',
    priceUpdateCron: process.env.PRICE_UPDATE_CRON_EXPRESSION ?? '*/5 * * * *',
  },
});
