export type DatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export type RedisConfig = {
  host: string;
  port: number;
};

export type PolymarketConfig = {
  clobApiUrl: string;
  gammaApiUrl: string;
};

export type SchedulerConfig = {
  syncCron: string;
  priceUpdateCron: string;
};

export type AppConfig = {
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
  polymarket: PolymarketConfig;
  scheduler: SchedulerConfig;
};
