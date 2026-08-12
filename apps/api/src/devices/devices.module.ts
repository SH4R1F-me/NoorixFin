import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
