import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { QueryEventsDto } from './dto/query-events.dto';
import { EventListResponseDto, EventDetailResponseDto } from './dto/event-response.dto';
import { SyncResponseDto } from './dto/sync-response.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'List events',
    description: 'Retrieves a paginated list of synced events with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved successfully',
    type: EventListResponseDto,
  })
  async getEvents(@Query() query: QueryEventsDto): Promise<EventListResponseDto> {
    return this.eventsService.getEvents(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get event by ID',
    description: 'Retrieves details of a specific event including its markets',
  })
  @ApiParam({
    name: 'id',
    description: 'Event ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Event retrieved successfully',
    type: EventDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  async getEvent(@Param('id', ParseIntPipe) id: number): Promise<EventDetailResponseDto> {
    return this.eventsService.getEvent(id);
  }

  @Get(':eventId/markets')
  @ApiOperation({
    summary: 'Get markets for an event',
    description: 'Retrieves all markets associated with a specific event',
  })
  @ApiParam({
    name: 'eventId',
    description: 'Event ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Markets retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Event not found',
  })
  async getEventMarkets(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.eventsService.getEventMarkets(eventId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync events from Polymarket',
    description: 'Triggers a manual sync to fetch and update events and markets from Polymarket',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of events to sync',
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: 'Sync completed successfully',
    type: SyncResponseDto,
  })
  async syncEvents(@Query('limit') limit?: number): Promise<SyncResponseDto> {
    return this.eventsService.syncEvents(limit || 100);
  }
}
