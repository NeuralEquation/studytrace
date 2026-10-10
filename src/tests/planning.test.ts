import { it, expect, beforeEach, afterAll, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { fixture, math, speed, withSession, stamp } from "./fixtures";
import type { SprintGoal } from "../types/model";
import { goalSchema } from "../types/model";
import { studyDay, calendarWeek } from "../domain/calendar";
import { dailyTarget, sprintProgress, goalItems } from "../domain/study";
import {
  goalState,
  todayTasks,
  prioritiesKey,
  presetChanges,
} from "../domain/planning";
import { localDate, japanStamp, dateRange } from "../utils/time";
import { db, readData } from "../db/database";
import {
  importBackup,
  makeBackup,
  backupSchema,
} from "../features/backup/backup";
import { editRecord, setRecordDeleted } from "../features/study/records";
import { Today } from "../pages/Today/Today";
import { Records } from "../pages/Study/Records";
import { WeeklyReport } from "../pages/Coach/WeeklyReport";
import { GoalEditor } from "../pages/GoalEditor";
import {
  deleteUnusedUnit,
  unitDeletionInfo,
} from "../features/courses/deleteUnit";
import {
  assignLesson,
  catalog,
  catalogData,
} from "../features/courses/catalog";
const date = "2026-10-10";
function data() {
  const d = fixture();
  d.sprints.push({
    id: "s",
    title: "受験計画",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
  });
  return d;
}
function goal(extra: Partial<SprintGoal> = {}): SprintGoal {
  return {
    id: "g",
    sprintId: "s",
    courseId: "mathematics",
    title: "数学のノルマ",
    kind: "daily_count",
    target: 2,
    weekdays: { min: 2, max: 3 },
    weekends: { min: 5, max: 6 },
    completed: false,
    ...extra,
  };
}
beforeEach(async () => {
  vi.useRealTimers();
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
});
afterAll(() => {
  vi.useRealTimers();
  db.close();
});
it.each([
  ["2026-10-10", true, undefined],
  ["2026-10-11", true, undefined],
  ["2026-10-12", true, "スポーツの日"],
  ["2026-10-13", false, undefined],
  ["2026-05-06", true, "振替休日"],
  ["2026-09-22", true, "国民の休日"],
  ["2027-03-22", true, "振替休日"],
])("uses official offline holidays for %s", (date, restDay, holiday) => {
  expect(studyDay(date)).toMatchObject({ restDay, holiday, known: true });
  expect(dailyTarget(goal(), date)?.min).toBe(restDay ? 5 : 2);
});
it("marks years beyond the official dataset as unconfirmed", () =>
  expect(studyDay("2028-10-09").known).toBe(false));
it("attributes midnight boundaries to Japan independently of the host timezone", () => {
  expect(localDate("2026-10-09T15:00:00Z")).toBe("2026-10-10");
  expect(localDate("2026-10-09T14:59:59Z")).toBe("2026-10-09");
  expect(japanStamp("2026-10-10", "00:00")).toBe("2026-10-09T15:00:00.000Z");
  expect(dateRange("2026-10-10", "2026-10-13")).toEqual([
    "2026-10-10",
    "2026-10-11",
    "2026-10-12",
    "2026-10-13",
  ]);
});
it("offers math, chemistry and separate weekly physics presets without mutating saved goals", () => {
  const old = goal();
  const before = structuredClone(old);
  const mathPlan = presetChanges("math"),
    chem = presetChanges("chemistry");
  expect(mathPlan).toMatchObject({
    weekdays: { min: 2, max: 3 },
    weekends: { min: 5, max: 6 },
  });
  expect(chem).toMatchObject({
    weekdays: { min: 2 },
    weekends: { min: 7, max: 8 },
  });
  for (let i = 0; i < 4; i++)
    expect(presetChanges("physics-" + i)).toMatchObject({
      kind: "weekly_count",
      weeklyPeriod: "calendar",
      weeklyRange: { min: 1, max: 2 },
    });
  expect(old).toEqual(before);
});
function chemistry() {
  const d = data();
  for (const [n, count] of [
    [0, 3],
    [1, 2],
    [2, 2],
  ]) {
    const courseId = "chem-" + n,
      unitId = "chem-unit-" + n;
    d.courses.push({
      ...d.courses.find((c) => c.id === "chemistry")!,
      id: courseId,
      name: ["理論", "無機", "有機"][n] + "実戦問題",
    });
    d.units.push({
      id: unitId,
      courseId,
      name: "実戦問題",
      order: n,
      archived: false,
    });
    for (let i = 0; i < count; i++) {
      const itemId = courseId + "-" + i;
      d.studyItems.push({
        ...d.studyItems.find((i) => i.courseId === "chemistry")!,
        id: itemId,
        courseId,
        unitId,
      });
      withSession(
        d,
        speed({ id: itemId, itemId, createdAt: japanStamp(date, "12:00") }),
        courseId,
      );
    }
  }
  const g = goal({
    courseId: "chem-0",
    title: "化学全体",
    scope: { courseIds: ["chem-0", "chem-1", "chem-2"] },
    ...presetChanges("chemistry"),
  });
  d.sprintGoals.push(g);
  return { d, g };
}
it("combines theory 3 + inorganic 2 + organic 2 into one chemistry quota of 7", () => {
  const { d, g } = chemistry();
  expect(goalState(g, d, date)).toMatchObject({
    actual: 7,
    target: 7,
    max: 8,
    remaining: 0,
    achieved: true,
  });
  expect(todayTasks(d, date).filter((t) => t.goal?.id === g.id)).toHaveLength(
    1,
  );
  expect(
    todayTasks(d, date).filter((t) =>
      t.courses.some((c) => ["chem-0", "chem-1", "chem-2"].includes(c.id)),
    ),
  ).toHaveLength(1);
  expect(goalState(g, d, "2026-10-13")).toMatchObject({
    target: 2,
    actual: 0,
    achieved: false,
  });
});
it("deduplicates repeat attempts and overlapping selectors, but attributes each learning date correctly", () => {
  const { d, g } = chemistry();
  const item = d.studyItems.find((i) => i.id === "chem-0-0")!;
  g.scope!.unitIds = [item.unitId];
  g.scope!.itemIds = [item.id];
  withSession(
    d,
    speed({
      id: "repeat",
      itemId: item.id,
      createdAt: japanStamp(date, "15:00"),
    }),
    "chem-0",
  );
  withSession(
    d,
    speed({
      id: "nextday",
      itemId: item.id,
      createdAt: japanStamp("2026-10-11", "00:01"),
    }),
    "chem-0",
  );
  expect(goalItems(g, d)).toHaveLength(7);
  expect(goalState(g, d, date).actual).toBe(7);
  expect(goalState(g, d, "2026-10-11").actual).toBe(1);
});
it("restricts selections to explicit units and items instead of all videos in a course", () => {
  const { d, g } = chemistry();
  g.scope = { courseIds: [], unitIds: ["chem-unit-0"], itemIds: ["chem-1-0"] };
  expect(goalState(g, d, date).actual).toBe(4);
  expect(goalItems(g, d).every((i) => i.id !== "i-chemistry")).toBe(true);
});
it("keeps legacy period counts and calendar weekly counts distinct from daily quotas", () => {
  const d = data();
  const g = goal({
    courseId: "physics",
    kind: "weekly_count",
    target: 1,
    weeklyPeriod: "calendar",
    weeklyRange: { min: 1, max: 2 },
  });
  withSession(
    d,
    {
      ...math({
        id: "old",
        itemId: "i-physics",
        createdAt: japanStamp("2026-10-04", "12:00"),
      }),
      mode: "reproduction",
    },
    "physics",
  );
  expect(calendarWeek(date)).toEqual({
    start: "2026-10-05",
    end: "2026-10-11",
  });
  expect(goalState(g, d, date)).toMatchObject({ actual: 0, target: 1, max: 2 });
  expect(
    sprintProgress(
      { ...g, weeklyPeriod: "sprint" },
      d,
      "2026-10-01",
      "2026-10-31",
      date,
    ).actual,
  ).toBe(1);
  withSession(
    d,
    math({
      id: "week",
      itemId: "i-physics",
      createdAt: japanStamp("2026-10-09", "12:00"),
    }),
    "physics",
  );
  expect(goalState(g, d, date).actual).toBe(1);
});
it("distinguishes missing goals and explicit zero, including missing day-specific ranges", () => {
  const d = data();
  expect(
    goalState(
      goal({ target: undefined, weekdays: undefined, weekends: undefined }),
      d,
      date,
    ),
  ).toMatchObject({ configured: false, achieved: false, remaining: undefined });
  expect(
    goalState(
      goal({ target: 0, weekdays: undefined, weekends: undefined }),
      d,
      date,
    ),
  ).toMatchObject({ configured: true, achieved: true, remaining: 0 });
  expect(
    goalState(goal({ target: undefined, weekends: undefined }), d, date)
      .configured,
  ).toBe(false);
});
it("orders daily unmet, period unmet, completed, then no quota, with all subjects eligible", () => {
  const d = data();
  d.sprintGoals = [
    goal({ id: "civics", courseId: "civics" }),
    goal({ id: "japanese", courseId: "japanese" }),
    goal({ id: "week", courseId: "physics", kind: "weekly_count", target: 2 }),
    goal({ id: "done", courseId: "mathematics", weekends: { min: 0 } }),
  ];
  const tasks = todayTasks(d, date);
  expect(tasks.map((t) => t.category)).toEqual(
    [...tasks.map((t) => t.category)].sort(),
  );
  expect(
    tasks
      .slice(0, 2)
      .map((t) => t.goal?.id)
      .sort(),
  ).toEqual(["civics", "japanese"]);
  expect(tasks.find((t) => t.id === "week")?.category).toBe(1);
  expect(tasks.find((t) => t.id === "done")?.category).toBe(2);
});
it("applies active Coach priorities before user subject priorities and ignores expired directives", () => {
  const d = data();
  d.sprintGoals = [
    goal({ id: "math" }),
    goal({ id: "chem", courseId: "chemistry" }),
  ];
  d.settings.push({
    key: prioritiesKey,
    value: { subjects: ["chemistry", "mathematics"], courses: [] },
  });
  expect(todayTasks(d, date)[0].id).toBe("chem");
  d.coachDirectives.push({
    id: "d",
    coachSessionId: "c",
    subject: "mathematics",
    priority: "high",
    text: "数学優先",
    activeFrom: date,
    activeUntil: date,
  });
  expect(todayTasks(d, date)[0].id).toBe("math");
  d.coachDirectives[0].activeUntil = "2026-10-09";
  expect(todayTasks(d, date)[0].id).toBe("chem");
});
it("orders course priorities and deadlines deterministically, independent of input order", () => {
  const d = data();
  d.courses.push({ ...d.courses[0], id: "math2" });
  d.sprintGoals = [goal({ id: "b", courseId: "math2" }), goal({ id: "a" })];
  d.settings.push({
    key: prioritiesKey,
    value: { subjects: [], courses: ["math2", "mathematics"] },
  });
  expect(todayTasks(d, date)[0].id).toBe("b");
  const expected = todayTasks(d, date).map((t) => t.id);
  d.courses.reverse();
  d.sprintGoals.reverse();
  expect(todayTasks(d, date).map((t) => t.id)).toEqual(expected);
});
it("breaks ties by unmet goal count and then deadline", () => {
  const d = data();
  d.sprints.push({
    id: "early",
    title: "早い締切",
    startDate: "2026-10-01",
    endDate: "2026-10-11",
  });
  d.sprintGoals = [
    goal({ id: "a", sprintId: "early" }),
    goal({ id: "b", courseId: "chemistry" }),
  ];
  expect(todayTasks(d, date)[0].id).toBe("a");
  d.sprintGoals.push(goal({ id: "b2", courseId: "chemistry" }));
  expect(todayTasks(d, date)[0].id).toBe("b");
});
it("clips calendar-week progress to the Sprint period and ignores inactive Sprint goals", () => {
  const d = data();
  d.sprints[0].startDate = date;
  const g = goal({ kind: "weekly_count", weeklyPeriod: "calendar" });
  d.sprintGoals.push(g);
  withSession(
    d,
    math({ createdAt: japanStamp("2026-10-09", "12:00") }),
    "mathematics",
  );
  expect(goalState(g, d, date).actual).toBe(0);
  expect(todayTasks(d, "2026-09-30").filter((t) => t.goal)).toHaveLength(0);
});
it("shows every applicable goal and updates priority after its minimum is reached", () => {
  const d = data();
  d.sprintGoals = [
    goal({ id: "one", weekends: { min: 1, max: 2 } }),
    goal({ id: "two", target: 3, kind: "weekly_count" }),
  ];
  expect(todayTasks(d, date).filter((t) => t.goal)).toHaveLength(2);
  withSession(d, math({ createdAt: japanStamp(date, "12:00") }), "mathematics");
  expect(todayTasks(d, date).find((t) => t.id === "one")?.category).toBe(2);
  expect(todayTasks(d, date)[0].id).toBe("two");
});
it("preserves old and new backup goals, preferences, IDs and records in export/import", async () => {
  const d = data();
  const old = goal();
  const multi = goal({
    id: "multi",
    scope: {
      courseIds: ["mathematics", "chemistry"],
      unitIds: ["u-physics"],
      itemIds: ["i-japanese"],
    },
    weeklyPeriod: "calendar",
  });
  d.sprintGoals = [old, multi];
  d.settings.push({
    key: prioritiesKey,
    value: { subjects: ["japanese"], courses: ["mathematics"] },
  });
  for (const v of [1, 2, 3, 4])
    expect(
      backupSchema.safeParse({ schemaVersion: v, exportedAt: stamp, data: d })
        .success,
    ).toBe(true);
  await importBackup(
    { schemaVersion: 3, exportedAt: stamp, data: d },
    "replace",
  );
  const exported = await makeBackup();
  expect(exported.schemaVersion).toBe(4);
  expect(exported.data.sprintGoals).toContainEqual(old);
  expect(exported.data.sprintGoals).toContainEqual(multi);
  await importBackup(exported, "replace");
  expect((await readData()).settings).toContainEqual(d.settings[0]);
  const bad = structuredClone(d);
  bad.sprintGoals[1].scope!.unitIds = ["missing"];
  expect(
    backupSchema.safeParse({ schemaVersion: 4, exportedAt: stamp, data: bad })
      .success,
  ).toBe(false);
});
it("recounts edited, deleted and restored records and reorders the affected task", async () => {
  const d = data();
  d.sprintGoals = [goal({ weekends: { min: 1 } })];
  withSession(d, math({ createdAt: japanStamp(date, "12:00") }), "mathematics");
  await importBackup(
    { schemaVersion: 4, exportedAt: stamp, data: d },
    "replace",
  );
  const saved = await readData();
  const a = saved.attempts[0],
    s = saved.studySessions[0];
  expect(goalState(d.sprintGoals[0], d, date).actual).toBe(1);
  await editRecord(
    { attempt: a, session: s },
    {
      attempt: a,
      startedAt: japanStamp("2026-10-11", "12:00"),
      durationSeconds: 600,
      note: "翌日へ訂正",
      includeInCoachReport: false,
    },
  );
  let current = await readData();
  expect(goalState(d.sprintGoals[0], current, date).actual).toBe(0);
  expect(goalState(d.sprintGoals[0], current, "2026-10-11").actual).toBe(1);
  await setRecordDeleted(a.id, s.id, true);
  current = await readData();
  expect(goalState(d.sprintGoals[0], current, "2026-10-11").actual).toBe(0);
  await setRecordDeleted(a.id, s.id, false);
  current = await readData();
  expect(goalState(d.sprintGoals[0], current, "2026-10-11").actual).toBe(1);
});
function render(component: ReturnType<typeof createElement>, path = "/") {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [path] }, component),
  );
}
it("renders multiple goal cards, all subjects, compact time and no time input on Today", () => {
  vi.useFakeTimers();
  vi.setSystemTime(japanStamp(date, "12:00"));
  const d = data();
  d.sprintGoals = [
    goal({ title: "日別数学" }),
    goal({ id: "g2", title: "国語ノルマ", courseId: "japanese" }),
  ];
  const html = render(createElement(Today, { data: d }));
  expect(html).toContain("日別数学");
  expect(html).toContain("国語ノルマ");
  expect(html).toContain("最低ノルマまであと5題");
  expect(html).toContain("今日の勉強時間");
  expect(html).not.toContain("報告用の日別勉強時間");
  expect(html).not.toContain("すきま時間");
});
it("renders time editing only in the time tab, retaining history editing in its own tab", () => {
  const d = data();
  const time = render(createElement(Records, { data: d }), "/records?tab=time");
  const history = render(
    createElement(Records, { data: d }),
    "/records?tab=history",
  );
  expect(time).toContain("報告用の日別勉強時間");
  expect(time).toContain("日別の集計");
  expect(history).not.toContain("報告用の日別勉強時間");
  expect(history).toContain("削除済みを表示");
});
it("renders report summaries without duplicate time input forms", () => {
  expect(
    render(createElement(WeeklyReport, { data: data() }), "/report"),
  ).not.toContain("報告用の日別勉強時間");
});
it("opens new goals without universal preset numbers and requires an explicit selection", () => {
  const g = goal({
    title: "",
    target: undefined,
    weekdays: undefined,
    weekends: undefined,
    scope: { courseIds: [] },
  });
  const html = render(
    createElement(GoalEditor, { value: g, data: data(), onDone: () => {} }),
  );
  expect(html).toContain("選んで差分を確認");
  expect(html).not.toContain('value="2"');
  expect(html).not.toContain('checked=""');
  expect(html).toContain("未設定");
  expect(
    goalSchema.parse({ ...g, title: "新しい目標" }).target,
  ).toBeUndefined();
});
it("protects unit and item scope references when deleting unused units", async () => {
  const d = data();
  const g = goal({ scope: { courseIds: [], unitIds: ["u-mathematics"] } });
  d.sprintGoals = [g];
  expect(unitDeletionInfo(d, "u-mathematics").canDelete).toBe(false);
  await importBackup(
    { schemaVersion: 4, exportedAt: stamp, data: d },
    "replace",
  );
  await expect(deleteUnusedUnit("u-mathematics")).rejects.toThrow("関連付け");
  expect(await db.units.get("u-mathematics")).toBeDefined();
  g.scope = { courseIds: [], itemIds: ["i-mathematics"] };
  expect(unitDeletionInfo(d, "u-mathematics").canDelete).toBe(false);
});
it("refuses to merge a canonical duplicate referenced by a new multi-target goal", async () => {
  const d = data();
  const c = d.courses.find((c) => c.id === "mathematics")!;
  c.catalogId = "special_math";
  const incoming = catalogData("special_math", c);
  d.units.push(...incoming.units);
  d.studyItems.push(...incoming.studyItems);
  const target = incoming.studyItems[0];
  d.sprintGoals = [goal({ scope: { courseIds: [], itemIds: [target.id] } })];
  await importBackup(
    { schemaVersion: 4, exportedAt: stamp, data: d },
    "replace",
  );
  await expect(
    assignLesson(
      "i-mathematics",
      "special_math",
      catalog.find((c) => c.id === "special_math")!.lessons[0].key,
    ),
  ).rejects.toThrow("既存の記録・参照");
  expect((await db.studyItems.get(target.id))?.archived).toBe(false);
});
