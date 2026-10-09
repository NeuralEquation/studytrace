import { z } from "zod";
import type { AppData } from "../../types/model";
import { studyTimes } from "../../domain/study";
import { db } from "../../db/database";
import { now } from "../../utils/time";

export const dailyTimePrefix = "daily-study-time:";
export const dailyTimeSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => {
      const d = new Date(s + "T12:00:00Z");
      return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }),
  seconds: z.number().int().min(0).max(86400),
  note: z.string(),
  updatedAt: z.string().datetime(),
});
export function dailyEntries(data: Pick<AppData, "settings">) {
  return data.settings
    .flatMap((s) => {
      if (!s.key.startsWith(dailyTimePrefix)) return [];
      const parsed = dailyTimeSchema.safeParse(s.value);
      return parsed.success && s.key === dailyTimePrefix + parsed.data.date
        ? [parsed.data]
        : [];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
// A manually entered daily total replaces that day's session sum; never add both.
export function reportedStudyTimes(data: AppData, start: string, end: string) {
  const recorded = studyTimes(
    data.studySessions.filter((s) => !s.deletedAt),
    start,
    end,
  );
  const byDay = { ...recorded.byDay };
  const manual = dailyEntries(data).filter(
    (d) => d.date >= start && d.date <= end,
  );
  for (const d of manual) byDay[d.date] = d.seconds;
  return {
    ...recorded,
    byDay,
    total: Object.values(byDay).reduce((a, b) => a + b, 0),
    manual,
  };
}
export async function saveDailyTime(
  date: string,
  seconds: number,
  note: string,
  original: unknown,
) {
  const value = dailyTimeSchema.parse({
    date,
    seconds,
    note,
    updatedAt: now(),
  });
  await db.transaction("rw", db.settings, async () => {
    const key = dailyTimePrefix + date;
    const current = await db.settings.get(key);
    if (JSON.stringify(current?.value) !== JSON.stringify(original))
      throw new Error(
        "別の画面で日別時間が更新されています。日付を選び直して確認してください。",
      );
    await db.settings.put({ key, value });
  });
  return value;
}
