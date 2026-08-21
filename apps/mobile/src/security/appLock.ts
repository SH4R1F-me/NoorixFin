import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const APP_LOCK_ENABLED_KEY = 'noorixfin.app-lock.enabled.v1';

export async function isAppLockEnabled(): Promise<boolean> {
  // The native E2E profile is a separately built, non-distributable binary.
  // It must pass SQLCipher startup before this point, but bypasses the system
  // credential prompt so Maestro can exercise kill/relaunch on clean emulators.
  if (process.env.EXPO_PUBLIC_E2E_DISABLE_APP_LOCK === '1') return false;
  const stored = await SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY);
  // Financial data is protected by default. A user may explicitly turn the
  // extra app-level gate off after authenticating in Security settings.
  return stored !== 'false';
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, String(enabled));
}

export async function getAppLockAvailability(): Promise<{
  available: boolean;
  level: LocalAuthentication.SecurityLevel;
}> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return {
    available: level !== LocalAuthentication.SecurityLevel.NONE,
    level,
  };
}

export function authenticateAppLock(): Promise<LocalAuthentication.LocalAuthenticationResult> {
  return LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock NoorixFin',
    promptSubtitle: 'Authenticate to access encrypted financial data',
    promptDescription: 'Use your device biometric or device passcode.',
    cancelLabel: 'Keep locked',
    fallbackLabel: 'Use device passcode',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
    requireConfirmation: true,
  });
}
