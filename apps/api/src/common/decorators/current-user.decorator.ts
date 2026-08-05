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
    // `getRequest()` is generic and defaults to `any`, so both lines below used
    // to be unchecked. Naming the shape makes the contract with
    // SupabaseAuthGuard — which is what sets `user` — visible at the type level.
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
