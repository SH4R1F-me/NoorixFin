import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LockKeyhole, ShieldAlert } from 'lucide-react-native';
import { closeDb } from '../db';
import {
  authenticateAppLock,
  getAppLockAvailability,
  isAppLockEnabled,
  setAppLockEnabled,
} from '../security/appLock';
import { Colors, Radius, Spacing, Typography } from '../lib/theme';
import { useTranslation } from 'react-i18next';

type LockStatus = 'CHECKING' | 'LOCKED' | 'UNLOCKED' | 'UNAVAILABLE';

interface AppLockContextValue {
  enabled: boolean;
  status: LockStatus;
  unlock: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
  lock: () => Promise<void>;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function useAppLock(): AppLockContextValue {
  const value = useContext(AppLockContext);
  if (!value) throw new Error('useAppLock must be used within AppLockGate');
  return value;
}

export default function AppLockGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const translateRef = useRef(t);
  const [enabled, setEnabledState] = useState(true);
  const [status, setStatus] = useState<LockStatus>('CHECKING');
  const [message, setMessage] = useState<string | null>(null);
  const authenticating = useRef(false);
  const enabledRef = useRef(true);
  const statusRef = useRef<LockStatus>('CHECKING');

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    translateRef.current = t;
  }, [t]);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current) {
      setStatus('UNLOCKED');
      return true;
    }
    if (authenticating.current) return false;

    authenticating.current = true;
    setMessage(null);
    try {
      const availability = await getAppLockAvailability();
      if (!availability.available) {
        setStatus('UNAVAILABLE');
        setMessage(translateRef.current('mobile.lock.unavailable'));
        return false;
      }

      setStatus('LOCKED');
      const result = await authenticateAppLock();
      if (result.success) {
        setStatus('UNLOCKED');
        return true;
      }
      setMessage(
        result.error === 'user_cancel' || result.error === 'system_cancel'
          ? translateRef.current('mobile.lock.remainsLocked')
          : translateRef.current('mobile.lock.failed'),
      );
      return false;
    } finally {
      authenticating.current = false;
    }
  }, []);

  const lock = useCallback(async () => {
    if (!enabledRef.current) return;
    setStatus('LOCKED');
    await closeDb();
  }, []);

  const setEnabled = useCallback(async (next: boolean) => {
    await setAppLockEnabled(next);
    enabledRef.current = next;
    setEnabledState(next);
    // Security settings authenticate before changing this preference, so the
    // current foreground session remains open until the next background event.
    setStatus('UNLOCKED');
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const configured = await isAppLockEnabled();
      if (!active) return;
      enabledRef.current = configured;
      setEnabledState(configured);
      if (!configured) {
        setStatus('UNLOCKED');
        return;
      }
      await unlock();
    })();
    return () => {
      active = false;
    };
  }, [unlock]);

  useEffect(() => {
    const onAppStateChange = (next: AppStateStatus) => {
      if (authenticating.current || !enabledRef.current) return;
      if (next !== 'active') {
        if (statusRef.current === 'UNLOCKED') void lock();
        return;
      }
      if (statusRef.current === 'LOCKED') void unlock();
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, [lock, unlock]);

  const context = useMemo(
    () => ({ enabled, status, unlock, setEnabled, lock }),
    [enabled, status, unlock, setEnabled, lock],
  );

  if (status === 'CHECKING') {
    return (
      <View style={styles.center} accessibilityLabel={t('mobile.lock.preparing')}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <AppLockContext.Provider value={context}>
      {status === 'UNLOCKED' ? (
        children
      ) : (
        <SafeAreaView style={styles.center}>
          <View style={styles.lockCard} accessibilityRole="summary">
            {status === 'UNAVAILABLE' ? (
              <ShieldAlert size={40} color={Colors.warn} />
            ) : (
              <LockKeyhole size={40} color={Colors.accent} />
            )}
            <Text style={styles.title}>{t('mobile.lock.title')}</Text>
            <Text style={styles.body} accessibilityLiveRegion="polite">
              {message ?? t('mobile.lock.body')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mobile.lock.unlock')}
              onPress={() => void unlock()}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>{t('mobile.lock.unlock')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      )}
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    padding: Spacing.lg,
  },
  lockCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    padding: Spacing.xl,
  },
  title: { ...Typography.h2, textAlign: 'center' },
  body: { ...Typography.bodyDim, textAlign: 'center', lineHeight: 22 },
  button: {
    minHeight: 48,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { ...Typography.body, color: '#fff', fontWeight: '700' },
});
