/** Deterministic pseudo-random in [a, b) for particle layouts (same as the design kit's `rnd`). */
export function rnd(a: number, b: number, i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return a + (((x % 1) + 1) % 1) * (b - a);
}

export const CONFETTI_COLORS = ['#FF4D8D', '#3FC1F0', '#7ED957', '#FFC93C', '#A66BF0', '#FFFFFF'] as const;

export interface ConfettiPiece {
  /** Horizontal position, percent of the width. */
  left: number;
  color: string;
  /** Seconds for one fall. */
  duration: number;
  /** Start offset as a fraction of one fall (0..1). */
  phase: number;
}

export function confettiPieces(count = 12): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    left: 6 + i * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] as string,
    duration: 1.6 + (i % 4) * 0.4,
    phase: (i * 0.37) % 1,
  }));
}

export interface RainDrop {
  left: number;
  width: number;
  height: number;
  opacity: number;
  duration: number;
  phase: number;
}

export function rainDrops(count = 34): RainDrop[] {
  return Array.from({ length: count }, (_, i) => {
    const near = i % 3 === 0;
    return {
      left: rnd(-5, 105, i),
      width: near ? 2 : 1.2,
      height: Math.round(near ? rnd(26, 38, i + 7) : rnd(12, 22, i + 7)),
      opacity: near ? 0.85 : 0.5,
      duration: near ? rnd(0.45, 0.6, i + 3) : rnd(0.7, 1, i + 3),
      phase: rnd(0, 1, i + 11),
    };
  });
}
