/**
 * Workspace selection — replaces the hardcoded EXPO_PUBLIC_DEV_WORKSPACE_ID.
 *
 * Shown on first launch after sign-in when no workspace is persisted in
 * SecureStore. For most users this is immediate (single workspace) — but the
 * screen must exist for multi-workspace support and for recovery after
 * workspace removal.
 */
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { fetchWorkspaces, type WorkspaceSummary } from '../src/lib/workspace';
import { Colors, Typography, Spacing, Radius } from '../src/lib/theme';

export default function WorkspaceSelectScreen() {
  const { t } = useTranslation();
  const { selectWorkspace } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const ws = await fetchWorkspaces();
          setWorkspaces(ws);
          // Auto-select if only one workspace
          if (ws.length === 1 && ws[0]) {
            setSelecting(ws[0].id);
            await selectWorkspace(ws[0]);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to load workspaces');
        } finally {
          setLoading(false);
        }
      })();
    }, [selectWorkspace]),
  );

  async function handleSelect(ws: WorkspaceSummary) {
    setSelecting(ws.id);
    await selectWorkspace(ws);
    setSelecting(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={styles.title}>{t('mobile.workspace.choose')}</Text>
          <Text style={styles.subtitle}>
            {t('mobile.workspace.chooseBody')}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.accent} size="large" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={workspaces}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: Spacing.sm }}
            ListEmptyComponent={
              <Text style={styles.empty}>{t('mobile.workspace.none')}</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.base_currency}`}
                onPress={() => handleSelect(item)}
                disabled={selecting !== null}
                style={[styles.card, selecting === item.id && styles.cardActive]}
              >
                <View style={styles.cardIcon}>
                  <Text style={styles.cardIconText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardCurrency}>{item.base_currency}</Text>
                </View>
                {selecting === item.id && (
                  <ActivityIndicator color={Colors.accent} size="small" />
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1, padding: Spacing.lg, paddingTop: Spacing.xxl },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  logoMark: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  title: { ...Typography.h2, marginBottom: Spacing.xs },
  subtitle: { ...Typography.bodyDim, textAlign: 'center' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    marginTop: Spacing.lg,
  },
  errorText: { color: Colors.error, textAlign: 'center' },
  empty: { ...Typography.bodyDim, textAlign: 'center', marginTop: Spacing.xl },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  cardActive: { borderColor: Colors.accent, backgroundColor: Colors.bgElevated },
  cardIcon: {
    width: 44, height: 44, borderRadius: Radius.sm,
    backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center',
  },
  cardIconText: { fontSize: 20, fontWeight: '700', color: Colors.accent },
  cardName: { ...Typography.body, fontWeight: '600' },
  cardCurrency: { ...Typography.caption, marginTop: 2 },
});
