import { Module } from '@nestjs/common';
import {
  AdminNotificationsController,
  NotificationsController,
  NotificationPreferencesController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [
    NotificationsController,
    NotificationPreferencesController,
    AdminNotificationsController,
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
