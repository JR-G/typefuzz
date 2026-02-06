# Changelog

## 0.1.0

Initial release.

- Seeded xorshift32 PRNG with per-iteration RNG forking
- 25+ built-in generators: int, float, bigint, bool, string (with charset
  support), uuid, email, date, array (fixed and variable length), uniqueArray,
  set, record, dictionary, object, tuple, oneOf, weightedOneOf, frequency,
  constantFrom, constant, optional, map, filter
- Shrinking for all generator types with format-preserving shrinkers for
  uuid and email
- Sync and async property runners with configurable run count and shrink budget
- Vitest and Jest integrations via `typefuzz/vitest` and `typefuzz/jest`
- Zod schema adapter via `typefuzz/zod` supporting string, number, bigint,
  boolean, array, object, record, tuple, union, discriminatedUnion, literal,
  enum, nativeEnum, optional, nullable, map, set, date, lazy, default,
  effects, undefined, void, any, unknown
- Failure serialisation with replay hints
