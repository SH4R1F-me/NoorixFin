/**
 * Devices Controller — gap S2 (session/device management).
 *
 * User-facing: a user sees and manages only their own devices.
 * Admin-facing revocation is in AdminController.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { DevicesService } from './devices.service';
import {
  ConsumePairingDto,
  CreatePairingDto,
  RegisterDeviceDto,
  RevokeAllDto,
  DeviceResponseDto,
  PairedWorkspaceResponseDto,
  PairingTokenResponseDto,
  RevokedResponseDto,
} from './dto/device.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { ClientContextRequest } from '../common/middleware/client-context.middleware';

type AuthedRequest = Request & { accessToken: string };

@ApiTags('Devices & Sessions')
@ApiBearerAuth()
@Controller('me/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'List active devices for the current user' })
  @ApiOkResponse({
    description: 'Active sessions across all platforms',
    type: [DeviceResponseDto],
  })
  list(@Req() req: AuthedRequest) {
    return this.devices.listDevices(req.accessToken);
  }

  @Post()
  @ApiOperation({
    summary: 'Register or update a device (upsert on device_id)',
  })
  register(
    @Req() req: AuthedRequest & ClientContextRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devices.registerDevice(
      req.accessToken,
      user.id,
      dto,
      req.clientContext,
    );
  }

  @Post('pairing')
  @ApiCreatedResponse({ type: PairingTokenResponseDto })
  @ApiOperation({
    summary: 'Issue a ten-minute, one-time mobile workspace pairing token',
  })
  createPairing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePairingDto,
  ) {
    return this.devices.createPairing(user.id, dto.workspaceId);
  }

  @Post('pairing/consume')
  @ApiCreatedResponse({ type: PairedWorkspaceResponseDto })
  @ApiOperation({
    summary: 'Consume a pairing token after signing in on mobile',
  })
  consumePairing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConsumePairingDto,
  ) {
    return this.devices.consumePairing(user.id, dto.token);
  }

  @Delete('current/:opaqueDeviceId')
  @ApiOkResponse({ type: RevokedResponseDto })
  @ApiOperation({
    summary: 'Revoke the caller device by its app-generated device_id',
  })
  revokeCurrent(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Param('opaqueDeviceId', ParseUUIDPipe) opaqueDeviceId: string,
  ) {
    return this.devices.revokeCurrentDevice(
      req.accessToken,
      user.id,
      opaqueDeviceId,
    );
  }

  @Delete(':deviceId')
  @ApiOkResponse({ type: RevokedResponseDto })
  @ApiOperation({
    summary: 'Revoke a specific device / sign out of that session',
  })
  revoke(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.devices.revokeDevice(req.accessToken, user.id, deviceId);
  }

  @Post('revoke-all')
  @ApiOkResponse({ type: RevokedResponseDto })
  @ApiOperation({ summary: 'Sign out of all other devices' })
  revokeAll(
    @Req() req: AuthedRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RevokeAllDto,
  ) {
    return this.devices.revokeAllOtherDevices(
      req.accessToken,
      user.id,
      dto.currentDeviceId ?? null,
    );
  }
}
