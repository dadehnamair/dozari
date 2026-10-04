/** Degrees to turn the wheel so slice `index` of `count` stops under the pointer at the top, after `turns` whole turns. */
export function spinAngle(index: number, count: number, turns = 5): number {
  return turns * 360 - (index * 360) / count;
}
