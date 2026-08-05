/**
 * Sync DTOs — DEC-010, DEC-011
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsISO8601, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncQueryDto {
  @ApiPropertyOptional({
    description:
      'ISO-8601 timestamp cursor. Returns rows with updated_at > since. Omit for a full initial pull.',
    example: '2026-08-04T10:15:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  since?: string;

  @ApiPropertyOptional({
    description:
      'Max rows per table in one page. The response says whether more remain.',
    default: 500,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

export class SyncResponseDto {
  @ApiProperty({
    description:
      'Cursor to pass as `since` on the next pull. Advance it ONLY when has_more is false — ' +
      'see the partial-page note in the service.',
  })
  cursor!: string;

  @ApiProperty({
    description:
      'True if any table hit the row limit. Call again with the same cursor to drain the remainder.',
  })
  has_more!: boolean;

  @ApiProperty({
    description: 'Server time when this delta was computed (ISO-8601).',
  })
  server_time!: string;

  @ApiProperty({ description: 'Changed rows per table, keyed by table name.' })
  changes!: Record<string, unknown[]>;
}
