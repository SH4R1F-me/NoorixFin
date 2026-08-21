/**
 * Sync DTOs — DEC-010, DEC-011
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsISO8601,
  IsInt,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SyncQueryDto {
  @ApiPropertyOptional({
    description:
      'Deprecated timestamp cursor accepted from pre-v1 clients. New clients use cursor.',
    example: '2026-08-04T10:15:00.000Z',
    deprecated: true,
  })
  @IsOptional()
  @IsISO8601()
  since?: string;

  @ApiPropertyOptional({
    description:
      'Opaque versioned cursor containing an independent (updated_at, stable primary key) position for every sync source.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16_384)
  cursor?: string;

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
      'Opaque versioned cursor to pass as `cursor` on the next pull. It safely advances every source independently.',
  })
  cursor!: string;

  @ApiProperty({
    description:
      'True if any source exceeded the page limit. Call again with the returned cursor to drain the remainder.',
  })
  has_more!: boolean;

  @ApiProperty({
    description: 'Server time when this delta was computed (ISO-8601).',
  })
  server_time!: string;

  @ApiProperty({ description: 'Changed rows per table, keyed by table name.' })
  changes!: Record<string, unknown[]>;
}
