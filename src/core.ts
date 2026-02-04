export type Seed = number;

export interface RunConfig {
  seed?: Seed;
  runs?: number;
}

export function createSeededRng(seed: Seed): () => number {
  // xorshift32 - simple and deterministic
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xffffffff;
  };
}
