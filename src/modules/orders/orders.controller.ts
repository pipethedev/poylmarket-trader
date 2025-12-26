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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiSecurity,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderResponseDto, OrderListResponseDto } from './dto/order-response.dto';
import { IdempotencyInterceptor } from '@common/interceptors/idempotency.interceptor';
import { Idempotent } from '@common/decorators/idempotency.decorator';
import { IdempotencyKeyRequiredException } from '@common/exceptions';

@ApiTags('orders')
@Controller('orders')
@UseInterceptors(IdempotencyInterceptor)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Idempotent({ expiresInSeconds: 86400 })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new order and queues it for processing. Requires an Idempotency-Key header.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key to ensure idempotent order creation',
    required: true,
    example: 'order-123-abc',
  })
  @ApiSecurity('Idempotency-Key')
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
    description:
      'Idempotency key conflict - request is being processed or has different parameters',
  })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
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
}
