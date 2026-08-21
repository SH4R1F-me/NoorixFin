/**
 * Sign-in — DEC-010.
 *
 * Unlike web (DEC-009, where httpOnly cookies forbid a client-held token), the
 * device signs in directly and persists the session in SecureStore. That is
 * what lets the app work offline: it can prove who it is without a round trip.
 */
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { useTranslation } from 'react-i18next';

export default function SignIn() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    // Generic message on purpose — distinguishing "no such user" from "wrong
    // password" is a user-enumeration oracle.
    if (authError) setError(t('auth.invalidCredentials'));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NoorixFin</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.email')}
        accessibilityLabel={t('auth.email')}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        accessibilityLabel={t('auth.password')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: loading, busy: loading }}
        style={styles.button}
        onPress={submit}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('auth.signIn')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#0f172a' },
  title: { fontSize: 32, fontWeight: '800', color: '#f8fafc', marginBottom: 24, textAlign: 'center' },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', padding: 14, borderRadius: 10, fontSize: 16 },
  button: { backgroundColor: '#059669', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#ef4444', fontSize: 14 },
});
