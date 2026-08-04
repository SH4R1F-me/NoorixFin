/**
 * Mobile skeletons — DEC-012.
 *
 * Replaces the spinner on the transaction list. Same reasoning as web: the
 * placeholder mirrors the real row's dimensions so nothing moves when data
 * lands, and the amount column is a skeleton rather than a guessed value.
 *
 * Honours the OS "reduce motion" setting — a continuous pulse is a vestibular
 * trigger, and on mobile the setting is far more commonly enabled than on web.
 */
import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, AccessibilityInfo, Easing } from 'react-native';

function useShimmer() {
  const value = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return; // static placeholder, still conveys "loading"
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });

    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [value]);

  return value;
}

export function SkeletonBlock({
  width,
  height,
  radius = 6,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const opacity = useShimmer();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { width, height, borderRadius: radius, opacity }]}
    />
  );
}

/** Mirrors a transaction row: payee + date on the left, amount on the right. */
export function TransactionListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading transactions">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.main}>
            <SkeletonBlock width="55%" height={15} />
            <View style={{ height: 6 }} />
            <SkeletonBlock width="30%" height={12} />
          </View>
          <View style={styles.amount}>
            <SkeletonBlock width={72} height={15} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: '#1e293b' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  main: { flex: 1 },
  amount: { alignItems: 'flex-end' },
});
