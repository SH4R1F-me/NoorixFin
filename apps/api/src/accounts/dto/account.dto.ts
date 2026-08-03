/**
 * Account DTOs — Blueprint §9.3
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  Length,
  IsDateString,
} from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'Cash in Hand' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({
    example: 'ASSET',
    enum: ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'],
  })
  @IsString()
  @IsIn(['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'])
  class!: string;

  @ApiProperty({
    example: 'CASH',
    enum: ['CASH', 'BANK', 'MOBILE_WALLET', 'CREDIT_CARD', 'LOAN', 'SAVINGS', 'CATEGORY', 'SYSTEM'],
  })
  @IsString()
  @IsIn(['CASH', 'BANK', 'MOBILE_WALLET', 'CREDIT_CARD', 'LOAN', 'SAVINGS', 'CATEGORY', 'SYSTEM'])
  subtype!: string;

  @ApiPropertyOptional({ example: 'BDT' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency_code?: string;

  @ApiPropertyOptional({ example: 'DEBIT', enum: ['DEBIT', 'CREDIT'] })
  @IsOptional()
  @IsString()
  @IsIn(['DEBIT', 'CREDIT'])
  normal_balance?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  include_in_budget?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  include_in_net_worth?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  opening_date?: string;

  @ApiPropertyOptional({
    example: '50000',
    description: 'Opening balance as minor-unit decimal string (e.g., "50000" = 500.00 BDT)',
  })
  @IsOptional()
  @IsString()
  opening_balance?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Updated Account Name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  include_in_budget?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  include_in_net_worth?: boolean;

  @ApiPropertyOptional({
    description: 'Set to true to archive the account',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class AccountResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workspace_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() class!: string;
  @ApiProperty() subtype!: string;
  @ApiProperty() currency_code!: string;
  @ApiProperty() normal_balance!: string;
  @ApiProperty() include_in_budget!: boolean;
  @ApiProperty() include_in_net_worth!: boolean;
  @ApiPropertyOptional() opening_date?: string;
  @ApiPropertyOptional() archived_at?: string | null;
  @ApiProperty() created_by!: string;
  @ApiProperty() version!: number;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
}
