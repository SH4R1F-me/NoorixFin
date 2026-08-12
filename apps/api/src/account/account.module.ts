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
import { ExportService } from './export.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AccountController, PublicSettingsController],
  providers: [AccountService, ExportService],
})
export class AccountModule {}
