/**
 * Security settings — sessions & devices list, MFA status, sign out all.
 */
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';
import { Smartphone, ShieldOff, Shield } from 'lucide-react-native';

interface Device {
  id: string;
  platform: 'web' | 'ios' | 'android';
  device_name: string | null;
  app_version: string | null;
  last_seen_at: string;
  last_ip: string | null;
  first_seen_at: string;
}

const PLATFORM_COLOR: Record<string, string> = {
  web: Colors.info,
  ios: '#a3e635',
  android: Colors.ok,
};

export default function SecurityScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Device[]>('/me/devices');
      setDevices(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleRevoke(deviceId: string) {
    Alert.alert('Revoke Session', 'This device will be signed out. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          setRevoking(deviceId);
          try {
            await apiFetch(`/me/devices/${deviceId}`, { method: 'DELETE' });
            setDevices((prev) => prev.filter((d) => d.id !== deviceId));
          } catch {
            Alert.alert('Error', 'Failed to revoke session.');
          } finally {
            setRevoking(null);
          }
        },
      },
    ]);
  }

  function formatRelative(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Shield size={18} color={Colors.accent} strokeWidth={2} />
          <Text style={styles.infoText}>
            These are all devices that have an active session. Revoke any you don't recognise.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Active Sessions</Text>

        {loading ? (
          <ActivityIndicator color={Colors.accent} size="large" style={{ marginTop: 20 }} />
        ) : devices.length === 0 ? (
          <Text style={styles.empty}>No active sessions found.</Text>
        ) : (
          devices.map((device) => (
            <View key={device.id} style={styles.deviceCard}>
              <View style={styles.deviceHeader}>
                <Smartphone
                  size={18}
                  color={PLATFORM_COLOR[device.platform] ?? Colors.textDim}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.platform,
                    { color: PLATFORM_COLOR[device.platform] ?? Colors.textDim },
                  ]}
                >
                  {device.platform.toUpperCase()}
                </Text>
                <Text style={styles.deviceName}>{device.device_name ?? 'Unknown device'}</Text>
              </View>
              <View style={styles.deviceMeta}>
                <Text style={styles.metaText}>
                  Last seen: {formatRelative(device.last_seen_at)}
                </Text>
                {device.last_ip && <Text style={styles.metaText}>IP: {device.last_ip}</Text>}
                {device.app_version && (
                  <Text style={styles.metaText}>Version: {device.app_version}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleRevoke(device.id)}
                disabled={revoking === device.id}
                style={styles.revokeBtn}
              >
                {revoking === device.id ? (
                  <ActivityIndicator color={Colors.error} size="small" />
                ) : (
                  <>
                    <ShieldOff size={14} color={Colors.error} strokeWidth={2} />
                    <Text style={styles.revokeBtnText}>Revoke</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(91,127,255,0.3)',
  },
  infoText: { flex: 1, ...Typography.caption, color: Colors.textDim, lineHeight: 18 },
  sectionTitle: { ...Typography.label, marginTop: Spacing.sm },
  empty: { ...Typography.bodyDim, textAlign: 'center', marginTop: Spacing.xl },
  deviceCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  platform: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  deviceName: { ...Typography.body, fontWeight: '600', flex: 1 },
  deviceMeta: { gap: 2 },
  metaText: { ...Typography.caption },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    marginTop: 4,
  },
  revokeBtnText: { fontSize: 13, color: Colors.error, fontWeight: '600' },
});
