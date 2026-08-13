/** Apple-fluid motion constants shared by every web component. */
const criticalDamping = (stiffness: number, mass = 1) => 2 * Math.sqrt(stiffness * mass);

/** Damping ratio 1.0: responsive, interruptible, and without decorative bounce. */
export const fluidSpring = {
  type: 'spring' as const,
  stiffness: 420,
  damping: criticalDamping(420),
  mass: 1,
};

/** Used only after a momentum-carrying drag/flick (damping ratio 0.8). */
export const momentumSpring = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 0.8 * criticalDamping(500),
  mass: 1,
};

/** Apple's exponential deceleration projection, in CSS pixels. */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}
