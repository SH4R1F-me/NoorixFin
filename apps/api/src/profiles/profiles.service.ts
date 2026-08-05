/**
 * Profiles Service — Blueprint §9.2
 * Handles profile CRUD and auto-creation on first authenticated request.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdatePreferencesDto } from './dto/profile.dto';

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
}
