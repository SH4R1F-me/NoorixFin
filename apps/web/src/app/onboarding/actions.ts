'use server';

/**
 * Onboarding writes — Blueprint §5.2.
 *
 * Every step persists as it is completed rather than everything landing at the
 * end. A user who abandons halfway keeps their language and currency, and comes
 * back to the step they stopped at instead of starting over — which is the
 * whole point of `profiles.onboarding_status` being a state machine rather
 * than a boolean.
 */
import { revalidatePath } from 'next/cache';
import { toMinorUnits } from '@noorixfin/money';
import { apiFetch, ApiError } from '../../lib/api-client';

export type OnboardingResult = { ok: true } | { ok: false; message: string };

function fail(error: unknown): OnboardingResult {
  if (error instanceof ApiError) return { ok: false, message: error.message };
  return { ok: false, message: 'Could not reach the API. Nothing was saved.' };
}

/** Step 1 — language. Also the first thing that writes to the state machine. */
export async function saveLanguage(locale: 'bn' | 'en'): Promise<OnboardingResult> {
  try {
    await apiFetch('/me/preferences', { method: 'PATCH', body: { locale } });
    await apiFetch('/me/onboarding', {
      method: 'PATCH',
      body: { onboarding_status: 'LANGUAGE_SELECTED' },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Step 2 — timezone, currency, week start (§5.2 step 3). */
export async function savePreferences(input: {
  displayName: string;
  timezone: string;
  currency: string;
  weekStartsOn: number;
}): Promise<OnboardingResult> {
  if (!input.displayName.trim()) {
    return { ok: false, message: 'Tell us what to call you.' };
  }

  try {
    await apiFetch('/me/preferences', {
      method: 'PATCH',
      body: {
        display_name: input.displayName.trim(),
        timezone: input.timezone,
        base_currency: input.currency,
        week_starts_on: input.weekStartsOn,
      },
    });
    await apiFetch('/me/onboarding', {
      method: 'PATCH',
      body: { onboarding_status: 'PREFERENCES_SET' },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Step 3 — persona (§5.2 step 4). */
export async function savePersona(
  persona: 'INDIVIDUAL' | 'STUDENT' | 'FREELANCER',
): Promise<OnboardingResult> {
  try {
    await apiFetch('/me/onboarding', {
      method: 'PATCH',
      body: { persona, onboarding_status: 'PERSONA_SELECTED' },
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Step 4 — first account and its opening balance (§5.2 steps 7–8).
 *
 * The opening balance is NOT a number stored on the account: the API posts a
 * balanced OPENING journal entry against an equity account, so the ledger
 * balances from the first day and the figure is derived like every other
 * balance (DEC-006). An account whose "starting balance" were a column would be
 * the second source of truth this codebase keeps refusing to create.
 */
export async function createFirstAccount(input: {
  workspaceId: string;
  name: string;
  subtype: string;
  accountClass: 'ASSET' | 'LIABILITY';
  currency: string;
  openingBalance: string;
}): Promise<OnboardingResult> {
  if (!input.name.trim()) return { ok: false, message: 'Give the account a name.' };

  let openingMinor: string | undefined;
  const raw = input.openingBalance.trim().replace(/,/g, '');
  if (raw !== '') {
    const major = Number(raw);
    if (!Number.isFinite(major) || major < 0) {
      return { ok: false, message: 'That is not a valid opening balance.' };
    }
    const minor = toMinorUnits(major, input.currency);
    if (!Number.isSafeInteger(minor)) {
      return { ok: false, message: 'That amount is too large.' };
    }
    openingMinor = String(minor);
  }

  try {
    await apiFetch(`/workspaces/${input.workspaceId}/accounts`, {
      method: 'POST',
      body: {
        name: input.name.trim(),
        class: input.accountClass,
        subtype: input.subtype,
        currency_code: input.currency,
        ...(openingMinor !== undefined ? { opening_balance: openingMinor } : {}),
      },
    });
    await apiFetch('/me/onboarding', {
      method: 'PATCH',
      body: { onboarding_status: 'FIRST_ACCOUNT_ADDED' },
    });
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Finish — or skip.
 *
 * Skipping marks COMPLETED rather than leaving the user mid-flow. A setup
 * wizard that reappears every time someone declines it is a nag, and the
 * dashboard's own empty states already guide a user who skipped.
 */
export async function completeOnboarding(): Promise<OnboardingResult> {
  try {
    await apiFetch('/me/onboarding', {
      method: 'PATCH',
      body: { onboarding_status: 'COMPLETED' },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
