/**
 * Devices Service — user-facing session & device management (gap S2).
 *
 * A user can see every device they have registered, revoke individual sessions,
 * or sign out of all other devices. The service role writes registrations and
 * handles admin-initiated revocations; the authenticated client handles the
 * user-initiated ones via RLS.
 *
 * DEC-016 boundary: this service deals with a user's OWN devices only.
 * Admin-level revocation (force-revoke any user's session) lives in AdminService.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { ClientContext } from '../common/middleware/client-context.middleware';
import { NotificationsService } from '../notifications/notifications.service';

export interface RegisterDeviceDto {
  deviceId: string;
  deviceName?: string;
  pushToken?: string;
  pushProvider?: 'expo' | 'fcm' | 'apns' | 'webpush';
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async listDevices(accessToken: string) {
    const client = this.supabaseService.getUserClient(accessToken);
    const { data, error } = await client
      .from('user_devices')
      .select(
        'id, device_id, platform, device_name, os_version, app_version, last_seen_at, last_ip, first_seen_at, revoked_at',
      )
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async registerDevice(
    accessToken: string,
    userId: string,
    dto: RegisterDeviceDto,
    ctx: ClientContext | null,
  ) {
    const client = this.supabaseService.getServiceClient();
    const { data: existing } = await client
      .from('user_devices')
      .select('id, revoked_at')
      .eq('user_id', userId)
      .eq('device_id', dto.deviceId)
      .maybeSingle();

    // Upsert on (user_id, device_id) — a reinstall on the same device updates
    // rather than creating a second row, which is what the UNIQUE constraint expects.
    const { data, error } = await client
      .from('user_devices')
      .upsert(
        {
          user_id: userId,
          device_id: dto.deviceId,
          platform: (ctx?.platform ?? 'web') as 'web' | 'ios' | 'android',
          device_name: dto.deviceName ?? null,
          os_version: ctx?.osVersion ?? null,
          app_version: ctx?.appVersion ?? null,
          push_token: dto.pushToken ?? null,
          push_provider: dto.pushProvider ?? null,
          last_seen_at: new Date().toISOString(),
          revoked_at: null, // clear a previous revocation on re-registration
        },
        { onConflict: 'user_id,device_id', ignoreDuplicates: false },
      )
      .select('id, device_id, platform, device_name, last_seen_at')
      .single();

    if (error) throw error;
    if (!existing || existing.revoked_at) {
      await this.notifications.create({
        userId,
        category: 'security',
        severity: 'WARNING',
        titleEn: 'New device signed in',
        titleBn: 'নতুন ডিভাইসে সাইন ইন হয়েছে',
        bodyEn: `A new ${data.platform} device was registered to your account.`,
        bodyBn: `আপনার অ্যাকাউন্টে একটি নতুন ${data.platform} ডিভাইস নিবন্ধিত হয়েছে।`,
        actionUrl: '/dashboard/settings/sessions',
        resourceType: 'user_device',
        resourceId: data.id,
        dedupeKey: `new-device:${dto.deviceId}`,
      });
    }
    return data;
  }

  async revokeDevice(accessToken: string, userId: string, deviceId: string) {
    const client = this.supabaseService.getUserClient(accessToken);
    const { data, error } = await client
      .from('user_devices')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', deviceId)
      .is('revoked_at', null)
      .select('id')
      .single();

    if (error || !data)
      throw new NotFoundException('Device not found or already revoked');
    return { revoked: true };
  }

  async revokeCurrentDevice(
    accessToken: string,
    userId: string,
    opaqueDeviceId: string,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);
    const { data, error } = await client
      .from('user_devices')
      .update({
        revoked_at: new Date().toISOString(),
        push_token: null,
        push_provider: null,
      })
      .eq('user_id', userId)
      .eq('device_id', opaqueDeviceId)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    return { revoked: Boolean(data) };
  }

  async revokeAllOtherDevices(
    accessToken: string,
    userId: string,
    currentDeviceId: string | null,
  ) {
    const client = this.supabaseService.getUserClient(accessToken);
    const query = client
      .from('user_devices')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);

    // If we know the current device, keep it active.
    if (currentDeviceId) {
      query.neq('device_id', currentDeviceId);
    }

    const { error } = await query;
    if (error) throw error;
    return { revoked: true };
  }
}
