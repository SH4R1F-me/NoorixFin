import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@noorixfin/design-tokens';
import { criticalSpring } from '../lib/motion';

export interface FluidPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
}

/** Instant pointer-down feedback with a critically damped, interruptible return. */
export default function FluidPressable({
  children,
  style,
  disabled,
  onPressIn,
  onPressOut,
  hitSlop = motion.hysteresis,
  ...rest
}: PropsWithChildren<FluidPressableProps>) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={(event) => {
        scale.value = withSpring(motion.pressScale, criticalSpring);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, criticalSpring);
        onPressOut?.(event);
      }}
      {...rest}
    >
      <Animated.View style={[style, animatedStyle, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
