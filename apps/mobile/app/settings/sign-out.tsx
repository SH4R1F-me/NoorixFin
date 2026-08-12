/**
 * Sign-out screen — confirms and signs out.
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { clearLocalData } from '../../src/db';
import { useWorkspace } from '../../src/lib/WorkspaceContext';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';
import { LogOut } from 'lucide-react-native';
import { apiFetch } from '../../src/lib/api';
import { getDeviceId } from '../../src/lib/device';

export default function SignOutScreen() {
  const router = useRouter();
  const { clearWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Your data will remain synced. You can sign in again at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const deviceId = await getDeviceId();
            try {
              await apiFetch(`/me/devices/current/${deviceId}`, { method: 'DELETE' });
            } catch {
              // Sign-out must still clear local secrets if the network is unavailable.
            }
            await clearLocalData();
            await clearWorkspace();
            await supabase.auth.signOut();
            router.replace('/sign-in');
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <LogOut size={40} color={Colors.error} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>Sign Out</Text>
        <Text style={styles.body}>
          Your transactions and data will be cleared from this device. They remain safe in the cloud
          and will sync when you sign back in.
        </Text>
        <TouchableOpacity
          onPress={handleSignOut}
          disabled={loading}
          style={[styles.btn, loading && styles.btnDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>Sign Out</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.h2, color: Colors.error },
  body: { ...Typography.bodyDim, textAlign: 'center', lineHeight: 22 },
  btn: {
    width: '100%',
    backgroundColor: Colors.error,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancel: { padding: Spacing.sm },
  cancelText: { ...Typography.body, color: Colors.textDim },
});
