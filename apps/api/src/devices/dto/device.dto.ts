import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({
    description:
      'Opaque app-generated UUID stored in SecureStore/sessionStorage',
  })
  @IsUUID(4)
  deviceId!: string;

  @ApiPropertyOptional({
    description: 'User-editable device label, e.g. "Sharif\'s Pixel"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceName?: string;

  @ApiPropertyOptional({
    description: 'Push token or serialized Web Push subscription',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  pushToken?: string;

  @ApiPropertyOptional({ enum: ['expo', 'fcm', 'apns', 'webpush'] })
  @IsOptional()
  @IsEnum(['expo', 'fcm', 'apns', 'webpush'])
  pushProvider?: 'expo' | 'fcm' | 'apns' | 'webpush';
}

export class RevokeAllDto {
  @ApiPropertyOptional({
    description: "Keep this device_id active (the caller's own device)",
  })
  @IsOptional()
  @IsUUID(4)
  currentDeviceId?: string;
}

export class CreatePairingDto {
  @ApiProperty()
  @IsUUID(4)
  workspaceId!: string;
}

export class ConsumePairingDto {
  @ApiProperty({ description: 'One-time token read from the pairing QR code' })
  @IsString()
  @MaxLength(256)
  token!: string;
}

export class DeviceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() device_id!: string;
  @ApiProperty({ enum: ['web', 'ios', 'android'] }) platform!:
    'web' | 'ios' | 'android';
  @ApiProperty({ type: String, nullable: true }) device_name!: string | null;
  @ApiProperty({ type: String, nullable: true }) os_version!: string | null;
  @ApiProperty({ type: String, nullable: true }) app_version!: string | null;
  @ApiProperty() last_seen_at!: string;
  @ApiProperty({ type: String, nullable: true }) last_ip!: string | null;
  @ApiProperty() first_seen_at!: string;
  @ApiProperty({ type: String, nullable: true }) revoked_at!: string | null;
}

export class PairingTokenResponseDto {
  @ApiProperty() token!: string;
  @ApiProperty() expires_at!: string;
}

export class PairedWorkspaceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ minLength: 3, maxLength: 3 }) base_currency!: string;
}

export class RevokedResponseDto {
  @ApiProperty() revoked!: boolean;
}
