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
