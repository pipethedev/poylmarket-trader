import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_SSL: Joi.string().valid('true', 'false').default('false'),
  PGSSLMODE: Joi.string().optional().allow(''),
  PGCHANNELBINDING: Joi.string().optional().allow(''),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_USERNAME: Joi.string().optional(),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_TLS: Joi.string().valid('true', 'false').default('false'),

  POLYMARKET_CLOB_API_URL: Joi.string().uri().default('https://clob.polymarket.com'),
  POLYMARKET_GAMMA_API_URL: Joi.string().uri().default('https://gamma-api.polymarket.com'),
  POLYMARKET_WALLET_PRIVATE_KEY: Joi.string().optional(),
  POLYMARKET_FUNDER_ADDRESS: Joi.string().optional(),
  POLYMARKET_SIGNATURE_TYPE: Joi.number().default(1),
  POLYMARKET_CHAIN_ID: Joi.number().default(137),
  POLYMARKET_ENABLE_REAL_TRADING: Joi.string().valid('true', 'false').default('false'),
  POLYMARKET_RPC_URL: Joi.string().uri().optional(),
  POLYMARKET_USDC_ADDRESS: Joi.string().optional(),
  POLYMARKET_CLOB_WEBSOCKET_URL: Joi.string()
    .uri()
    .default('wss://ws-subscriptions-clob.polymarket.com'),
  POLYMARKET_WEBSOCKET_ENABLED: Joi.string().valid('true', 'false').default('true'),
  POLYMARKET_WEBSOCKET_RECONNECT_DELAY: Joi.number().default(5000),
  POLYMARKET_WEBSOCKET_CUSTOM_FEATURES: Joi.string().valid('true', 'false').default('false'),

  SYNC_CRON_EXPRESSION: Joi.string().default('*/15 * * * *'),
  PRICE_UPDATE_CRON_EXPRESSION: Joi.string().default('*/5 * * * *'),

  CORS_ORIGINS: Joi.string().optional(),

  DEFAULT_PROVIDER: Joi.string().default('polymarket'),
});
