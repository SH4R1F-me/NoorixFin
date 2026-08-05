/**
 * Account Module — DEC-017
 * User-facing account lifecycle, broadcasts, and public settings.
 */
import { Module } from '@nestjs/common';
import {
  AccountController,
  PublicSettingsController,
} from './account.controller';
import { AccountService } from './account.service';

@Module({
  controllers: [AccountController, PublicSettingsController],
  providers: [AccountService],
})
export class AccountModule {}
