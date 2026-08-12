import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  compareVersions,
  currentVersion,
  fetchMobileRelease,
  releaseDownloadUrl,
  type MobileRelease,
} from '../lib/releases';

export default function ForcedUpgradeGate() {
  const [release, setRelease] = useState<MobileRelease | null>(null);
  useEffect(() => {
    void fetchMobileRelease().then((value) => {
      if (value && compareVersions(currentVersion(), value.min_version) < 0) setRelease(value);
    });
  }, []);
  if (!release) return null;
  const url = releaseDownloadUrl(release);
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>UPDATE REQUIRED</Text>
        <Text style={styles.title}>A safer version is available</Text>
        <Text style={styles.body}>
          This version ({currentVersion()}) can no longer sync safely. Update to NoorixFin{' '}
          {release.latest_version} or later to continue.
        </Text>
        {url ? (
          <Pressable
            accessibilityRole="link"
            style={styles.button}
            onPress={() => void Linking.openURL(url)}
          >
            <Text style={styles.buttonText}>Update NoorixFin</Text>
          </Pressable>
        ) : (
          <Text style={styles.help}>
            The download is being published. Visit noorixfin.app/download from another device.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 9999,
    backgroundColor: '#07111f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
  },
  eyebrow: { color: '#fbbf24', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#f8fafc', fontSize: 25, fontWeight: '800', marginTop: 10 },
  body: { color: '#cbd5e1', lineHeight: 23, marginTop: 12 },
  button: {
    marginTop: 22,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#10b981',
  },
  buttonText: { color: '#04120d', fontWeight: '800' },
  help: { color: '#fbbf24', lineHeight: 21, marginTop: 18 },
});
