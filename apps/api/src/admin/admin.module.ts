/**
 * Admin Module — DEC-016
 *
 * SupabaseModule and ObservabilityModule are both @Global, so this module needs
 * no imports; SuperAdminGuard is instantiated per-route by @UseGuards and
 * resolves its own dependencies from the injector.
 */
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReleasesModule } from '../releases/releases.module';

@Module({
  imports: [NotificationsModule, ReleasesModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    // Registered here rather than in AppModule despite being an APP_INTERCEPTOR
    // (which Nest applies globally either way). Placing it beside the routes it
    // governs is how the next person finds it: an interceptor that only ever
    // acts on @Idempotent() handlers, declared next to the only controller that
    // has any, cannot be mistaken for something the whole API depends on.
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AdminModule {}
