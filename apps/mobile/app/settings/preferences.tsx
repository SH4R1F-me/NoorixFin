/**
 * Preferences settings — locale, timezone, currency, week start.
 */
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';

export default function PreferencesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Language</Text>
          <Text style={styles.cardValue}>English</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default Currency</Text>
          <Text style={styles.cardValue}>BDT (Bangladeshi Taka)</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Week starts on</Text>
          <Text style={styles.cardValue}>Sunday</Text>
        </View>
        <Text style={styles.note}>
          Preferences are managed from the web dashboard for now.
          Visit noorixfin.com/dashboard/settings/preferences to update these.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardTitle: { ...Typography.body },
  cardValue: { ...Typography.bodyDim },
  note: { ...Typography.caption, lineHeight: 18, textAlign: 'center', marginTop: Spacing.lg },
});
