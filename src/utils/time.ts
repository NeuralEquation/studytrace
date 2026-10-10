export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function localDate(input: Date | string = new Date()): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input))
    return input;
  const d = typeof input === "string" ? new Date(input) : input;
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export const japanTime = (stamp: string) =>
  new Date(new Date(stamp).getTime() + 9 * 3600000).toISOString().slice(11, 16);
export const japanStamp = (date: string, time: string) =>
  new Date(date + "T" + time + "+09:00").toISOString();
export function shiftDate(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end && Number.isFinite(new Date(d).getTime())) {
    out.push(d);
    d = shiftDate(d, 1);
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
