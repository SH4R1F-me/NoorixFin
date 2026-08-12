/**
 * Profile settings screen.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiFetch } from '../../src/lib/api';
import { Colors, Typography, Spacing, Radius } from '../../src/lib/theme';

interface Profile {
  display_name: string;
  locale: string;
  timezone: string;
  base_currency: string;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Profile>('/profiles/me');
      setProfile(data);
      setDisplayName(data.display_name);
    } catch (e) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await apiFetch('/profiles/me', {
        method: 'PATCH',
        body: { display_name: displayName.trim() },
      });
      Alert.alert('Saved', 'Profile updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={Colors.accent} size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Avatar */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(displayName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={Colors.textFaint}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Locale</Text>
              <View style={styles.readOnly}><Text style={styles.readOnlyText}>{profile?.locale}</Text></View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Base Currency</Text>
              <View style={styles.readOnly}><Text style={styles.readOnlyText}>{profile?.base_currency}</Text></View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Timezone</Text>
              <View style={styles.readOnly}><Text style={styles.readOnlyText}>{profile?.timezone}</Text></View>
            </View>

            <TouchableOpacity onPress={save} disabled={saving} style={[styles.btn, saving && styles.btnDisabled]}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.accentLight,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: Spacing.lg,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: Colors.accent },
  fieldGroup: { gap: Spacing.xs },
  fieldLabel: { ...Typography.label },
  input: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, color: Colors.text, fontSize: 15,
    borderWidth: 1, borderColor: Colors.border,
  },
  readOnly: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  readOnlyText: { ...Typography.body, color: Colors.textDim },
  btn: {
    backgroundColor: Colors.accent, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
