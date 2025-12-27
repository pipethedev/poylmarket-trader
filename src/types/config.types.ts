export type DatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  sslMode?: string;
  channelBinding?: string;
};

export type RedisConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls: boolean;
};

export type PolymarketConfig = {
  clobApiUrl: string;
  gammaApiUrl: string;
  walletPrivateKey?: string;
  funderAddress?: string;
  signatureType?: number;
  chainId?: number;
  enableRealTrading?: boolean;
  rpcUrl?: string;
  clobWebSocketUrl?: string;
  websocketEnabled?: boolean;
  websocketReconnectDelay?: number;
  websocketCustomFeaturesEnabled?: boolean;
};

export type SchedulerConfig = {
  syncCron: string;
  priceUpdateCron: string;
  syncDaysBack: number;
};

export type CorsConfig = {
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
};

export type AppConfig = {
  port: number;
  defaultProvider: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  polymarket: PolymarketConfig;
  scheduler: SchedulerConfig;
  cors: CorsConfig;
};
