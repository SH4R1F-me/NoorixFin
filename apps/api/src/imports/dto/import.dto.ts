import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateImportDto {
  @ApiProperty({ enum: ['CSV', 'OFX', 'QIF'] })
  @IsIn(['CSV', 'OFX', 'QIF'])
  format!: 'CSV' | 'OFX' | 'QIF';

  @ApiProperty({ description: 'UTF-8 file content; maximum 5 MB' })
  @IsString()
  @MaxLength(5_000_000)
  content!: string;

  @ApiProperty({ example: 'statement.csv' })
  @IsString()
  @Length(1, 180)
  filename!: string;

  @ApiProperty({
    description: 'Account affected by every imported statement row',
  })
  @IsUUID()
  account_id!: string;

  @ApiProperty({ description: 'Default category for negative/expense rows' })
  @IsUUID()
  expense_category_id!: string;

  @ApiPropertyOptional({
    description: 'Default category for positive/income rows',
  })
  @IsOptional()
  @IsUUID()
  income_category_id?: string;

  @ApiProperty({
    description: 'A retry of this import returns the original job',
  })
  @IsUUID()
  idempotency_key!: string;
}

export class ImportRowResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() row_number!: number;
  @ApiProperty({ type: 'object', additionalProperties: true })
  normalized_payload!: Record<string, unknown>;
  @ApiProperty({
    enum: [
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'COMPLETED_WITH_ERRORS',
      'FAILED',
    ],
  })
  status!: string;
  @ApiProperty({ type: String, nullable: true }) error_message!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) journal_entry_id!:
    string | null;
}

export class ImportJobResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['CSV', 'OFX', 'QIF'] }) format!: string;
  @ApiProperty() filename!: string;
  @ApiProperty({
    enum: [
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'COMPLETED_WITH_ERRORS',
      'FAILED',
    ],
  })
  status!: string;
  @ApiProperty() total_rows!: number;
  @ApiProperty() imported_rows!: number;
  @ApiProperty() failed_rows!: number;
  @ApiProperty({ type: String, nullable: true }) error_message!: string | null;
  @ApiProperty() created_at!: string;
  @ApiProperty({ type: String, nullable: true }) completed_at!: string | null;
  @ApiPropertyOptional({ type: [ImportRowResponseDto] })
  rows?: ImportRowResponseDto[];
}
