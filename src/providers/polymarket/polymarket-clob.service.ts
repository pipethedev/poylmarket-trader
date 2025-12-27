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
import { JsonRpcProvider } from '@ethersproject/providers';
import { getAddress } from '@ethersproject/address';
import type { CancelResult, WalletContext } from '@app-types/index';

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
  walletContext?: WalletContext;
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
  private readonly userClients: Map<string, ClobClient> = new Map();
  private readonly enableRealTrading: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('polymarket.clobApiUrl')!;

    const chainId = this.configService.get<number>('polymarket.chainId') ?? 137;

    this.enableRealTrading =
      this.configService.get<boolean>('polymarket.enableRealTrading') ?? false;

    this.client = new ClobClient(host, chainId as Chain);
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

  async getOpenOrders(): Promise<unknown[]> {
    if (!this.enableRealTrading) {
      this.logger.warn('Real trading not enabled');
      return [];
    }

    const client = await this.getAuthenticatedClient();
    try {
      const openOrders = await client.getOpenOrders();
      return openOrders as unknown[];
    } catch (error) {
      this.logger.error(`Error fetching open orders: ${(error as Error).message}`);
      throw error;
    }
  }

  async getTrades(): Promise<unknown[]> {
    if (!this.enableRealTrading) {
      this.logger.warn('Real trading not enabled');
      return [];
    }

    const client = await this.getAuthenticatedClient();
    try {
      const trades = await client.getTrades();
      return trades as unknown[];
    } catch (error) {
      this.logger.error(`Error fetching trades: ${(error as Error).message}`);
      throw error;
    }
  }

  async placeOrder(params: PlaceOrderParams): Promise<OrderResponse> {
    if (!this.enableRealTrading) {
      throw new Error(
        'Real trading is not enabled. Set POLYMARKET_ENABLE_REAL_TRADING=true to enable.',
      );
    }

    //Ideally this shouldn't happen in production: So if the request was triggered by the client we use their connected wallet but if not we use the system credentials.
    const client = params.walletContext?.walletAddress
      ? await this.getUserClient(params.walletContext.walletAddress)
      : await this.getAuthenticatedClient();

    try {
      this.logger.log(
        `Placing order: ${params.side} ${params.size} @ ${params.price} for token ${params.tokenId}, negRisk: ${params.negRisk}`,
      );

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

      this.logger.debug(`CLOB order response: ${JSON.stringify(response)}`);

      if (response.error) {
        const errorMessage =
          typeof response.error === 'string' ? response.error : JSON.stringify(response.error);
        this.logger.error(`Order placement failed: ${errorMessage}`);

        if (errorMessage.includes('invalid signature') || errorMessage.includes('signature')) {
          this.logger.warn(
            'Invalid signature detected. Clearing cached authenticated client to force re-authentication.',
          );
          this.authenticatedClient = null;
        }

        throw new Error(`Failed to place order: ${errorMessage}`);
      }

      if (!response.orderID) {
        this.logger.error(
          `Order response missing orderID. Full response: ${JSON.stringify(response)}`,
        );

        const responseStr = JSON.stringify(response);
        if (responseStr.includes('error') || responseStr.includes('invalid')) {
          this.logger.warn(
            'Invalid signature detected. Clearing cached authenticated client to force re-authentication.',
          );
          this.authenticatedClient = null;
        }

        throw new Error('Order placement failed: No order ID returned from Polymarket');
      }

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
      throw new Error(
        'POLYMARKET_WALLET_PRIVATE_KEY is required for server-authenticated CLOB operations',
      );
    }

    if (!funderAddress) {
      throw new Error(
        'POLYMARKET_FUNDER_ADDRESS is required for server-authenticated CLOB operations',
      );
    }

    const host = this.configService.get<string>('polymarket.clobApiUrl')!;
    const wallet = new Wallet(privateKey);

    const checksummedFunderAddress = getAddress(funderAddress);

    this.logger.log(
      `Initializing authenticated CLOB client... Wallet: ${wallet.address}, Funder: ${checksummedFunderAddress}, SignatureType: ${signatureType}`,
    );

    const tempClient = new ClobClient(host, chainId, wallet);

    let creds: ApiKeyCreds;
    try {
      creds = await tempClient.createOrDeriveApiKey();
      this.logger.log('API key created/derived successfully');
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Failed to create or derive API key: ${errorMessage}`);

      if (errorMessage.includes('signature') || errorMessage.includes('Could not create api key')) {
        throw new Error(
          `Failed to authenticate with Polymarket: ${errorMessage}. ` +
            `Please verify that POLYMARKET_WALLET_PRIVATE_KEY is correct and the wallet has sufficient MATIC for gas fees.`,
        );
      }

      throw new Error(`Failed to create API key for CLOB authentication: ${errorMessage}`);
    }

    // Validate that we got credentials
    if (!creds) {
      this.logger.error('No API credentials received from createOrDeriveApiKey');
      throw new Error('Failed to obtain API credentials from Polymarket');
    }

    this.authenticatedClient = new ClobClient(
      host,
      chainId,
      wallet,
      creds,
      signatureType,
      checksummedFunderAddress,
    );

    this.logger.log(
      `Authenticated CLOB client initialized successfully. ` +
        `Wallet: ${wallet.address}, Funder: ${funderAddress}, SignatureType: ${signatureType}, ChainId: ${chainId}`,
    );

    return this.authenticatedClient;
  }

  async getUserClient(walletAddress: string): Promise<ClobClient> {
    if (this.userClients.has(walletAddress)) {
      return this.userClients.get(walletAddress)!;
    }

    const rpcUrl = this.configService.get<string>('polymarket.rpcUrl');
    if (!rpcUrl) {
      throw new Error(
        'POLYMARKET_RPC_URL is required for user wallet orders. Please configure an RPC endpoint (e.g., Alchemy, Infura).',
      );
    }

    const chainId = this.configService.get<number>('polymarket.chainId') ?? 137;
    const signatureType = this.configService.get<number>('polymarket.signatureType') ?? 1;
    const funderAddress = this.configService.get<string>('polymarket.funderAddress');
    const host = this.configService.get<string>('polymarket.clobApiUrl')!;

    const checksummedFunderAddress = funderAddress ? getAddress(funderAddress) : undefined;

    this.logger.log(`Creating ClobClient for user wallet: ${walletAddress}`);

    const provider = new JsonRpcProvider(rpcUrl);
    const signer = provider.getSigner(walletAddress);

    const tempClient = new ClobClient(host, chainId, signer);

    let creds: ApiKeyCreds;
    try {
      creds = await tempClient.createOrDeriveApiKey();
      this.logger.log(`API key created/derived successfully for wallet ${walletAddress}`);
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Failed to create API key for wallet ${walletAddress}: ${errorMessage}`);

      if (errorMessage.includes('signature') || errorMessage.includes('Could not create api key')) {
        throw new Error(
          `Failed to authenticate wallet ${walletAddress}: ${errorMessage}. ` +
            `Please verify the wallet is connected correctly and has sufficient MATIC for gas fees.`,
        );
      }

      throw new Error(`Failed to authenticate wallet ${walletAddress}: ${errorMessage}`);
    }

    if (!creds) {
      this.logger.error(`No API credentials received for wallet ${walletAddress}`);
      throw new Error(`Failed to obtain API credentials for wallet ${walletAddress}`);
    }

    const userClient = new ClobClient(
      host,
      chainId,
      signer,
      creds,
      signatureType,
      checksummedFunderAddress,
    );

    this.userClients.set(walletAddress, userClient);

    this.logger.log(`ClobClient created and cached for wallet: ${walletAddress}`);

    return userClient;
  }

  async cancelOrder(orderId: string, walletContext?: WalletContext): Promise<CancelResult> {
    const client = walletContext?.walletAddress
      ? await this.getUserClient(walletContext.walletAddress)
      : await this.getAuthenticatedClient();

    try {
      this.logger.log(`Cancelling order on Polymarket: ${orderId}`);

      const response = await client.cancelOrder({ orderID: orderId });

      if (response.error) {
        const errorMessage =
          typeof response.error === 'string' ? response.error : JSON.stringify(response.error);

        this.logger.error(`Order cancellation failed: ${errorMessage}`);
        return {
          success: false,
          orderId,
          message: errorMessage,
        };
      }

      this.logger.log(`Order cancelled successfully on Polymarket: ${orderId}`);
      return {
        success: true,
        orderId,
        message: 'Order cancelled successfully',
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Error cancelling order: ${errorMessage}`, (error as Error).stack);
      throw error;
    }
  }

  isRealTradingEnabled(): boolean {
    return this.enableRealTrading;
  }

  isServerWalletConfigured(): boolean {
    const privateKey = this.configService.get<string>('polymarket.walletPrivateKey');
    const funderAddress = this.configService.get<string>('polymarket.funderAddress');
    return !!(privateKey && funderAddress);
  }
}
