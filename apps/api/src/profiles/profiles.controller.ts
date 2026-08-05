/**
 * Profiles Controller — Blueprint §11.2
 * GET /v1/me — current user profile
 * PATCH /v1/me/preferences — update locale, timezone, currency, etc.
 */
import { Controller, Get, Patch, Body, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ProfilesService } from './profiles.service';
import {
  UpdatePreferencesDto,
  UpdateOnboardingDto,
  ProfileResponseDto,
} from './dto/profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Profile')
@ApiBearerAuth('supabase-auth')
@Controller('me')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: ProfileResponseDto })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.profilesService.getOrCreateProfile(
      user.id,
      user.email,
      req.accessToken,
    );
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiOkResponse({ type: ProfileResponseDto })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.profilesService.updatePreferences(
      user.id,
      req.accessToken,
      dto,
    );
  }

  @Patch('onboarding')
  @ApiOperation({
    summary: 'Advance the §5.2 onboarding state machine',
    description:
      'Separate from /me/preferences: preferences are freely editable, this is ' +
      'a monotonic progression. Moving backwards is silently ignored so a ' +
      'reloaded step cannot drag a finished user back into onboarding.',
  })
  @ApiOkResponse({ type: ProfileResponseDto })
  async updateOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request & { accessToken: string },
    @Body() dto: UpdateOnboardingDto,
  ) {
    return this.profilesService.updateOnboarding(user.id, req.accessToken, dto);
  }
}
