/**
 * Admin DTOs — DEC-016
 *
 * Note what is absent from every response type here: there is no amount, payee,
 * note or memo field anywhere. That is the contract, not an oversight. See
 * `admin_user_overview()` in migration 00013 for the database-side half.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const SYSTEM_EVENT_LEVELS = [
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL',
] as const;

// ─── Queries ────────────────────────────────────────────────────────────────

export class ListEventsQueryDto {
  @ApiPropertyOptional({ enum: SYSTEM_EVENT_LEVELS })
  @IsOptional()
  @IsIn(SYSTEM_EVENT_LEVELS)
  level?: string;

  @ApiPropertyOptional({ example: 'api' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  source?: string;

  @ApiPropertyOptional({
    description: 'Free-text match on message or event code',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  q?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp lower bound' })
  @IsOptional()
  @IsISO8601()
  since?: string;

  @ApiPropertyOptional({
    description:
      'Return only events with id greater than this — the live-tail cursor',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterId?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ListAuditQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  resourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(36, 36)
  actorId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Matches email or display name' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'PENDING_DELETION'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION'])
  status?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

// ─── User management ────────────────────────────────────────────────────────

/**
 * The operator-editable subset of a profile.
 *
 * This class IS the allowlist. `forbidNonWhitelisted: true` in main.ts means a
 * request carrying `is_super_admin`, `status`, or any ledger field is rejected
 * with 400 rather than silently ignored — a silent ignore is how a privilege
 * escalation gets shipped believing it was blocked.
 *
 * Notably absent: `is_super_admin`. Promotion is not a console action; it is a
 * deliberate, service-role-only SQL operation (DEC-013) so that granting
 * platform access always leaves a psql-shaped footprint.
 */
export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'Sharif' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  display_name?: string;

  @ApiPropertyOptional({ enum: ['bn', 'en'] })
  @IsOptional()
  @IsIn(['bn', 'en'])
  locale?: string;

  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;
}

export class SuspendUserDto {
  @ApiProperty({ example: 'Terms of service violation — ticket #412' })
  @IsString()
  @Length(3, 500)
  reason!: string;
}

// ─── Settings ───────────────────────────────────────────────────────────────

export class UpdateSettingDto {
  @ApiProperty({ example: 'maintenance_mode' })
  @IsString()
  @Length(1, 100)
  key!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'JSON value for the setting. Shape is per-key.',
    example: { enabled: false },
  })
  value!: Record<string, unknown>;
}

export class UpdateSettingsDto {
  @ApiProperty({ type: [UpdateSettingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSettingDto)
  settings!: UpdateSettingDto[];
}

export class SiteLogoUploadDto {
  @ApiProperty({ description: 'Base64-encoded PNG, JPEG, or WebP bytes' })
  @IsString()
  @Length(4, 2_800_000)
  content_base64!: string;
}

export class DonationPaymentMethodDto {
  @ApiProperty({ enum: ['paypal', 'bkash', 'bank', 'link'] })
  @IsIn(['paypal', 'bkash', 'bank', 'link'])
  method!: 'paypal' | 'bkash' | 'bank' | 'link';

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 160)
  account?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Length(1, 2048)
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 240)
  note?: string;
}

export class UpdateDonationOptionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiProperty()
  @IsString()
  @Length(0, 240)
  subtitle!: string;

  @ApiProperty()
  @IsString()
  @Length(0, 2000)
  description!: string;

  @ApiProperty({ type: [DonationPaymentMethodDto], maxItems: 10 })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DonationPaymentMethodDto)
  payment_methods!: DonationPaymentMethodDto[];
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export class UpdateMobileReleaseDto {
  @ApiProperty({ example: '1.4.2' })
  @Matches(SEMVER)
  latest_version!: string;

  @ApiProperty({ example: '1.2.0' })
  @Matches(SEMVER)
  min_version!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2048)
  ios_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2048)
  android_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2048)
  apk_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-fA-F0-9]{64}$|^$/)
  apk_sha256?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2048)
  release_notes_url?: string;

  @ApiProperty({ enum: ['COMING_SOON', 'LIVE'] })
  @IsIn(['COMING_SOON', 'LIVE'])
  ios_status!: 'COMING_SOON' | 'LIVE';

  @ApiProperty({ enum: ['COMING_SOON', 'LIVE'] })
  @IsIn(['COMING_SOON', 'LIVE'])
  android_status!: 'COMING_SOON' | 'LIVE';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  apk_size_bytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  released_at?: string;

  @ApiProperty({ example: '15.0' })
  @IsString()
  @Length(1, 20)
  ios_minimum!: string;

  @ApiProperty({ example: '8.0' })
  @IsString()
  @Length(1, 20)
  android_minimum!: string;
}

// ─── Broadcasts ─────────────────────────────────────────────────────────────

export class CreateBroadcastDto {
  @ApiProperty({ example: 'Scheduled maintenance' })
  @IsString()
  @Length(1, 200)
  title_en!: string;

  @ApiProperty({ example: 'নির্ধারিত রক্ষণাবেক্ষণ' })
  @IsString()
  @Length(1, 200)
  title_bn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  body_en?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  body_bn?: string;

  @ApiPropertyOptional({ enum: ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'])
  severity?: string;

  @ApiPropertyOptional({ enum: ['ALL', 'SUPER_ADMINS'] })
  @IsOptional()
  @IsIn(['ALL', 'SUPER_ADMINS'])
  audience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  link_url?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dismissible?: boolean;

  @ApiPropertyOptional({
    description: 'ISO timestamp; defaults to publish time',
  })
  @IsOptional()
  @IsISO8601()
  publish_at?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp; null means no expiry' })
  @IsOptional()
  @IsISO8601()
  expires_at?: string;
}

export class UpdateBroadcastDto extends CreateBroadcastDto {
  @ApiPropertyOptional({ example: 'Scheduled maintenance' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  declare title_en: string;

  @ApiPropertyOptional({ example: 'নির্ধারিত রক্ষণাবেক্ষণ' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  declare title_bn: string;
}

/**
 * Open a request-trace window — audit item 15.
 *
 * `minutes` is a request, not a command: `TracingService` clamps it to
 * MAX_TRACE_MINUTES, because "trace for 10000 minutes" is always-on wearing a
 * time limit and the point of the switch is that it cannot become permanent.
 */
export class EnableTracingDto {
  @ApiPropertyOptional({
    example: 15,
    description:
      'How long to trace for. Clamped server-side to at most 60 minutes.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  minutes?: number;
}
