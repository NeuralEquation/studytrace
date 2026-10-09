import { beforeEach, afterAll, expect, it } from "vitest";
import { db, readData } from "../db/database";
import { fixture, stamp, math, withSession } from "./fixtures";
import { importBackup, makeBackup } from "../features/backup/backup";
import {
  dailyEntries,
  reportedStudyTimes,
  saveDailyTime,
} from "../features/study/dailyTime";
import {
  buildWeeklyProgressReport,
  formatDailyStudyTimes,
} from "../domain/report/formatters";
import { addManualRecord, editRecord } from "../features/study/records";
import {
  newAttempt,
  startStudy,
  startTimedStudy,
  stopDisallowedTimers,
} from "../features/study/session";
import { canTimeItem, timerAllowed } from "../features/study/timerPolicy";
import {
  catalog,
  catalogData,
  ensureInorganicCourse,
} from "../features/courses/catalog";
import { localDate } from "../utils/time";
import { modes } from "../types/model";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordEditor } from "../pages/Study/RecordEditor";

it("renders a new record form for every mode before an existing attempt exists", () => {
  for (const mode of modes) {
    const item = { ...fixture().studyItems[0], studyMode: mode };
    expect(
      renderToStaticMarkup(
        createElement(RecordEditor, { createItem: item, onDone: () => {} }),
      ),
    ).toContain("記録を追加");
  }
});

beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
});
afterAll(() => db.close());
async function seed() {
  const d = fixture();
  await importBackup(
    { schemaVersion: 3, exportedAt: stamp, data: d },
    "replace",
  );
  return d;
}
it("uses daily totals instead of adding sessions, retains fallback days and explicit zero", async () => {
  const d = fixture();
  withSession(d, math({ durationSeconds: 600 }), "mathematics");
  const date = localDate(d.studySessions[0].startedAt);
  await importBackup(
    { schemaVersion: 3, exportedAt: stamp, data: d },
    "replace",
  );
  await saveDailyTime(date, 5400, "報告用", undefined);
  expect(reportedStudyTimes(await readData(), date, date).total).toBe(5400);
  const original = (await readData()).settings.find((s) =>
    s.key.endsWith(date),
  )!.value;
  await saveDailyTime(date, 0, "休み", original);
  expect(reportedStudyTimes(await readData(), date, date).total).toBe(0);
  expect(reportedStudyTimes(d, date, date).total).toBe(600);
  await expect(saveDailyTime(date, 1200, "stale", original)).rejects.toThrow(
    "別の画面",
  );
});
it("preserves daily time in backup and uses it in reports even without any item record", async () => {
  await seed();
  await saveDailyTime("2026-10-07", 9000, "昨日", undefined);
  const backup = await makeBackup();
  await importBackup(backup, "replace");
  const d = await readData();
  expect(dailyEntries(d)[0]).toMatchObject({
    date: "2026-10-07",
    seconds: 9000,
  });
  expect(
    formatDailyStudyTimes(d, "2026-10-07", "2026-10-07", true).join(" "),
  ).toContain("2時間30分");
  const report = buildWeeklyProgressReport(d, {
    start: "2026-10-07",
    end: "2026-10-07",
    daily: true,
    detail: "compact",
  });
  expect(report.text).not.toContain("この期間の記録はまだありません");
});
it("rejects invalid dates and totals without saving", async () => {
  await expect(
    saveDailyTime("2026-02-30", 60, "", undefined),
  ).rejects.toThrow();
  await expect(
    saveDailyTime("2026-10-07", 86401, "", undefined),
  ).rejects.toThrow();
  await expect(
    saveDailyTime("2026-10-07", -1, "", undefined),
  ).rejects.toThrow();
  expect(await db.settings.count()).toBe(0);
});
it.each(modes)(
  "adds and edits an untimed past-day %s result without starting a timer",
  async (mode) => {
    const d = await seed();
    const item = { ...d.studyItems[0], studyMode: mode };
    await db.studyItems.put(item);
    const attempt = newAttempt(item, "manual-" + mode);
    const date = "2026-10-05T10:00:00.000Z";
    await addManualRecord(item, attempt, date, 0, "前日以前", true);
    await addManualRecord(item, attempt, date, 0, "前日以前", true);
    let data = await readData();
    expect(data.studySessions).toHaveLength(1);
    expect(data.attempts).toHaveLength(1);
    expect(data.studySessions[0]).toMatchObject({
      startedAt: date,
      endedAt: date,
      source: "manual",
      durationSeconds: 0,
    });
    expect(data.attempts[0].durationSeconds).toBeUndefined();
    await editRecord(
      { session: data.studySessions[0], attempt: data.attempts[0] },
      {
        attempt: data.attempts[0],
        startedAt: "2026-10-04T10:00:00.000Z",
        durationSeconds: 60,
        note: "訂正",
        includeInCoachReport: true,
      },
    );
    data = await readData();
    expect(data.attempts[0].notes).toBe("訂正");
    expect(data.studySessions[0].startedAt).toContain("2026-10-04");
    await importBackup(await makeBackup(), "replace");
    expect((await readData()).attempts[0].id).toBe(attempt.id);
  },
);
it("refuses a stale manual record and invalid exam without a partial session", async () => {
  const d = await seed();
  const item = d.studyItems[0];
  await db.studyItems.update(item.id, { archived: true });
  await expect(
    addManualRecord(item, newAttempt(item, "stale"), stamp, 0, "", false),
  ).rejects.toThrow("変更");
  const exam = { ...item, archived: false, studyMode: "past_exam" as const };
  await db.studyItems.put(exam);
  const attempt = newAttempt(exam, "bad-exam");
  if (attempt.mode !== "past_exam") throw new Error();
  await expect(
    addManualRecord(exam, { ...attempt, score: 101 }, stamp, 60, "", false),
  ).rejects.toThrow("満点");
  expect(await db.studySessions.count()).toBe(0);
});
it("allows only chemistry practice/advanced lessons across the full catalog", () => {
  let allowed = 0;
  for (const c of catalog) {
    const data = catalogData(c.id);
    for (const item of data.studyItems) {
      const unit = data.units.find((u) => u.id === item.unitId)!;
      const expected =
        data.courses[0].subject === "chemistry" &&
        /(?:実践|発展)問題/.test(unit.chapter ?? "");
      expect(timerAllowed(data, item)).toBe(expected);
      if (expected) allowed++;
    }
  }
  expect(allowed).toBe(118);
  const d = fixture();
  expect(canTimeItem(d.studyItems[0], d.courses[0], d.units[0], "all")).toBe(
    true,
  );
});
it("guards the timer entry point and stops old disallowed timers while keeping results recoverable", async () => {
  const d = await seed();
  await expect(startTimedStudy(d.studyItems[0])).rejects.toThrow("化学");
  const old = await startStudy(d.studyItems[0]);
  await stopDisallowedTimers();
  expect((await db.studySessions.get(old))?.endedAt).toBeTruthy();
  expect(await db.settings.get("runner:" + old)).toBeTruthy();
  const chem = { ...d.studyItems[1], title: "実践問題1" };
  await db.studyItems.put(chem);
  const id = await startTimedStudy(chem);
  await stopDisallowedTimers();
  expect((await db.studySessions.get(id))?.endedAt).toBeUndefined();
});
it("adds inorganic once with all 81 lessons and leaves prior course IDs untouched", async () => {
  const before = await seed();
  await Promise.all([ensureInorganicCourse(), ensureInorganicCourse()]);
  const after = await readData();
  const inorganic = after.courses.filter((c) => c.catalogId === "inorganic");
  expect(inorganic).toHaveLength(1);
  expect(
    after.studyItems.filter((i) => i.courseId === inorganic[0].id),
  ).toHaveLength(81);
  for (const course of before.courses)
    expect(after.courses).toContainEqual(course);
  await ensureInorganicCourse();
  expect((await readData()).studyItems).toHaveLength(after.studyItems.length);
});
it("reuses a legacy inorganic course without renumbering or replacing recorded items", async () => {
  const d = await seed();
  const chem = { ...d.courses[1], name: "無機化学", archived: false };
  await db.courses.put(chem);
  const item = d.studyItems[1];
  // Seed the old record while active, then hide its course to exercise restoration.
  await addManualRecord(
    item,
    newAttempt(item, "old-record"),
    stamp,
    0,
    "old",
    false,
  );
  await db.courses.update(chem.id, { archived: true });
  await ensureInorganicCourse();
  expect((await db.courses.get(chem.id))?.archived).toBe(false);
  expect(await db.studyItems.get(item.id)).toEqual(item);
  expect((await db.attempts.get("old-record"))?.notes).toBe("old");
  expect(
    (await readData()).courses.filter((c) => /無機化学/.test(c.name)),
  ).toHaveLength(1);
});
