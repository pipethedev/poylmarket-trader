export type DatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export type RedisConfig = {
  url: string;
};

export type PolymarketConfig = {
  clobApiUrl: string;
  gammaApiUrl: string;
  walletPrivateKey?: string;
  funderAddress?: string;
  signatureType?: number;
  chainId?: number;
  enableRealTrading?: boolean;
};

export type SchedulerConfig = {
  syncCron: string;
  priceUpdateCron: string;
};

export type AppConfig = {
  port: number;
  defaultProvider: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  polymarket: PolymarketConfig;
  scheduler: SchedulerConfig;
};
