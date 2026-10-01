// pipe-muse core — RNG con semilla (para niveles testeables).
export type Rng = () => number;

/** mulberry32: RNG determinista. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function intRange(rng: Rng, min: number, maxExclusive: number): number {
  return min + Math.floor(rng() * (maxExclusive - min));
}

/** Elige una clave ponderada según pesos. */
export function weightedPick<T extends string>(rng: Rng, weights: Record<T, number>): T {
  let total = 0;
  const keys = Object.keys(weights) as T[];
  for (const k of keys) total += weights[k];
  let r = rng() * total;
  for (const k of keys) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1];
}
