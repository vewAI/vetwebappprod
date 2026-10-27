/** Format a Date as a `datetime-local` value (local wall time, no timezone). */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parse a `datetime-local` value as the user's local time and return ISO UTC.
 * `new Date("YYYY-MM-DDTHH:mm")` is treated as UTC in some runtimes, which
 * shifts the window and makes a "start now" session look scheduled.
 */
export function fromDatetimeLocalValue(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(s.trim());
  if (!m) return "";
  const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, "0")) : 0;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
    ms
  );
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}
