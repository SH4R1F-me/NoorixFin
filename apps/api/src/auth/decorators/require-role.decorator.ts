/**
 * @RequireSuperAdmin() decorator — marks route as super-admin only.
 * Used with SuperAdminGuard.
 *
 * Usage: @RequireSuperAdmin()
 *
 * NOTE: @RequireRole() is no longer needed since all workspace members
 * are OWNER under the simplified 2-role system (DEC-007).
 */
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SUPER_ADMIN_KEY = 'requireSuperAdmin';
export const RequireSuperAdmin = () =>
  SetMetadata(REQUIRE_SUPER_ADMIN_KEY, true);
