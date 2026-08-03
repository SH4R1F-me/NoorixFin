/**
 * Transaction DTOs — Blueprint §5.4, §8.1, §8.2, §8.3
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  IsUUID,
  Length,
  IsDateString,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Create Transaction (Simple Form) ─────────────────
export class CreateTransactionDto {
  @ApiProperty({
    example: 'EXPENSE',
    enum: ['INCOME', 'EXPENSE', 'TRANSFER'],
  })
  @IsString()
  @IsIn(['INCOME', 'EXPENSE', 'TRANSFER'])
  type!: string;

  @ApiProperty({
    example: '125000',
    description: 'Amount in minor units as decimal string (e.g., "125000" = ৳1,250.00)',
  })
  @IsString()
  amount!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Primary account ID',
  })
  @IsUUID()
  account_id!: string;

  @ApiPropertyOptional({
    description: 'Category account ID (for income/expense) or destination account (for transfer)',
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Destination account ID (for transfers)',
  })
  @IsOptional()
  @IsUUID()
  transfer_to_account_id?: string;

  @ApiPropertyOptional({ example: '2026-08-01T12:00:00Z' })
  @IsOptional()
  @IsDateString()
  occurred_at?: string;

  @ApiPropertyOptional({ example: 'Grocery store' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  payee?: string;

  @ApiPropertyOptional({ example: 'Weekly groceries' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;

  @ApiPropertyOptional({ example: ['groceries', 'weekly'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'Client-generated idempotency key (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  idempotency_key!: string;
}

// ─── Transaction Response ─────────────────────────────
export class TransactionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspace_id!: string;
  @ApiProperty() entry_type!: string;
  @ApiProperty() occurred_at!: string;
  @ApiProperty() local_date!: string;
  @ApiPropertyOptional() payee?: string;
  @ApiPropertyOptional() note?: string;
  @ApiProperty() status!: string;
  @ApiProperty() source!: string;
  @ApiProperty() created_by!: string;
  @ApiProperty() version!: number;
  @ApiProperty() created_at!: string;
  @ApiPropertyOptional() postings?: PostingResponseDto[];
}

export class PostingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() ledger_account_id!: string;
  @ApiProperty() debit_minor!: string;
  @ApiProperty() credit_minor!: string;
  @ApiProperty() currency_code!: string;
}
