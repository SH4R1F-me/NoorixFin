/**
 * Data & Privacy settings — export data, account deletion request.
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import { apiDownloadDescriptor, apiFetch } from '../../src/lib/api';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';
import { Download, Trash2, Shield } from 'lucide-react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function DataPrivacyScreen() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    let artifactId: string | null = null;
    try {
      const artifact = await apiFetch('/me/exports', {
        method: 'POST',
        idempotencyKey: randomUUID(),
      });
      artifactId = artifact.id;
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('The system share sheet is unavailable on this device.');
      }
      const stamp = new Date().toISOString().replaceAll(':', '-');
      const destination = new File(Paths.cache, `noorixfin-export-${stamp}.ndjson`);
      const request = await apiDownloadDescriptor(`/me/exports/${artifact.id}/download`);
      const file = await File.downloadFileAsync(request.url, destination, {
        headers: request.headers,
        idempotent: true,
      });
      await Sharing.shareAsync(file.uri, {
        dialogTitle: 'Save or share NoorixFin export',
        mimeType: 'application/x-ndjson',
        UTI: 'public.text',
      });
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Failed to create your export file.',
      );
    } finally {
      if (artifactId) {
        try {
          await apiFetch(`/me/exports/${artifactId}`, {
            method: 'DELETE',
            idempotencyKey: randomUUID(),
          });
        } catch {
          // The server-side 24-hour expiry remains the final cleanup boundary.
        }
      }
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Shield size={18} color={Colors.accent} strokeWidth={2} />
          <Text style={styles.infoText}>
            NoorixFin is free and open source. Your data belongs to you. We store only what you put
            in.
          </Text>
        </View>

        <TouchableOpacity onPress={handleExport} disabled={exporting} style={styles.actionCard}>
          {exporting ? (
            <ActivityIndicator color={Colors.accent} size="small" />
          ) : (
            <Download size={20} color={Colors.accent} strokeWidth={2} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Export My Data</Text>
            <Text style={styles.actionSub}>
              Stream a verified export that expires after 24 hours
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Delete Account',
              'To request account deletion, visit the web dashboard at Settings → Data & Privacy.',
            )
          }
          style={[styles.actionCard, styles.dangerCard]}
        >
          <Trash2 size={20} color={Colors.error} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: Colors.error }]}>Delete Account</Text>
            <Text style={styles.actionSub}>Request permanent deletion (30-day grace period)</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.note}>
          Account deletion is managed from the web dashboard to protect against accidental deletion
          on mobile.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, gap: Spacing.md },
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
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dangerCard: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' },
  actionTitle: { ...Typography.body, fontWeight: '600' },
  actionSub: { ...Typography.caption, marginTop: 2 },
  note: { ...Typography.caption, lineHeight: 18, textAlign: 'center' },
});
