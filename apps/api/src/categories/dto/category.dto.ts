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
  @ApiProperty({ description: 'Category name', example: 'Food & Dining' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({
    description: 'Category type',
    enum: ['INCOME', 'EXPENSE'],
  })
  @IsIn(['INCOME', 'EXPENSE'])
  type!: string;

  @ApiPropertyOptional({ description: 'Translation key for system categories' })
  @IsOptional()
  @IsString()
  translation_key?: string;

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
export class CategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspace_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type!: string;
  @ApiPropertyOptional() translation_key?: string;
  @ApiPropertyOptional() icon?: string;
  @ApiPropertyOptional() color?: string;
  @ApiPropertyOptional() parent_id?: string;
  @ApiProperty() is_system!: boolean;
  @ApiProperty() sort_order!: number;
  @ApiProperty() created_at!: string;
}
