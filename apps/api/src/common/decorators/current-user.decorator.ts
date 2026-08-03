/**
 * @CurrentUser() decorator — extracts authenticated user from request.
 * Set by SupabaseAuthGuard after JWT verification.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  /** Supabase auth.users.id (UUID) */
  id: string;
  /** Email from JWT claims */
  email: string;
  /** Full decoded JWT payload */
  claims: Record<string, unknown>;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
