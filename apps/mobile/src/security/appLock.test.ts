import * as LocalAuthentication from 'expo-local-authentication';
import { secureStore } from '../__tests__/mocks/expo-native';
import { authenticateAppLock, getAppLockAvailability, isAppLockEnabled, setAppLockEnabled } from './appLock';
import { getDb } from '../db';

beforeEach(() => {
  secureStore.clear();
  jest.clearAllMocks();
});

describe('encrypted mobile storage and app lock', () => {
  it('generates and retains a device-only 256-bit database key', async () => {
    await getDb();
    const key = secureStore.get('noorixfin.database-key.v1');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('enables the app lock by default and persists an explicit choice', async () => {
    expect(await isAppLockEnabled()).toBe(true);
    await setAppLockEnabled(false);
    expect(await isAppLockEnabled()).toBe(false);
  });

  it('requires an enrolled device credential', async () => {
    (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValueOnce(
      LocalAuthentication.SecurityLevel.NONE,
    );
    expect(await getAppLockAvailability()).toEqual({
      available: false,
      level: LocalAuthentication.SecurityLevel.NONE,
    });
  });

  it('requests strong biometrics with device-passcode fallback', async () => {
    await authenticateAppLock();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        biometricsSecurityLevel: 'strong',
        disableDeviceFallback: false,
      }),
    );
  });
});
