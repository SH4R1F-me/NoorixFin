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
  ApiOperation,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, RevokeAllDto } from './dto/device.dto';
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
  @ApiOkResponse({ description: 'Active sessions across all platforms' })
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

  @Delete('current/:opaqueDeviceId')
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
