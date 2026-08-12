import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Opaque app-generated UUID stored in SecureStore/sessionStorage' })
  @IsUUID(4)
  deviceId!: string;

  @ApiPropertyOptional({ description: 'User-editable device label, e.g. "Sharif\'s Pixel"' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Push notification token (Phase 5)' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  pushToken?: string;

  @ApiPropertyOptional({ enum: ['expo', 'fcm', 'apns', 'webpush'] })
  @IsOptional()
  @IsEnum(['expo', 'fcm', 'apns', 'webpush'])
  pushProvider?: 'expo' | 'fcm' | 'apns' | 'webpush';
}

export class RevokeAllDto {
  @ApiPropertyOptional({ description: 'Keep this device_id active (the caller\'s own device)' })
  @IsOptional()
  @IsUUID(4)
  currentDeviceId?: string;
}
