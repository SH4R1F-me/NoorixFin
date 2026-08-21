/**
 * Transaction DTOs — Blueprint §5.4, §8.1, §8.2, §8.3
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ArrayMaxSize,
  IsUUID,
  Length,
  MaxLength,
  IsDateString,
  Matches,
} from 'class-validator';

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
    description:
      'Amount in minor units as decimal string (e.g., "125000" = ৳1,250.00)',
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
    description:
      'Category account ID (for income/expense) or destination account (for transfer)',
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

export class TagNameDto {
  @ApiProperty({
    example: 'travel',
    description: 'Canonical workspace tag name',
  })
  @IsString()
  @Length(1, 40)
  name!: string;
}

export class UpdateTransactionTagsDto {
  @ApiProperty({ type: [String], example: ['groceries', 'weekly'] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags!: string[];
}

export class CreateAttachmentDto {
  @ApiProperty({
    description:
      'A retry of the same receipt upload returns the original attachment',
  })
  @IsUUID()
  idempotency_key!: string;

  @ApiProperty({ example: 'receipt.jpg' })
  @IsString()
  @Length(1, 180)
  filename!: string;

  @ApiProperty({
    enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  })
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  content_type!: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

  @ApiProperty({
    description:
      'Base64 bytes without a data-URL prefix; maximum decoded size 5 MB',
  })
  @IsString()
  @MaxLength(7_000_000)
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/)
  data_base64!: string;
}

// ─── Transaction Response ─────────────────────────────
export class TransactionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspace_id!: string;
  @ApiProperty() entry_type!: string;
  @ApiProperty() occurred_at!: string;
  @ApiProperty() local_date!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) payee?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) note?: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() source!: string;
  @ApiProperty() created_by!: string;
  @ApiProperty() version!: number;
  @ApiProperty() created_at!: string;
  @ApiPropertyOptional({ type: () => [PostingResponseDto] })
  postings?: PostingResponseDto[];
  @ApiPropertyOptional({ type: () => [TransactionAttachmentResponseDto] })
  attachments?: TransactionAttachmentResponseDto[];
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
  @ApiPropertyOptional() reversed?: boolean;
  @ApiPropertyOptional() amount_minor?: number;
  @ApiPropertyOptional({ type: String, nullable: true }) currency_code?:
    string | null;
  @ApiPropertyOptional({ type: [String] }) ledger_account_ids?: string[];
}

export class TransactionListItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspace_id!: string;
  @ApiProperty() entry_type!: string;
  @ApiProperty() occurred_at!: string;
  @ApiProperty() local_date!: string;
  @ApiProperty({ type: String, nullable: true }) payee!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() source!: string;
  @ApiProperty() created_by!: string;
  @ApiProperty() version!: number;
  @ApiProperty() created_at!: string;
  @ApiProperty() amount_minor!: number;
  @ApiProperty({ type: String, nullable: true }) currency_code!: string | null;
  @ApiProperty({ type: [String] }) ledger_account_ids!: string[];
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ type: () => [TransactionAttachmentResponseDto] })
  attachments!: TransactionAttachmentResponseDto[];
  @ApiProperty() reversed!: boolean;
}

export class TransactionPageResponseDto {
  @ApiProperty({ type: [TransactionListItemResponseDto] })
  items!: TransactionListItemResponseDto[];
  @ApiProperty({ type: String, nullable: true }) next_cursor!: string | null;
  @ApiProperty() has_more!: boolean;
}

export class TransactionAttachmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() original_name!: string;
  @ApiProperty() content_type!: string;
  @ApiProperty() size_bytes!: number;
  @ApiProperty() created_at!: string;
}

export class PostingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() ledger_account_id!: string;
  @ApiProperty() debit_minor!: string;
  @ApiProperty() credit_minor!: string;
  @ApiProperty() currency_code!: string;
}

export class TagResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() usage_count!: number;
}

export class SignedAttachmentUrlResponseDto {
  @ApiProperty() url!: string;
  @ApiProperty() expires_in!: number;
}

export class DeletedAttachmentResponseDto {
  @ApiProperty() deleted!: boolean;
}

export class DeletedTagResponseDto {
  @ApiProperty() id!: string;
}
