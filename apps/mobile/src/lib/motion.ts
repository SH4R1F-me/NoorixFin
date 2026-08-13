import { motion } from '@noorixfin/design-tokens';
import { ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

/** Damping ratio 1.0; retargeting preserves presentation value and velocity. */
export const criticalSpring: WithSpringConfig = {
  mass: motion.critical.mass,
  stiffness: motion.critical.stiffness,
  damping: motion.critical.damping,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
};

/** Reserved for a gesture release that actually carries momentum. */
export const momentumSpring: WithSpringConfig = {
  mass: motion.momentum.mass,
  stiffness: motion.momentum.stiffness,
  damping: motion.momentum.damping,
  overshootClamping: false,
  reduceMotion: ReduceMotion.System,
};

export function projectMomentum(
  velocity: number,
  decelerationRate: number = motion.decelerationRate,
): number {
  'worklet';
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
