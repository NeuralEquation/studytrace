import holidays from "./japan-holidays.json";
import { shiftDate } from "../utils/time";
const dates: Record<string, string> = holidays.dates;
export const holidayCoverage = {
  firstYear: holidays.firstYear,
  lastYear: holidays.lastYear,
  source: holidays.source,
};
export function studyDay(date: string) {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  let name = dates[date];
  if (name === "休日") {
    const prev = dates[shiftDate(date, -1)],
      next = dates[shiftDate(date, 1)];
    name =
      prev && prev !== "休日" && next && next !== "休日"
        ? "国民の休日"
        : "振替休日";
  }
  const known =
    +date.slice(0, 4) >= holidays.firstYear &&
    +date.slice(0, 4) <= holidays.lastYear;
  return {
    weekend: day === 0 || day === 6,
    holiday: name,
    known,
    restDay: day === 0 || day === 6 || !!name,
  };
}
export function calendarWeek(date: string) {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  const start = shiftDate(date, -(day === 0 ? 6 : day - 1));
  return { start, end: shiftDate(start, 6) };
}
