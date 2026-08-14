export interface SiteSettingsActorState {
  authenticated: boolean;
  isSuperAdmin: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION' | null;
  aal2: boolean;
}

export type SiteSettingsAuthorization = { allowed: true } | { allowed: false; error: string };

/** Pure decision table shared by the Server Actions and their negative tests. */
export function evaluateSiteSettingsAuthorization(
  actor: SiteSettingsActorState,
): SiteSettingsAuthorization {
  if (!actor.authenticated) {
    return { allowed: false, error: 'Authentication required.' };
  }
  if (!actor.isSuperAdmin || actor.status !== 'ACTIVE') {
    return {
      allowed: false,
      error: 'This operation requires an active super administrator.',
    };
  }
  if (!actor.aal2) {
    return { allowed: false, error: 'A verified second factor is required.' };
  }
  return { allowed: true };
}
