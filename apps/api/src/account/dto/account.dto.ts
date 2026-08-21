/**
 * Account lifecycle DTOs — DEC-017
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class RequestDeletionDto {
  @ApiProperty({
    description:
      "Must exactly equal the signed-in account's email address. A typed " +
      'confirmation, so an accidental or CSRF-driven POST cannot schedule the ' +
      'deletion of an entire ledger.',
    example: 'me@example.com',
  })
  @IsEmail()
  @Length(3, 320)
  confirm_email!: string;

  @ApiProperty({
    description: 'Optional free-text reason, retained on the audit event.',
    required: false,
    example: 'No longer needed',
  })
  @IsString()
  @Length(0, 500)
  reason: string = '';
}

export class DeletionScheduledResponseDto {
  @ApiProperty({ enum: ['PENDING_DELETION'] }) status!: string;
  @ApiProperty() deletion_scheduled_for!: string;
  @ApiProperty() grace_days!: number;
}

export class AccountStatusResponseDto {
  @ApiProperty({ enum: ['ACTIVE'] }) status!: string;
}

export class DataExportArtifactResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['PROCESSING', 'READY', 'FAILED', 'EXPIRED'] })
  status!: string;
  @ApiProperty({ enum: ['ndjson-v1'] }) format!: string;
  @ApiProperty() size_bytes!: number;
  @ApiProperty() row_count!: number;
  @ApiProperty({ type: String, nullable: true }) checksum_sha256!:
    string | null;
  @ApiProperty() expires_at!: string;
  @ApiProperty() created_at!: string;
  @ApiProperty({ type: String, nullable: true }) completed_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) download_url!: string | null;
}

export class DataExportDeletedResponseDto {
  @ApiProperty() deleted!: boolean;
}

export class BroadcastResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] })
  severity!: string;
  @ApiProperty() title_en!: string;
  @ApiProperty() title_bn!: string;
  @ApiProperty() body_en!: string;
  @ApiProperty() body_bn!: string;
  @ApiProperty({ type: String, nullable: true }) link_url!: string | null;
  @ApiProperty() dismissible!: boolean;
  @ApiProperty({ type: String, nullable: true }) publish_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) expires_at!: string | null;
}

export class DismissedResponseDto {
  @ApiProperty() dismissed!: boolean;
}

export class MaintenanceSettingResponseDto {
  @ApiProperty() enabled!: boolean;
  @ApiProperty() message_en!: string;
  @ApiProperty() message_bn!: string;
}

export class EnabledSettingResponseDto {
  @ApiProperty() enabled!: boolean;
}

export class ValueSettingResponseDto {
  @ApiProperty() value!: string;
}

export class PublicSettingsResponseDto {
  @ApiPropertyOptional({ type: MaintenanceSettingResponseDto })
  maintenance_mode?: MaintenanceSettingResponseDto;
  @ApiPropertyOptional({ type: EnabledSettingResponseDto })
  signups_enabled?: EnabledSettingResponseDto;
  @ApiPropertyOptional({ type: ValueSettingResponseDto })
  app_version?: ValueSettingResponseDto;
  @ApiPropertyOptional({ type: ValueSettingResponseDto })
  donation_url?: ValueSettingResponseDto;
  @ApiPropertyOptional({ type: ValueSettingResponseDto })
  support_email?: ValueSettingResponseDto;
}
