/**
 * Time utility functions for MT5 timestamps and conversions
 */

export function unixSecondsToIso(sec: number): string {
  if (!sec || isNaN(sec)) return new Date().toISOString();
  return new Date(sec * 1000).toISOString();
}

export function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function isOlderThanHours(timestampMs: number, hours: number): boolean {
  const age = Date.now() - timestampMs;
  return age > hours * 60 * 60 * 1000;
}
