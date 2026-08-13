import { useEffect, useState, type PropsWithChildren } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { motion } from '@noorixfin/design-tokens';
import { Colors, Radius, Spacing, Typography } from '../lib/theme';
import { criticalSpring, momentumSpring, projectMomentum, rubberband } from '../lib/motion';
import Material from './Material';

export default function FluidSheet({
  open,
  title,
  onOpenChange,
  children,
}: PropsWithChildren<{ open: boolean; title: string; onOpenChange: (open: boolean) => void }>) {
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const translateY = useSharedValue(height);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      translateY.value = withSpring(0, criticalSpring);
    } else if (mounted) {
      translateY.value = withSpring(height, criticalSpring, () => runOnJS(setMounted)(false));
    }
  }, [open, mounted, height, translateY]);

  const pan = Gesture.Pan()
    .minDistance(motion.hysteresis)
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = startY.value + event.translationY;
      translateY.value = next < 0 ? rubberband(next, height) : next;
    })
    .onEnd((event) => {
      const projected = translateY.value + projectMomentum(event.velocityY, 0.99);
      if (projected > height * 0.28 || event.velocityY > 900) {
        translateY.value = withSpring(
          height,
          { ...momentumSpring, velocity: event.velocityY },
          () => runOnJS(onOpenChange)(false),
        );
      } else {
        translateY.value = withSpring(0, { ...momentumSpring, velocity: event.velocityY });
      }
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!mounted) return null;
  return (
    <Modal transparent visible onRequestClose={() => onOpenChange(false)} animationType="none">
      <View style={styles.scrim} accessibilityViewIsModal>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, animatedStyle]}>
            <Material weight="thick" style={styles.material}>
              <View style={styles.grabber} />
              <Text style={styles.title}>{title}</Text>
              {children}
            </Material>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.68)' },
  sheet: { maxHeight: '88%' },
  material: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textFaint,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.h2, marginBottom: Spacing.md },
});
