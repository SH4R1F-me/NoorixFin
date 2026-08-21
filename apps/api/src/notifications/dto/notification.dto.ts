import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Tables } from '@noorixfin/db-types';

export const NOTIFICATION_CATEGORIES = [
  'security',
  'budget',
  'goal',
  'recurring',
  'transaction',
  'sync',
  'account',
  'system',
  'operator',
] as const;

export const NOTIFICATION_SEVERITIES = [
  'INFO',
  'SUCCESS',
  'WARNING',
  'CRITICAL',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];
export type NotificationRow = Tables<'notifications'>;

export class ListNotificationsDto {
  @ApiPropertyOptional({ enum: ['unread', 'all', 'archived'] })
  @IsOptional()
  @IsIn(['unread', 'all', 'archived'])
  status?: 'unread' | 'all' | 'archived';

  @ApiPropertyOptional({ enum: NOTIFICATION_CATEGORIES })
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: NotificationCategory;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous page',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class NotificationPreferenceDto {
  @ApiProperty({ enum: NOTIFICATION_CATEGORIES })
  @IsIn(NOTIFICATION_CATEGORIES)
  category!: NotificationCategory;

  @ApiProperty()
  @IsBoolean()
  in_app!: boolean;

  @ApiProperty()
  @IsBoolean()
  push!: boolean;

  @ApiProperty()
  @IsBoolean()
  email!: boolean;

  @ApiProperty({ enum: ['NONE', 'DAILY', 'WEEKLY'] })
  @IsIn(['NONE', 'DAILY', 'WEEKLY'])
  digest!: 'NONE' | 'DAILY' | 'WEEKLY';
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: [NotificationPreferenceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceDto)
  preferences!: NotificationPreferenceDto[];

  @ApiPropertyOptional({ type: String, example: '22:00', nullable: true })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quiet_hours_start?: string | null;

  @ApiPropertyOptional({ type: String, example: '07:00', nullable: true })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quiet_hours_end?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Asia/Riyadh', nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  quiet_hours_tz?: string | null;
}

export class ComposeNotificationDto {
  @ApiProperty({ enum: ['ALL', 'OPERATORS'] })
  @IsIn(['ALL', 'OPERATORS'])
  audience!: 'ALL' | 'OPERATORS';

  @ApiProperty({ enum: ['system', 'operator'] })
  @IsIn(['system', 'operator'])
  category!: 'system' | 'operator';

  @ApiProperty({ enum: NOTIFICATION_SEVERITIES })
  @IsIn(NOTIFICATION_SEVERITIES)
  severity!: NotificationSeverity;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title_en!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title_bn?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 4000)
  body_en!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 4000)
  body_bn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  @Matches(/^(?:\/(?!\/)|https?:\/\/)/i, {
    message: 'action_url must be an app-relative path or an http(s) URL',
  })
  action_url?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp; defaults to now' })
  @IsOptional()
  @IsISO8601()
  scheduled_for?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expires_at?: string;
}

export class NotificationTemplateDto {
  @ApiProperty({ example: 'planned-maintenance' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/)
  key!: string;

  @ApiProperty({ enum: NOTIFICATION_CATEGORIES })
  @IsIn(NOTIFICATION_CATEGORIES)
  category!: NotificationCategory;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title_en!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title_bn?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 4000)
  body_en!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 4000)
  body_bn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  @Matches(/^(?:\/(?!\/)|https?:\/\/)/i, {
    message: 'action_url must be an app-relative path or an http(s) URL',
  })
  action_url?: string;
}

export class TemplateIdDto {
  @IsUUID(4)
  id!: string;
}

/** Published response contracts; these mirror the RLS-filtered rows returned by the service. */
export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: NOTIFICATION_CATEGORIES })
  category!: NotificationCategory;
  @ApiProperty({ enum: NOTIFICATION_SEVERITIES })
  severity!: NotificationSeverity;
  @ApiProperty() title_en!: string;
  @ApiProperty({ type: String, nullable: true }) title_bn!: string | null;
  @ApiProperty() body_en!: string;
  @ApiProperty({ type: String, nullable: true }) body_bn!: string | null;
  @ApiProperty({ type: String, nullable: true }) action_url!: string | null;
  @ApiProperty({ type: String, nullable: true }) read_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) archived_at!: string | null;
  @ApiProperty() created_at!: string;
}

export class NotificationPageResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];
  @ApiProperty({ type: String, nullable: true }) next_cursor!: string | null;
  @ApiProperty() has_more!: boolean;
}

export class UnreadCountResponseDto {
  @ApiProperty({ minimum: 0 }) count!: number;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({ type: [NotificationPreferenceDto] })
  preferences!: NotificationPreferenceDto[];
  @ApiProperty({ type: String, nullable: true }) quiet_hours_start!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) quiet_hours_end!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) quiet_hours_tz!: string | null;
}

export class NotificationCampaignResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['ALL', 'OPERATORS'] }) audience!: string;
  @ApiProperty({ enum: NOTIFICATION_CATEGORIES })
  category!: NotificationCategory;
  @ApiProperty({ enum: NOTIFICATION_SEVERITIES })
  severity!: NotificationSeverity;
  @ApiProperty() title_en!: string;
  @ApiProperty({ type: String, nullable: true }) title_bn!: string | null;
  @ApiProperty() body_en!: string;
  @ApiProperty({ type: String, nullable: true }) body_bn!: string | null;
  @ApiProperty({ type: String, nullable: true }) action_url!: string | null;
  @ApiProperty() scheduled_for!: string;
  @ApiProperty({ type: String, nullable: true }) expires_at!: string | null;
  @ApiProperty({
    enum: ['DRAFT', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'],
  })
  status!: string;
  @ApiProperty() recipient_count!: number;
  @ApiProperty({ type: String, nullable: true }) error!: string | null;
  @ApiProperty() created_at!: string;
}

export class NotificationTemplateResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() category!: string;
  @ApiProperty() title_en!: string;
  @ApiProperty({ type: String, nullable: true }) title_bn!: string | null;
  @ApiProperty() body_en!: string;
  @ApiProperty({ type: String, nullable: true }) body_bn!: string | null;
  @ApiProperty({ type: String, nullable: true }) action_url!: string | null;
  @ApiProperty() updated_at!: string;
}

export class NotificationDeliveryStatsResponseDto {
  @ApiProperty() campaign_id!: string;
  @ApiProperty() total!: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
  })
  by_channel!: Record<string, Record<string, number>>;
}
