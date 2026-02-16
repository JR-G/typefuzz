# Generators

- `gen.int(min, max)` inclusive integer generator
- `gen.float(min, max)` float generator in `[min, max)`
- `gen.bigint(min, max)` inclusive bigint generator (defaults `0n`-`100n`)
- `gen.bool()` boolean generator
- `gen.string(lengthOrOptions)` string from a character set
- `gen.uuid()` UUID v4 string
- `gen.email()` basic email address
- `gen.date(min, max)` date generator within bounds
- `gen.array(item, length)` fixed-length arrays
- `gen.array(item, { minLength, maxLength })` variable-length arrays
- `gen.uniqueArray(item, { minLength, maxLength })` unique arrays
- `gen.object(shape)` object from generator map
- `gen.record(value, { minKeys, maxKeys })` record with string keys
- `gen.dictionary(key, value, { minKeys, maxKeys })` dictionary with custom keys
- `gen.set(value, { minSize, maxSize })` set generator
- `gen.oneOf(...options)` random choice
- `gen.weightedOneOf(options)` weighted choice
- `gen.frequency(options)` alias for `weightedOneOf`
- `gen.tuple(...items)` heterogeneous tuple
- `gen.optional(item, probability)` optional values
- `gen.constant(value)` constant generator
- `gen.constantFrom(...values)` constant choice
- `gen.map(item, mapper, unmap?)` map values
- `gen.filter(item, predicate, maxAttempts?)` filter values

## `gen.string` charsets

The default character set is lowercase alphanumeric. Use an options object to pick a different set:

```ts
gen.string(8);                                   // 'alphanumeric' (default)
gen.string({ length: 16, charset: 'hex' });      // 0-9a-f
gen.string({ length: 6, charset: 'alpha' });     // a-z
gen.string({ length: 4, charset: 'numeric' });   // 0-9
gen.string({ length: 10, charset: 'ascii' });    // printable ASCII
gen.string({ length: 8, chars: 'ABC123' });      // custom character pool
```

Predefined charsets: `'alphanumeric'`, `'alpha'`, `'hex'`, `'numeric'`, `'ascii'`.

## Conventions

- Inclusive bounds: `gen.int(min, max)`, `gen.bigint(min, max)`, and `gen.date(min, max)` include both ends.
- Half-open ranges: `gen.float(min, max)` generates values in `[min, max)`.
- Fixed or variable arrays: `gen.array(item, length)` for fixed length, `gen.array(item, { minLength, maxLength })` for variable length.
