/**
 * Profiles Service — Blueprint §9.2
 * Handles profile CRUD and auto-creation on first authenticated request.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdatePreferencesDto, UpdateOnboardingDto } from './dto/profile.dto';

/**
 * The §5.2 flow, in order. Index position IS the rank.
 *
 * Kept as an ordered list rather than a set so the service can refuse to move a
 * user BACKWARDS. Without that, a stale browser tab replaying an early step
 * would drop a finished user back into onboarding — the state machine is
 * monotonic by intent and nothing else was enforcing it.
 */
const ONBOARDING_ORDER = [
  'LANGUAGE_SELECTED',
  'ACCOUNT_CREATED',
  'PREFERENCES_SET',
  'PERSONA_SELECTED',
  'WORKSPACE_CREATED',
  'FIRST_ACCOUNT_ADDED',
  'COMPLETED',
] as const;

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get or create profile for the authenticated user.
   * Auto-creates profile on first access per blueprint trigger.
   */
  async getOrCreateProfile(userId: string, email: string, accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);

    // Try to get existing profile
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      return { ...profile, email };
    }

    // Profile doesn't exist (might not have been created by trigger yet)
    if (error && error.code === 'PGRST116') {
      // Create profile
      const newProfile = {
        id: userId,
        display_name: email.split('@')[0],
        locale: 'bn',
        timezone: 'Asia/Dhaka',
        base_currency: 'BDT',
        week_starts_on: 0,
        amount_privacy_default: false,
        // Was 'PENDING', which is not in profiles_onboarding_status_check —
        // this insert could only ever have failed with a 23514. It is reachable
        // when handle_new_user() did not run (a user row created outside the
        // signup path, e.g. the bootstrap script), which is exactly the case
        // the admin console surfaces.
        onboarding_status: 'ACCOUNT_CREATED',
      };

      const { data: created, error: createError } = await client
        .from('profiles')
        .upsert(newProfile, { onConflict: 'id' })
        .select()
        .single();

      if (createError) {
        this.logger.error(
          `Failed to create profile for ${userId}: ${createError.message}`,
        );
        throw new Error('Failed to create profile');
      }

      return { ...created, email };
    }

    if (error) {
      this.logger.error(
        `Failed to get profile for ${userId}: ${error.message}`,
      );
      throw new NotFoundException('Profile not found');
    }

    return { ...profile, email };
  }

  /**
   * Update profile preferences.
   */
  async updatePreferences(
    userId: string,
    accessToken: string,
    dto: UpdatePreferencesDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    // Build update payload (only non-undefined fields)
    const updatePayload: Record<string, unknown> = {};
    if (dto.locale !== undefined) updatePayload.locale = dto.locale;
    if (dto.timezone !== undefined) updatePayload.timezone = dto.timezone;
    if (dto.base_currency !== undefined)
      updatePayload.base_currency = dto.base_currency;
    if (dto.week_starts_on !== undefined)
      updatePayload.week_starts_on = dto.week_starts_on;
    if (dto.amount_privacy_default !== undefined)
      updatePayload.amount_privacy_default = dto.amount_privacy_default;
    if (dto.display_name !== undefined)
      updatePayload.display_name = dto.display_name;

    if (Object.keys(updatePayload).length === 0) {
      return this.getOrCreateProfile(userId, '', accessToken);
    }

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to update profile for ${userId}: ${error.message}`,
      );
      throw new Error('Failed to update profile');
    }

    return data;
  }

  /**
   * Advance onboarding (Blueprint §5.2).
   *
   * Monotonic: a status at or behind where the user already is is accepted and
   * ignored rather than rejected. A user who reloads a step, or whose second
   * tab replays it, should not see an error — but must not be dragged back
   * either. Idempotent for the same reason.
   */
  async updateOnboarding(
    userId: string,
    accessToken: string,
    dto: UpdateOnboardingDto,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);

    const { data: current, error: readError } = await client
      .from('profiles')
      .select('onboarding_status')
      .eq('id', userId)
      .single();

    if (readError || !current) {
      throw new NotFoundException('Profile not found');
    }

    const patch: Record<string, unknown> = {};

    if (dto.onboarding_status !== undefined) {
      const currentRank = ONBOARDING_ORDER.indexOf(
        (current as { onboarding_status: string })
          .onboarding_status as (typeof ONBOARDING_ORDER)[number],
      );
      const nextRank = ONBOARDING_ORDER.indexOf(
        dto.onboarding_status as (typeof ONBOARDING_ORDER)[number],
      );
      // Only ever forwards. `currentRank` is -1 for a value not in the list,
      // which makes any real step an advance — the right answer for a row
      // written before the constraint existed.
      if (nextRank > currentRank) {
        patch.onboarding_status = dto.onboarding_status;
      }
    }

    // The persona is a plain preference and is not part of the ordering, so it
    // can be corrected at any point without rewinding anything.
    if (dto.persona !== undefined) patch.persona = dto.persona;

    if (Object.keys(patch).length === 0) {
      return this.getOrCreateProfile(userId, '', accessToken);
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to advance onboarding for ${userId}: ${error.message}`,
      );
      throw new BadRequestException({
        code: 'ONBOARDING_UPDATE_FAILED',
        message: error.message,
      });
    }

    return data;
  }
}
