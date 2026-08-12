/**
 * Notifications settings — placeholder for Phase 4.
 */
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';
import { Bell } from 'lucide-react-native';

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Bell size={48} color={Colors.accent} strokeWidth={1.5} />
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.body}>
          Push notifications are coming in Phase 4.
          You'll be able to set preferences per category — budget alerts, goal milestones, recurring reminders, and security events.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  title: { ...Typography.h3 },
  body: { ...Typography.bodyDim, textAlign: 'center', lineHeight: 22 },
});
