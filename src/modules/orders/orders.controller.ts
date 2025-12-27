import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam, ApiSecurity } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderResponseDto, OrderListResponseDto } from './dto/order-response.dto';
import { IdempotencyInterceptor } from '@common/interceptors/idempotency.interceptor';
import { Idempotent } from '@common/decorators/idempotency.decorator';
import { IdempotencyKeyRequiredException } from '@common/exceptions';
import { UsdcTokenService } from '@common/services/usdc-token.service';

@ApiTags('orders')
@Controller('orders')
@UseInterceptors(IdempotencyInterceptor)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly usdcTokenService: UsdcTokenService,
  ) {}

  @Post()
  @Idempotent({ expiresInSeconds: 86400 })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new order',
    description: 'Creates a new order and queues it for processing. Requires an x-idempotency-key header.',
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    description: 'Unique key to ensure idempotent order creation',
    required: true,
    example: 'order-123-abc',
  })
  @ApiSecurity('x-idempotency-key')
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid order parameters or missing idempotency key',
  })
  @ApiResponse({
    status: 404,
    description: 'Market not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency key conflict - request is being processed or has different parameters',
  })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ): Promise<OrderResponseDto> {
    if (!idempotencyKey) {
      throw new IdempotencyKeyRequiredException();
    }
    return this.ordersService.createOrder(dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({
    summary: 'List orders',
    description: 'Retrieves a paginated list of orders with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: OrderListResponseDto,
  })
  async getOrders(@Query() query: QueryOrdersDto): Promise<OrderListResponseDto> {
    return this.ordersService.getOrders(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description: 'Retrieves details of a specific order',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async getOrder(@Param('id', ParseIntPipe) id: number): Promise<OrderResponseDto> {
    return this.ordersService.getOrder(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel an order',
    description:
      'Cancels a pending or queued order. Orders that are already processing or completed cannot be cancelled.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Order cannot be cancelled in its current status',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async cancelOrder(@Param('id', ParseIntPipe) id: number): Promise<OrderResponseDto> {
    return this.ordersService.cancelOrder(id);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order (alternative endpoint)',
    description:
      'Cancels a pending or queued order using POST method. Orders that are already processing or completed cannot be cancelled.',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Order cannot be cancelled in its current status',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async cancelOrderPost(@Param('orderId', ParseIntPipe) orderId: number): Promise<OrderResponseDto> {
    return this.ordersService.cancelOrder(orderId);
  }

  @Get('usdc/balance/:address')
  @ApiOperation({
    summary: 'Get USDC balance',
    description: 'Retrieves the USDC balance of a wallet address',
  })
  @ApiParam({
    name: 'address',
    description: 'Wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @ApiResponse({
    status: 200,
    description: 'USDC balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        balance: { type: 'string', example: '1000.5' },
        address: { type: 'string' },
      },
    },
  })
  async getUsdcBalance(@Param('address') address: string): Promise<{ balance: string; address: string }> {
    const balance = await this.usdcTokenService.getBalance(address);
    return { balance, address };
  }

  @Get('usdc/allowance/:address')
  @ApiOperation({
    summary: 'Get USDC allowance',
    description: 'Retrieves the USDC allowance that a wallet has granted to the server',
  })
  @ApiParam({
    name: 'address',
    description: 'Wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @ApiResponse({
    status: 200,
    description: 'USDC allowance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        allowance: { type: 'string', example: '500.0' },
        address: { type: 'string' },
        serverWallet: { type: 'string' },
      },
    },
  })
  async getUsdcAllowance(
    @Param('address') address: string,
  ): Promise<{ allowance: string; address: string; serverWallet: string }> {
    const allowance = await this.usdcTokenService.getAllowance(address);
    const serverWallet = this.usdcTokenService.getServerWalletAddress();
    return { allowance, address, serverWallet };
  }

  @Get('usdc/info')
  @ApiOperation({
    summary: 'Get USDC contract and server wallet info',
    description: 'Retrieves USDC contract address, server wallet address, and funder address',
  })
  @ApiResponse({
    status: 200,
    description: 'USDC info retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        usdcAddress: { type: 'string' },
        serverWallet: { type: 'string' },
        funderAddress: { type: 'string' },
        rpcUrl: { type: 'string' },
      },
    },
  })
  getUsdcInfo(): {
    usdcAddress: string;
    serverWallet: string;
    funderAddress: string;
    rpcUrl: string;
  } {
    return {
      usdcAddress: this.usdcTokenService.getUsdcAddress(),
      serverWallet: this.usdcTokenService.getServerWalletAddress(),
      funderAddress: this.usdcTokenService.getFunderAddress(),
      rpcUrl: this.usdcTokenService.getRpcUrl(),
    };
  }

  @Get('usdc/server-wallet/balance')
  @ApiOperation({
    summary: 'Get server wallet MATIC balance',
    description: 'Retrieves the server wallet MATIC balance needed for gas fees',
  })
  @ApiResponse({
    status: 200,
    description: 'Server wallet balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' },
        balance: { type: 'string' },
        balanceFormatted: { type: 'string' },
        minRequired: { type: 'string' },
        hasEnough: { type: 'boolean' },
      },
    },
  })
  async getServerWalletBalance(): Promise<{
    address: string;
    balance: string;
    balanceFormatted: string;
    minRequired: string;
    hasEnough: boolean;
  }> {
    const address = this.usdcTokenService.getServerWalletAddress();
    const balance = await this.usdcTokenService.getServerWalletMaticBalance();
    const minRequired = '0.01';
    const hasEnough = parseFloat(balance) >= parseFloat(minRequired);

    return {
      address,
      balance,
      balanceFormatted: `${balance} MATIC`,
      minRequired,
      hasEnough,
    };
  }

  @Get('usdc/gas-estimate')
  @ApiOperation({
    summary: 'Estimate gas fees for USDC transfer',
    description: 'Estimates the gas fees (in MATIC and USD equivalent) for transferring USDC',
  })
  @ApiResponse({
    status: 200,
    description: 'Gas estimate retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        estimatedGasMatic: { type: 'string' },
        estimatedGasUsd: { type: 'string' },
        gasPriceGwei: { type: 'string' },
        note: { type: 'string' },
      },
    },
  })
  async getGasEstimate(): Promise<{
    estimatedGasMatic: string;
    estimatedGasUsd: string;
    gasPriceGwei: string;
    note: string;
  }> {
    return this.usdcTokenService.estimateGasFees();
  }
}
