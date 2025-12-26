import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClobClient,
  Chain,
  Side,
  OrderType,
  type OrderBookSummary,
  type TickSize,
  ApiKeyCreds,
} from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';

export interface PaginationPayload {
  data: unknown[];
  next_cursor?: string;
  limit?: number;
  count?: number;
}

export interface PriceResponse {
  price: string;
}

export interface PlaceOrderParams {
  tokenId: string;
  price: number;
  side: 'BUY' | 'SELL';
  size: number;
  tickSize: string;
  negRisk: boolean;
}

export interface OrderResponse {
  orderID: string;
  status?: string;
  error?: string;
}

@Injectable()
export class PolymarketClobService {
  private readonly logger = new Logger(PolymarketClobService.name);
  private readonly client: ClobClient;
  private authenticatedClient: ClobClient | null = null;
  private readonly enableRealTrading: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('polymarket.clobApiUrl')!;
    this.enableRealTrading = this.configService.get<boolean>('polymarket.enableRealTrading') ?? false;

    this.client = new ClobClient(host, Chain.POLYGON);
  }

  getClient(): ClobClient {
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getOk();
      return true;
    } catch {
      return false;
    }
  }

  async getMarkets(nextCursor?: string): Promise<PaginationPayload> {
    return this.client.getMarkets(nextCursor) as Promise<PaginationPayload>;
  }

  async getMarket(conditionId: string): Promise<unknown> {
    return this.client.getMarket(conditionId) as Promise<unknown>;
  }

  async getOrderBook(tokenId: string): Promise<OrderBookSummary> {
    return this.client.getOrderBook(tokenId);
  }

  async getMidpoint(tokenId: string): Promise<PriceResponse> {
    return this.client.getMidpoint(tokenId) as Promise<PriceResponse>;
  }

  async getPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<PriceResponse> {
    return this.client.getPrice(tokenId, side) as Promise<PriceResponse>;
  }

  async getLastTradePrice(tokenId: string): Promise<PriceResponse> {
    return this.client.getLastTradePrice(tokenId) as Promise<PriceResponse>;
  }

  async getTickSize(tokenId: string): Promise<TickSize> {
    return this.client.getTickSize(tokenId);
  }

  async placeOrder(params: PlaceOrderParams): Promise<OrderResponse> {
    if (!this.enableRealTrading) {
      throw new Error('Real trading is not enabled. Set POLYMARKET_ENABLE_REAL_TRADING=true to enable.');
    }

    const client = await this.getAuthenticatedClient();

    try {
      this.logger.log(`Placing order: ${params.side} ${params.size} @ ${params.price} for token ${params.tokenId}`);

      const orderArgs = {
        tokenID: params.tokenId,
        price: params.price,
        side: params.side === 'BUY' ? Side.BUY : Side.SELL,
        size: params.size,
        feeRateBps: 0,
      };

      const response = await client.createAndPostOrder(
        orderArgs,
        {
          tickSize: params.tickSize as TickSize,
          negRisk: params.negRisk,
        },
        OrderType.GTC,
      );

      this.logger.log(`Order placed successfully: ${response.orderID}`);

      return {
        orderID: response.orderID,
        status: response.status,
      };
    } catch (error) {
      this.logger.error(`Error placing order: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  private async getAuthenticatedClient(): Promise<ClobClient> {
    if (this.authenticatedClient) {
      return this.authenticatedClient;
    }

    const privateKey = this.configService.get<string>('polymarket.walletPrivateKey');
    const funderAddress = this.configService.get<string>('polymarket.funderAddress');
    const signatureType = this.configService.get<number>('polymarket.signatureType') ?? 1;
    const chainId = this.configService.get<number>('polymarket.chainId') ?? 137;

    if (!privateKey) {
      throw new Error('POLYMARKET_WALLET_PRIVATE_KEY is required for placing orders');
    }

    if (!funderAddress) {
      throw new Error('POLYMARKET_FUNDER_ADDRESS is required for placing orders');
    }

    const host = this.configService.get<string>('polymarket.clobApiUrl')!;
    const wallet = new Wallet(privateKey);

    this.logger.log('Initializing authenticated CLOB client...');

    const tempClient = new ClobClient(host, chainId, wallet);

    const creds: ApiKeyCreds = await tempClient.createOrDeriveApiKey();

    this.authenticatedClient = new ClobClient(
      host,
      chainId,
      wallet,
      creds,
      signatureType,
      funderAddress,
    );

    this.logger.log('Authenticated CLOB client initialized successfully');

    return this.authenticatedClient;
  }

  isRealTradingEnabled(): boolean {
    return this.enableRealTrading;
  }
}
