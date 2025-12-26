import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService, SystemStatus, HealthCheck } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get system status' })
  @ApiResponse({ status: 200, description: 'System is running' })
  getStatus(): SystemStatus {
    return this.appService.getStatus();
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'All services are healthy' })
  @ApiResponse({ status: 503, description: 'One or more services are unhealthy' })
  async getHealth(): Promise<HealthCheck> {
    return this.appService.getHealth();
  }
}
