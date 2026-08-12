/**
 * Data & Privacy settings — export data, account deletion request.
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { apiFetch } from '../../src/lib/api';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';
import { Download, Trash2, Shield } from 'lucide-react-native';

export default function DataPrivacyScreen() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await apiFetch('/profiles/me/export', { method: 'POST' });
      Alert.alert('Export Started', 'Your data export has been queued. Check your email shortly.');
    } catch (e) {
      Alert.alert('Error', 'Failed to start export.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Shield size={18} color={Colors.accent} strokeWidth={2} />
          <Text style={styles.infoText}>
            NoorixFin is self-hostable and open source. Your data belongs to you.
            We store only what you put in.
          </Text>
        </View>

        <TouchableOpacity onPress={handleExport} disabled={exporting} style={styles.actionCard}>
          {exporting
            ? <ActivityIndicator color={Colors.accent} size="small" />
            : <Download size={20} color={Colors.accent} strokeWidth={2} />
          }
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Export My Data</Text>
            <Text style={styles.actionSub}>Download all your transactions and data as JSON</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Alert.alert(
            'Delete Account',
            'To request account deletion, visit the web dashboard at Settings → Data & Privacy.',
          )}
          style={[styles.actionCard, styles.dangerCard]}
        >
          <Trash2 size={20} color={Colors.error} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: Colors.error }]}>Delete Account</Text>
            <Text style={styles.actionSub}>Request permanent deletion (30-day grace period)</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.note}>
          Account deletion is managed from the web dashboard to protect against accidental deletion on mobile.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, gap: Spacing.md },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.accentLight, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(91,127,255,0.3)',
  },
  infoText: { flex: 1, ...Typography.caption, color: Colors.textDim, lineHeight: 18 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  dangerCard: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' },
  actionTitle: { ...Typography.body, fontWeight: '600' },
  actionSub: { ...Typography.caption, marginTop: 2 },
  note: { ...Typography.caption, lineHeight: 18, textAlign: 'center' },
});
