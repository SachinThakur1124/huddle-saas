/**
 * Parses a query-string integer param strictly: only digits are accepted
 * (no "12.5", "-1", "1e3", or "abc" coerced by `Number()`), and the result
 * is bounds-checked. Returns `null` on anything invalid so the route can
 * respond 400 instead of passing NaN/out-of-range values into a Mongo
 * `.skip()`/`.limit()`, which throws a raw driver error (a 500).
 */
export function parseIntParam(
  value: unknown,
  opts: { default: number; min?: number; max?: number },
): number | null {
  if (value === undefined) return opts.default;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  if (opts.min !== undefined && n < opts.min) return null;
  if (opts.max !== undefined && n > opts.max) return null;
  return n;
}
