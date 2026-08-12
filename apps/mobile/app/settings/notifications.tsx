import { useCallback, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BellRing, ShieldCheck } from 'lucide-react-native';
import { apiFetch } from '../../src/lib/api';
import { requestAndRegisterPush } from '../../src/lib/notifications';
import { Colors, Radius, Spacing, Typography } from '../../src/lib/theme';

type Category =
  | 'security'
  | 'budget'
  | 'goal'
  | 'recurring'
  | 'transaction'
  | 'sync'
  | 'account'
  | 'system'
  | 'operator';
interface Preference {
  category: Category;
  in_app: boolean;
  push: boolean;
  email: boolean;
  digest: 'NONE' | 'DAILY' | 'WEEKLY';
}
interface Payload {
  preferences: Preference[];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_tz: string | null;
}

const labels: Record<Category, string> = {
  security: 'Security',
  budget: 'Budgets',
  goal: 'Goals',
  recurring: 'Recurring',
  transaction: 'Transactions',
  sync: 'Sync',
  account: 'Account',
  system: 'System',
  operator: 'Operator',
};

export default function NotificationSettingsScreen() {
  const [data, setData] = useState<Payload | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Payload>('/me/notification-preferences'));
    } catch {
      setData(null);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function toggle(category: Category, channel: 'in_app' | 'push' | 'email', enabled: boolean) {
    if (!data || category === 'security') return;
    setData({
      ...data,
      preferences: data.preferences.map((row) =>
        row.category === category ? { ...row, [channel]: enabled } : row,
      ),
    });
  }

  function cycleDigest(category: Category) {
    if (!data || category === 'security') return;
    const order: Preference['digest'][] = ['NONE', 'DAILY', 'WEEKLY'];
    setData({
      ...data,
      preferences: data.preferences.map((row) =>
        row.category === category
          ? { ...row, digest: order[(order.indexOf(row.digest) + 1) % order.length]! }
          : row,
      ),
    });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      await apiFetch('/me/notification-preferences', { method: 'PUT', body: data });
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch {
      Alert.alert('Could not save', 'Try again when you are online.');
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    const enabled = await requestAndRegisterPush();
    Alert.alert(
      enabled ? 'Push enabled' : 'Push not enabled',
      enabled
        ? 'This device is registered for notifications.'
        : 'Allow notifications in system settings and confirm an EAS project ID is configured.',
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BellRing size={24} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Delivery preferences</Text>
            <Text style={styles.body}>
              Choose which channels can reach you. Security notices stay enabled.
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.pushButton} onPress={() => void enablePush()}>
          <BellRing size={17} color={Colors.bg} />
          <Text style={styles.pushText}>Enable push on this device</Text>
        </TouchableOpacity>
        {data && (
          <View style={styles.quietCard}>
            <Text style={styles.sectionTitle}>Quiet hours</Text>
            <Text style={styles.body}>
              Push and email wait during this window. Critical notices override it.
            </Text>
            <View style={styles.quietRow}>
              <TextInput
                accessibilityLabel="Quiet hours start"
                placeholder="22:00"
                placeholderTextColor={Colors.textFaint}
                value={data.quiet_hours_start ?? ''}
                onChangeText={(value) => setData({ ...data, quiet_hours_start: value || null })}
                style={styles.timeInput}
                maxLength={5}
              />
              <Text style={styles.body}>to</Text>
              <TextInput
                accessibilityLabel="Quiet hours end"
                placeholder="07:00"
                placeholderTextColor={Colors.textFaint}
                value={data.quiet_hours_end ?? ''}
                onChangeText={(value) => setData({ ...data, quiet_hours_end: value || null })}
                style={styles.timeInput}
                maxLength={5}
              />
            </View>
            <TextInput
              accessibilityLabel="Quiet hours timezone"
              placeholder="Asia/Riyadh"
              placeholderTextColor={Colors.textFaint}
              value={data.quiet_hours_tz ?? ''}
              onChangeText={(value) => setData({ ...data, quiet_hours_tz: value || null })}
              style={styles.timezoneInput}
            />
          </View>
        )}
        <View style={styles.tableHeader}>
          <Text style={styles.headerCategory}>Category</Text>
          <Text style={styles.headerCell}>In app</Text>
          <Text style={styles.headerCell}>Push</Text>
          <Text style={styles.headerCell}>Email</Text>
        </View>
        <View style={styles.group}>
          {(data?.preferences ?? []).map((row) => {
            const locked = row.category === 'security';
            return (
              <View key={row.category} style={styles.row}>
                <View style={styles.category}>
                  <Text style={styles.categoryText}>{labels[row.category]}</Text>
                  {locked && (
                    <View style={styles.lock}>
                      <ShieldCheck size={11} color={Colors.warn} />
                      <Text style={styles.lockText}>Always on</Text>
                    </View>
                  )}
                  {!locked && (
                    <TouchableOpacity
                      accessibilityLabel={`${labels[row.category]} digest ${row.digest}`}
                      onPress={() => cycleDigest(row.category)}
                    >
                      <Text style={styles.digest}>
                        Digest:{' '}
                        {row.digest === 'NONE'
                          ? 'Instant'
                          : row.digest === 'DAILY'
                            ? 'Daily'
                            : 'Weekly'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {(['in_app', 'push', 'email'] as const).map((channel) => (
                  <View key={channel} style={styles.switchCell}>
                    <Switch
                      accessibilityLabel={`${labels[row.category]} ${channel}`}
                      value={row[channel]}
                      disabled={locked}
                      onValueChange={(enabled) => toggle(row.category, channel, enabled)}
                      trackColor={{ false: Colors.border, true: Colors.accent }}
                    />
                  </View>
                ))}
              </View>
            );
          })}
          {!data && (
            <Text style={styles.empty}>
              Preferences are unavailable while offline. Your last saved choices remain active on
              the server.
            </Text>
          )}
        </View>
        <TouchableOpacity
          disabled={!data || saving}
          style={[styles.save, (!data || saving) && styles.disabled]}
          onPress={() => void save()}
        >
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save preferences'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  hero: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  title: { ...Typography.h3 },
  body: { ...Typography.bodyDim, marginTop: 3, lineHeight: 19 },
  pushButton: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  pushText: { color: Colors.bg, fontWeight: '800' },
  quietCard: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: { ...Typography.body, fontWeight: '700' },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  timeInput: {
    minWidth: 78,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    textAlign: 'center',
  },
  timezoneInput: {
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  tableHeader: { flexDirection: 'row', paddingHorizontal: Spacing.sm, marginBottom: 5 },
  headerCategory: { flex: 1, ...Typography.caption },
  headerCell: { width: 58, ...Typography.caption, textAlign: 'center' },
  group: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  category: { flex: 1 },
  categoryText: { ...Typography.body, fontWeight: '600' },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  lockText: { color: Colors.warn, fontSize: 9 },
  switchCell: { width: 58, alignItems: 'center', transform: [{ scale: 0.8 }] },
  digest: { color: Colors.accent, fontSize: 10, marginTop: 4 },
  empty: { ...Typography.bodyDim, padding: Spacing.lg, textAlign: 'center' },
  save: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  disabled: { opacity: 0.4 },
  saveText: { color: Colors.bg, fontWeight: '800' },
});
