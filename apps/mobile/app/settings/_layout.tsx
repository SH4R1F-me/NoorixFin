/**
 * Settings section — stack navigator for profile, security, preferences, data, sessions.
 */
import { Stack } from 'expo-router';
import { Colors } from '../../src/lib/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgCard },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="security" options={{ title: 'Security' }} />
      <Stack.Screen name="preferences" options={{ title: 'Preferences' }} />
      <Stack.Screen name="data" options={{ title: 'Data & Privacy' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="sessions" options={{ title: 'Sessions & Devices' }} />
      <Stack.Screen name="sign-out" options={{ title: 'Sign Out' }} />
    </Stack>
  );
}
