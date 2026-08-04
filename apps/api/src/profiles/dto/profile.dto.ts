/**
 * Profiles DTOs — Blueprint §9.2
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  Length,
  Matches,
} from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: 'bn', description: 'User locale: bn or en' })
  @IsOptional()
  @IsString()
  @IsIn(['bn', 'en'])
  locale?: string;

  @ApiPropertyOptional({
    example: 'Asia/Dhaka',
    description: 'IANA timezone name',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z_/]+$/, { message: 'Invalid timezone format' })
  timezone?: string;

  @ApiPropertyOptional({
    example: 'BDT',
    description: 'ISO 4217 currency code',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  base_currency?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Week start day: 0=Sun, 1=Mon, ..., 6=Sat',
  })
  @IsOptional()
  week_starts_on?: number;

  @ApiPropertyOptional({ description: 'Default privacy mode for amounts' })
  @IsOptional()
  @IsBoolean()
  amount_privacy_default?: boolean;

  @ApiPropertyOptional({ example: 'Sharif', description: 'Display name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  display_name?: string;
}

export class ProfileResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Sharif' })
  display_name!: string;

  @ApiPropertyOptional({ example: null })
  avatar_path?: string | null;

  @ApiProperty({ example: 'bn' })
  locale!: string;

  @ApiProperty({ example: 'Asia/Dhaka' })
  timezone!: string;

  @ApiProperty({ example: 'BDT' })
  base_currency!: string;

  @ApiProperty({ example: 0 })
  week_starts_on!: number;

  @ApiProperty({ example: false })
  amount_privacy_default!: boolean;

  @ApiProperty({ example: 'COMPLETE' })
  onboarding_status!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;
}
