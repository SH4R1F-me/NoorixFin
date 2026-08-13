import { BlurView } from 'expo-blur';
import { useEffect, useState, type PropsWithChildren } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { semantic } from '@noorixfin/design-tokens';

export default function Material({
  children,
  style,
  weight = 'regular',
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; weight?: 'thin' | 'regular' | 'thick' }>) {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled?.().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => subscription.remove();
  }, []);
  const intensity = weight === 'thin' ? 35 : weight === 'thick' ? 75 : 55;
  return (
    <BlurView
      tint="dark"
      intensity={reduceTransparency ? 0 : intensity}
      blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
      style={[styles.base, reduceTransparency && styles.solid, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  solid: { backgroundColor: semantic.bgPrimary },
});
