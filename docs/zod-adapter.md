# Zod Adapter (Optional)

```ts
import { z } from 'zod';
import { zodArbitrary } from 'typefuzz/zod';

const schema = z.object({
  name: z.string().min(2).max(5),
  count: z.number().int().min(1).max(3)
});

const arb = zodArbitrary(schema);
```

## Supported Zod types

- `z.string`
- `z.number` (including `int`)
- `z.boolean`
- `z.array`
- `z.object`
- `z.record`
- `z.tuple`
- `z.union`
- `z.discriminatedUnion`
- `z.literal`
- `z.enum`
- `z.nativeEnum`
- `z.optional`
- `z.nullable`
- `z.map`
- `z.set`
- `z.bigint`
- `z.date`
- `z.lazy`
- `z.default`
- `z.any` / `z.unknown`
- `z.effects` (transforms, refinements, preprocess)
- `z.undefined` / `z.void`
