import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { apiFetch } from './api';
import { getDeviceId } from './device';
import { reportMobileError } from './observability';
import { supabase } from './supabase';
import { sync } from '../sync/engine';
import { countLocalUnreadNotifications } from '../repositories/notifications';

export const NOTIFICATION_CATEGORIES = [
  'security',
  'budget',
  'goal',
  'recurring',
  'transaction',
  'sync',
  'account',
  'system',
  'operator',
] as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const category of NOTIFICATION_CATEGORIES) {
    await Notifications.setNotificationChannelAsync(category, {
      name: category.charAt(0).toUpperCase() + category.slice(1),
      description: `NoorixFin ${category} notifications`,
      importance:
        category === 'security' || category === 'operator'
          ? Notifications.AndroidImportance.HIGH
          : Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
      vibrationPattern: category === 'security' ? [0, 250, 150, 250] : undefined,
      lightColor: '#10b981',
    });
  }
}

async function registerDevice(pushToken?: string): Promise<void> {
  const deviceId = await getDeviceId();
  await apiFetch('/me/devices', {
    method: 'POST',
    body: {
      deviceId,
      deviceName: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} device`,
      ...(pushToken ? { pushToken, pushProvider: 'expo' } : {}),
    },
  });
}

export async function registerDeviceAndExistingPushPermission(): Promise<boolean> {
  try {
    await ensureNotificationChannels();
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') {
      await registerDevice();
      return false;
    }
    const token = await getExpoToken();
    await registerDevice(token);
    return true;
  } catch (error) {
    reportMobileError(error, 'notifications:register-existing');
    return false;
  }
}

export async function requestAndRegisterPush(): Promise<boolean> {
  try {
    await ensureNotificationChannels();
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return false;
    const token = await getExpoToken();
    await registerDevice(token);
    return true;
  } catch (error) {
    reportMobileError(error, 'notifications:request-permission');
    return false;
  }
}

async function getExpoToken(): Promise<string> {
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) throw new Error('EAS project ID is not configured');
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

function openResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const value = response.notification.request.content.data?.actionUrl;
  if (typeof value !== 'string') return;
  const path = mobilePathForAction(value);
  if (path) router.push(path as never);
}

export function subscribeToNotificationLifecycle(): () => void {
  void Notifications.getLastNotificationResponseAsync().then(openResponse);
  const response = Notifications.addNotificationResponseReceivedListener(openResponse);
  const received = Notifications.addNotificationReceivedListener(() => {
    void apiFetch<{ count: number }>('/notifications/unread-count').then(({ count }) =>
      Notifications.setBadgeCountAsync(count),
    );
  });
  const token = Notifications.addPushTokenListener(() => {
    void registerDeviceAndExistingPushPermission();
  });
  return () => {
    response.remove();
    received.remove();
    token.remove();
  };
}

export function subscribeToNotificationHints(userId: string, workspaceId: string): () => void {
  const channel = supabase
    .channel(`notification-hints:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notification_hints',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void sync(workspaceId).then(async () => {
          await Notifications.setBadgeCountAsync(await countLocalUnreadNotifications());
        });
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

function mobilePathForAction(value: string): string | null {
  if (value.startsWith('/admin') || /^https?:\/\//i.test(value)) return null;
  if (value.startsWith('/dashboard/notifications')) return '/notifications';
  if (value.startsWith('/dashboard/transactions')) return '/(tabs)/transactions';
  if (/^\/dashboard\/(budgets|goals|calendar)/.test(value)) return '/(tabs)/plan';
  if (value.startsWith('/dashboard/settings/notifications')) return '/settings/notifications';
  if (value.startsWith('/dashboard/settings/sessions')) return '/settings/security';
  if (value.startsWith('/dashboard/settings')) return '/(tabs)/more';
  return '/(tabs)';
}
