import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { MarketRepository } from '@database/repositories/index';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { WebSocketMessage, SubscriptionMessage } from './polymarket.types';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable()
export class PolymarketWebSocketService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private subscribedTokenIds = new Set<string>();
  private readonly logger: AppLogger;
  private readonly baseWsUrl: string;
  private readonly enabled: boolean;
  private readonly reconnectDelay: number;
  private readonly connectionTimeoutMs = 10000;
  private isShuttingDown = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly marketRepository: MarketRepository,
    logger: AppLogger,
  ) {
    this.logger = logger.setPrefix(LogPrefix.PROVIDER).setContext(PolymarketWebSocketService.name);
    this.baseWsUrl = this.configService.get<string>('polymarket.clobWebSocketUrl')!;
    this.enabled = this.configService.get<boolean>('polymarket.websocketEnabled') ?? true;
    this.reconnectDelay = this.configService.get<number>('polymarket.websocketReconnectDelay') ?? 5000;
  }

  private getWsUrl(): string {
    return `${this.baseWsUrl}/ws/market`;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('WebSocket is disabled via configuration');
      return;
    }

    this.logger.log('Initializing WebSocket connection');
    await this.connect();
  }

  private connect() {
    if (this.isShuttingDown) {
      return Promise.resolve();
    }

    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return Promise.resolve();
    }

    this.connectionState = 'connecting';
    const wsUrl = this.getWsUrl();
    this.logger.log(`Connecting to WebSocket: ${wsUrl}`);

    this.connectionTimeout = setTimeout(() => {
      if (this.connectionState === 'connecting' && this.ws) {
        this.logger.error(`WebSocket connection timeout exceeded when trying to connect to ${wsUrl}`);
        this.connectionState = 'error';
        this.ws.close();
        this.ws = null;
        if (!this.isShuttingDown) {
          this.scheduleReconnect();
        }
      }
    }, this.connectionTimeoutMs);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.logger.log('WebSocket connected');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.startPingInterval();
        void this.subscribeToActiveMarkets();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          let messageText: string;
          if (typeof data === 'string') {
            messageText = data;
          } else if (Buffer.isBuffer(data)) {
            messageText = data.toString('utf8');
          } else if (data instanceof ArrayBuffer) {
            messageText = Buffer.from(data).toString('utf8');
          } else {
            if (typeof data === 'object' && data !== null) {
              return;
            }
            if (typeof data === 'number' || typeof data === 'boolean' || typeof data === 'bigint') {
              messageText = String(data);
            } else {
              this.logger.warn('Received unexpected data type in WebSocket message, skipping');
              return;
            }
          }

          if (messageText === 'PONG') {
            this.logger.debug('Received PONG from server');
            return;
          }

          const message = JSON.parse(messageText) as WebSocketMessage;
          void this.handleMessage(message);
        } catch (error) {
          this.logger.error(`Failed to parse WebSocket message: ${(error as Error).message}`);
        }
      });

      this.ws.on('error', (error: Error) => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.logger.error(`WebSocket error: ${error.message} (URL: ${wsUrl})`);
        this.connectionState = 'error';
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.logger.warn(`WebSocket closed: code=${code}, reason=${reason.toString()}`);
        this.connectionState = 'disconnected';
        this.stopPingInterval();
        this.ws = null;

        if (!this.isShuttingDown && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.logger.error('Max reconnection attempts reached. WebSocket will not reconnect.');
        }
      });
    } catch (error) {
      this.logger.error(`Failed to create WebSocket connection: ${(error as Error).message}`);
      this.connectionState = 'error';
      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 60000);
    this.reconnectAttempts++;

    this.logger.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isShuttingDown) {
        void this.connect();
      }
    }, delay);
  }

  private async subscribeToActiveMarkets(): Promise<void> {
    try {
      const markets = await this.marketRepository.findActiveMarketsWithTokens();
      const allTokenIds: string[] = [];

      for (const market of markets) {
        if (market.tokenIds.length > 0) {
          allTokenIds.push(...market.tokenIds);
        }
      }

      if (allTokenIds.length === 0) {
        return;
      }

      this.logger.log(`Subscribing to ${allTokenIds.length} token IDs from ${markets.length} markets`);

      const subscriptionMessage: SubscriptionMessage = {
        type: 'MARKET',
        assets_ids: allTokenIds,
      };

      this.sendMessage(subscriptionMessage);

      allTokenIds.forEach((tokenId) => this.subscribedTokenIds.add(tokenId));
    } catch (error) {
      this.logger.error(`Failed to subscribe to active markets: ${(error as Error).message}`);
    }
  }

  subscribeToTokenIds(tokenIds: string[]) {
    if (!this.isConnected()) {
      this.logger.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    const newTokenIds = tokenIds.filter((id) => !this.subscribedTokenIds.has(id));

    if (newTokenIds.length === 0) {
      this.logger.log('All token IDs already subscribed');
      return;
    }

    this.logger.log(`Subscribing to ${newTokenIds.length} new token IDs`);

    const subscriptionMessage: SubscriptionMessage = {
      operation: 'subscribe',
      assets_ids: newTokenIds,
    };

    this.sendMessage(subscriptionMessage);

    newTokenIds.forEach((tokenId) => this.subscribedTokenIds.add(tokenId));
    return Promise.resolve();
  }

  unsubscribeFromTokenIds(tokenIds: string[]) {
    if (!this.isConnected()) {
      this.logger.warn('Cannot unsubscribe: WebSocket not connected');
      return;
    }

    const subscribedTokenIds = tokenIds.filter((id) => this.subscribedTokenIds.has(id));

    if (subscribedTokenIds.length === 0) {
      this.logger.log('No token IDs to unsubscribe');
      return;
    }

    this.logger.log(`Unsubscribing from ${subscribedTokenIds.length} token IDs`);

    const unsubscribeMessage: SubscriptionMessage = {
      operation: 'unsubscribe',
      assets_ids: subscribedTokenIds,
    };

    this.sendMessage(unsubscribeMessage);

    subscribedTokenIds.forEach((tokenId) => this.subscribedTokenIds.delete(tokenId));
    return Promise.resolve();
  }

  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.ws && this.connectionState === 'connected') {
        try {
          this.ws.send('PING');
          this.logger.debug('PING dispatched to keep connection alive');
        } catch (error) {
          this.logger.error(`Failed to send PING: ${(error as Error).message}`);
        }
      }
    }, 10000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private sendMessage(message: SubscriptionMessage): void {
    if (!this.ws || this.connectionState !== 'connected') {
      this.logger.warn('Cannot send message: WebSocket not connected');
      return;
    }

    try {
      const jsonMessage = JSON.stringify(message);
      this.ws.send(jsonMessage);
      // this.logger.debug(`Sent message: ${jsonMessage}`);
    } catch (error) {
      this.logger.error(`Failed to send WebSocket message: ${(error as Error).message}`);
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const eventType = message.event_type;

    if (!eventType) {
      // this.logger.warn('Received message without event_type');
      return;
    }

    // this.logger.debug(`Received message: event_type=${eventType}`);

    if (this.onMessage) {
      this.onMessage(message);
    }
  }

  private onMessage: ((message: WebSocketMessage) => void) | null = null;

  setMessageHandler(handler: (message: WebSocketMessage) => void): void {
    this.onMessage = handler;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getSubscribedTokenCount(): number {
    return this.subscribedTokenIds.size;
  }

  onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    this.stopPingInterval();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.ws) {
      this.logger.log('Closing WebSocket connection');
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.connectionState = 'disconnected';
    this.logger.log('WebSocket service destroyed');
    return Promise.resolve();
  }
}
