import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const DEVICE_ID_KEY = 'noorixfin.device_id';
const sessionId = Crypto.randomUUID();

export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}

export async function getClientInfoHeader(): Promise<string> {
  const deviceId = await getDeviceId();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';
  const build =
    Platform.OS === 'ios'
      ? (Constants.expoConfig?.ios?.buildNumber ?? 'dev')
      : String(Constants.expoConfig?.android?.versionCode ?? 'dev');
  return [
    `platform=${platform}`,
    `app_version=${appVersion}`,
    `build=${build}`,
    `os=${String(Platform.Version)}`,
    `device_id=${deviceId}`,
    `session_id=${sessionId}`,
  ].join('; ');
}
