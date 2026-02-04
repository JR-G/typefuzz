export type Gen<T> = (rng: () => number) => T;

export const gen = {
  int(min = 0, max = 100): Gen<number> {
    return (rng) => Math.floor(rng() * (max - min + 1)) + min;
  },
  float(min = 0, max = 1): Gen<number> {
    return (rng) => rng() * (max - min) + min;
  },
  bool(): Gen<boolean> {
    return (rng) => rng() >= 0.5;
  },
  string(length = 8): Gen<string> {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return (rng) => {
      let out = '';
      for (let i = 0; i < length; i += 1) {
        out += chars[Math.floor(rng() * chars.length)];
      }
      return out;
    };
  },
  array<T>(item: Gen<T>, length = 5): Gen<T[]> {
    return (rng) => Array.from({ length }, () => item(rng));
  },
  object<T extends Record<string, Gen<any>>>(shape: T): Gen<{ [K in keyof T]: ReturnType<T[K]> }> {
    return (rng) => {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        out[key] = shape[key as keyof T](rng);
      }
      return out as { [K in keyof T]: ReturnType<T[K]> };
    };
  }
};
