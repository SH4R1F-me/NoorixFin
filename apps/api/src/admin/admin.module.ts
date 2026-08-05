/**
 * Admin Module — DEC-016
 *
 * SupabaseModule and ObservabilityModule are both @Global, so this module needs
 * no imports; SuperAdminGuard is instantiated per-route by @UseGuards and
 * resolves its own dependencies from the injector.
 */
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
