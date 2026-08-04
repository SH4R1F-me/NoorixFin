/**
 * Workspace DTOs — Simplified (DEC-007)
 * Only PERSONAL workspaces, no invitations or member management.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length, Matches } from 'class-validator';

// ─── Create Workspace ────────────────────────────────────
export class CreateWorkspaceDto {
  @ApiProperty({ example: 'My Personal Finance' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ example: 'BDT' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  base_currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z_/]+$/)
  timezone?: string;
}

// ─── Workspace Response ──────────────────────────────────
export class WorkspaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['PERSONAL'] })
  type!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  base_currency!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  created_by!: string;

  @ApiProperty({ enum: ['ACTIVE', 'PENDING_DELETION', 'DELETED'] })
  status!: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  @ApiPropertyOptional({ description: 'Current user role (always OWNER)' })
  role?: string;
}
