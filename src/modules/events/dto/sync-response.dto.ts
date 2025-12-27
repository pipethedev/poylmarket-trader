import { ApiProperty } from '@nestjs/swagger';

export class SyncResponseDto {
  @ApiProperty({
    description: 'Message describing the sync operation status',
    example: 'Sync job has been queued and will be processed in the background',
  })
  message: string;
}
