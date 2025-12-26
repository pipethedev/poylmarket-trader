import { ApiProperty } from '@nestjs/swagger';

export class SyncResponseDto {
  @ApiProperty({
    description: 'Number of events created',
    example: 5,
  })
  eventsCreated: number;

  @ApiProperty({
    description: 'Number of events updated',
    example: 10,
  })
  eventsUpdated: number;

  @ApiProperty({
    description: 'Number of markets created',
    example: 15,
  })
  marketsCreated: number;

  @ApiProperty({
    description: 'Number of markets updated',
    example: 25,
  })
  marketsUpdated: number;

  @ApiProperty({
    description: 'Number of tokens created',
    example: 30,
  })
  tokensCreated: number;

  @ApiProperty({
    description: 'Number of tokens updated',
    example: 50,
  })
  tokensUpdated: number;

  @ApiProperty({
    description: 'List of errors encountered during sync',
    example: [],
    type: [String],
  })
  errors: string[];
}
