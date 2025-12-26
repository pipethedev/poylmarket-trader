import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MarketsService } from './markets.service';
import { QueryMarketsDto } from './dto/query-markets.dto';
import { MarketListResponseDto, MarketDetailResponseDto } from './dto/market-response.dto';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get()
  @ApiOperation({
    summary: 'List markets',
    description: 'Retrieves a paginated list of markets with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Markets retrieved successfully',
    type: MarketListResponseDto,
  })
  async getMarkets(@Query() query: QueryMarketsDto): Promise<MarketListResponseDto> {
    return this.marketsService.getMarkets(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get market by ID',
    description: 'Retrieves details of a specific market including its tokens',
  })
  @ApiParam({
    name: 'id',
    description: 'Market ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Market retrieved successfully',
    type: MarketDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Market not found',
  })
  async getMarket(@Param('id', ParseIntPipe) id: number): Promise<MarketDetailResponseDto> {
    return this.marketsService.getMarket(id);
  }
}
