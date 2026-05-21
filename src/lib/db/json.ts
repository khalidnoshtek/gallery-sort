// JSON helpers that survive BigInt round-trips. SQLite columns of type
// BigInt are common in our schema (sizeBytes, totalBytes) and any value
// we serialize for the OperationLog or job payload may transitively
// contain them.

export function stringifyBigIntSafe(value: unknown): string {
  return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

export function bigintFromHex(hex: string): bigint {
  return BigInt("0x" + hex);
}

export function hexFromBigint(n: bigint): string {
  const positive = n < 0n ? n + (1n << 64n) : n;
  return positive.toString(16).padStart(16, "0");
}
