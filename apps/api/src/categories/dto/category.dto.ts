/**
 * Category DTOs — Blueprint §9.3
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsUUID,
  Length,
} from 'class-validator';

// ─── Create ─────────────────────────────────────────────
export class CreateCategoryDto {
  @ApiProperty({
    description: 'Display name. Stored as `custom_name`; also names the backing ledger account.',
    example: 'Food & Dining',
  })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({
    description: 'Category kind — matches the backing ledger account class',
    enum: ['INCOME', 'EXPENSE'],
  })
  @IsIn(['INCOME', 'EXPENSE'])
  kind!: 'INCOME' | 'EXPENSE';

  // `translation_key` is deliberately NOT accepted from clients: it identifies a
  // system catalogue entry (DEC-015) and is assigned only by seeding. A
  // user-created category carries `custom_name` instead.

  @ApiPropertyOptional({ description: 'Emoji icon', example: '🍕' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    description: 'Hex color for the category',
    example: '#10b981',
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchy',
  })
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional({
    description: 'Sort order within siblings',
    example: 0,
  })
  @IsOptional()
  sort_order?: number;
}

// ─── Update ─────────────────────────────────────────────
export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  sort_order?: number;

  @ApiPropertyOptional({ description: 'Archive this category' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

// ─── Response ───────────────────────────────────────────
// Mirrors the real `categories` columns. Note what is NOT here:
//   `name`      — display name is `custom_name ?? t(translation_key)`, resolved
//                 by the client so the same row renders in bn or en
//   `is_system` — a category is system-provided iff `translation_key` is set
//   `type`      — the column is `kind`
export class CategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspace_id!: string;

  @ApiProperty({ description: 'Backing ledger account. Postings reference THIS, not `id`.' })
  ledger_account_id!: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] }) kind!: string;

  @ApiPropertyOptional({
    description: 'Set for system categories. Translate it for display; also marks the row as system-provided.',
    example: 'cat.food_dining',
  })
  translation_key?: string | null;

  @ApiPropertyOptional({ description: 'User-supplied name. Overrides translation_key when present.' })
  custom_name?: string | null;

  @ApiPropertyOptional() parent_id?: string | null;
  @ApiProperty() icon!: string;
  @ApiProperty() color!: string;
  @ApiProperty() sort_order!: number;
  @ApiPropertyOptional() archived_at?: string | null;
  @ApiPropertyOptional() deleted_at?: string | null;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
}
