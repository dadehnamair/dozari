/** Pure timing helpers of the scene motion (sceneMotion.tsx). */

/** Position 0..1 in a loop of `dur` seconds; a negative `begin` starts the loop part-way (as SMIL does). */
export const phase = (t: number, dur: number, begin = 0): number => {
  const p = ((t - begin) / dur) % 1;
  return p < 0 ? p + 1 : p;
};

/** Linear walk through `values` as `p` goes 0..1 (SMIL's default `animate`). */
export function across(values: readonly number[], p: number): number {
  if (values.length < 2) return values[0] ?? 0;
  const at = p * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(at));
  const f = at - i;
  return (values[i] as number) + ((values[i + 1] as number) - (values[i] as number)) * f;
}
