/**
 * Internal utilities shared between generators and adapters.
 */

export function randomInt(randomSource: () => number, min: number, max: number): number {
  return Math.floor(randomSource() * (max - min + 1)) + min;
}

export function randomString(randomSource: () => number, length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(randomSource() * chars.length)]).join('');
}

export function* shrinkString(value: string): Iterable<string> {
  if (value.length === 0) {
    return;
  }
  yield '';
  let length = Math.floor(value.length / 2);
  while (length > 0) {
    yield value.slice(0, length);
    length = Math.floor(length / 2);
  }
}

export function shrinkLengths(length: number): number[] {
  if (length === 0) {
    return [];
  }
  const lengths: number[] = [];
  let currentLength = Math.floor(length / 2);
  while (currentLength >= 0) {
    lengths.push(currentLength);
    if (currentLength === 0) {
      break;
    }
    currentLength = Math.floor(currentLength / 2);
  }
  return lengths;
}

export function replaceAt<T>(items: T[], index: number, value: T): T[] {
  const next = items.slice();
  next[index] = value;
  return next;
}
