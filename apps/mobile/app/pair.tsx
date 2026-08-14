import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../src/lib/api';
import { useWorkspace } from '../src/lib/WorkspaceContext';

type PairedWorkspace = { id: string; name: string; base_currency: string };

export default function PairScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { selectWorkspace } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pair() {
    if (!token) {
      setError('This pairing code is incomplete.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const workspace: PairedWorkspace = await apiFetch('/me/devices/pairing/consume', {
        method: 'POST',
        body: { token },
      });
      await selectWorkspace({ ...workspace, created_at: new Date().toISOString() });
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not pair this workspace');
    } finally {
      setPending(false);
    }
  }
  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>SECURE PAIRING</Text>
      <Text style={styles.title}>Continue this workspace on mobile</Text>
      <Text style={styles.body}>
        Sign in with the same NoorixFin account, then use this one-time code to select the workspace
        from your computer.
      </Text>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable style={styles.button} onPress={pair} disabled={pending}>
        <Text style={styles.buttonText}>{pending ? 'Pairing…' : 'Pair workspace'}</Text>
        {pending && <ActivityIndicator color="#04120d" />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#07111f' },
  eyebrow: { color: '#34d399', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#f8fafc', fontSize: 27, fontWeight: '800', marginTop: 12 },
  body: { color: '#94a3b8', lineHeight: 23, marginTop: 12 },
  error: { color: '#f87171', marginTop: 14 },
  button: {
    marginTop: 24,
    minHeight: 52,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#04120d', fontWeight: '800' },
});
