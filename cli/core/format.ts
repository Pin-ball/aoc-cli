/** Microseconds below a millisecond, milliseconds below a second, then seconds. */
export function duration(micros: number): string {
  if (micros < 1000) return `${micros} µs`;

  const ms = micros / 1000;
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  const whole = Math.round(ms);
  if (whole < 1000) return `${whole} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * How long a part took, rounded to minutes. Anything finer is meaningless here:
 * the clock starts when you fetched the puzzle, not when you started thinking.
 */
export function elapsed(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const minutes = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;

  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
  return `${Math.floor(hours / 24)}d${hours % 24}h`;
}
