export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function localDate(input: Date | string = new Date()): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + "T12:00:00");
  while (Number.isFinite(d.getTime()) && localDate(d) <= end) {
    out.push(localDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
export const inPeriod = (stamp: string, start: string, end: string) => {
  const d = localDate(stamp);
  return d >= start && d <= end;
};
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
export function humanTime(s: number) {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60}分` : `${m}分`;
}
export const elapsed = (startedAt: string, at = Date.now()) =>
  Math.max(0, Math.floor((at - new Date(startedAt).getTime()) / 1000));
