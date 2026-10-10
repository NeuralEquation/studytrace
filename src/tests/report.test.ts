import { it, expect } from "vitest";
import { compressItemNumbers } from "../domain/report/compressItemNumbers";
import { selectNotableAttempts } from "../domain/report/selectNotableAttempts";
import {
  buildWeeklyProgressReport,
  formatChemistryWeeklyReport,
  formatPhysicsWeeklyReport,
} from "../domain/report/formatters";
import { fixture, math, speed, stamp, withSession } from "./fixtures";
import { japanStamp } from "../utils/time";
const options = {
  start: "2026-10-07",
  end: "2026-10-14",
  detail: "compact" as const,
  daily: true,
};
it("counts midnight-crossing results and cumulative mastery on the session start day", () => {
  const d = fixture();
  const a = math({
    createdAt: japanStamp("2026-10-08", "00:20"),
    durationSeconds: 1800,
  });
  withSession(d, a, "mathematics");
  d.studySessions[0].startedAt = japanStamp("2026-10-07", "23:50");
  d.studySessions[0].endedAt = a.createdAt;
  const report = buildWeeklyProgressReport(d, {
    ...options,
    end: "2026-10-07",
  });
  const { text } = report;
  expect(text).toContain("再現可能：1/1題");
  expect(text).toContain("演習回数：1回");
  expect(text).toContain("完全独力で完答：1題");
  expect(text).toContain("10/07　30分");
  expect(report.summary).toContainEqual({
    subject: "mathematics",
    count: 1,
    seconds: 1800,
  });
  const nextDay = buildWeeklyProgressReport(d, {
    ...options,
    start: "2026-10-08",
    end: "2026-10-08",
  });
  expect(nextDay.summary).toEqual([]);
  expect(nextDay.text).toContain("10/08　0分");
});
it("separates first chemistry records from improvements", () => {
  const d = fixture();
  const a = speed();
  d.attempts = [a];
  const text = formatChemistryWeeklyReport([a], d).join("\n");
  expect(text).toContain("最速更新：0回");
  expect(text).toContain("初回記録 1題");
});
it("compresses consecutive item numbers", () =>
  expect(compressItemNumbers([53, 54, 55])).toBe("53〜55"));
it("compresses disjoint, unsorted and duplicate numbers", () =>
  expect(compressItemNumbers([56, 53, 54, 53, 60, 62, 61])).toBe(
    "53〜54、56、60〜62",
  ));
it("handles empty and single numbers", () => {
  expect(compressItemNumbers([])).toBe("");
  expect(compressItemNumbers([1])).toBe("1");
});
it("weekly math results use final result per item, counts attempts separately", () => {
  const d = fixture();
  withSession(
    d,
    math({ id: "first", result: "hint", reproducibility: 2 }),
    "mathematics",
  );
  withSession(
    d,
    math({ id: "last", createdAt: "2026-10-08T03:00:00.000Z" }),
    "mathematics",
  );
  const r = buildWeeklyProgressReport(d, options);
  expect(r.text).toContain("完全独力で完答：1題");
  expect(r.text).toContain("ヒント後に完答：0題");
  expect(r.text).toContain("演習回数：2回");
  expect(r.summary[0].count).toBe(1);
});
it("chemistry average includes attempts; PB uses history before the period", () => {
  const d = fixture();
  const previous = speed({
    id: "prev",
    createdAt: "2026-10-06T03:00:00.000Z",
    durationSeconds: 900,
  });
  const a = speed({ durationSeconds: 600 });
  const b = speed({
    id: "b",
    createdAt: "2026-10-08T03:00:00.000Z",
    durationSeconds: 480,
  });
  d.attempts = [previous, a, b];
  const text = formatChemistryWeeklyReport([a, b], d).join("\n");
  expect(text).toContain("09:00");
  expect(text).toContain("2回 / 1題");
  expect(text).toContain("210秒短縮");
});
it("physics averages recall without treating speed as the metric", () => {
  const a = {
    id: "p",
    itemId: "i-physics",
    createdAt: stamp,
    mode: "deep_recall" as const,
    checks: Array(8).fill(true) as boolean[],
    includeInCoachReport: false,
    notes: "",
  };
  const text = formatPhysicsWeeklyReport([
    a,
    {
      ...a,
      id: "b",
      itemId: "other",
      checks: [true, true, false, false, false, false, false, false],
    },
  ]).join("\n");
  expect(text).toContain("1/2題");
  expect(text).toContain("63%");
  expect(text).not.toContain("最速");
});
it("daily and weekly total include manual study and zero days in daily average", () => {
  const d = fixture();
  withSession(d, math(), "mathematics");
  d.studySessions.push({
    id: "manual",
    courseId: "japanese",
    mode: "memorization",
    startedAt: stamp,
    endedAt: stamp,
    durationSeconds: 1200,
    source: "manual",
    includeInCoachReport: false,
  });
  const r = buildWeeklyProgressReport(d, options);
  expect(r.text).toContain("10/07　30分");
  expect(r.text).toContain("期間合計：30分");
  expect(r.text).toContain("1日平均：4分（8日間）");
  expect(r.text).toContain("japanese：1日");
});
it("does not label a reading day as commute without evidence", () => {
  const d = fixture();
  d.studySessions.push({
    id: "m",
    courseId: "civics",
    mode: "reading",
    startedAt: stamp,
    endedAt: stamp,
    durationSeconds: 600,
    source: "manual",
    includeInCoachReport: false,
  });
  expect(buildWeeklyProgressReport(d, options).text).not.toContain("通学中");
});
it("pins rank first and none are dropped even above compact limit", () => {
  const pinned = [
    math({ id: "p1", includeInCoachReport: true }),
    math({ id: "p2", includeInCoachReport: true }),
    math({ id: "p3", includeInCoachReport: true }),
  ];
  const result = selectNotableAttempts(
    [math({ id: "long", durationSeconds: 99999 }), ...pinned],
    2,
  );
  expect(result.map((a) => a.id)).toEqual(["p1", "p2", "p3"]);
});
it("does not emit empty subject sections", () => {
  const d = fixture();
  withSession(d, math(), "mathematics");
  const text = buildWeeklyProgressReport(d, options).text;
  expect(text).toContain("【数学】");
  expect(text).not.toContain("【化学】");
  expect(text).not.toContain("【情報】");
});
it("generation is pure and editing a draft cannot mutate raw data", () => {
  const d = fixture();
  withSession(d, math({ notes: "元のメモを保持" }), "mathematics");
  const before = JSON.stringify(d);
  const r = buildWeeklyProgressReport(d, options);
  const draft = { text: r.text };
  draft.text = "変更した提出文";
  expect(JSON.stringify(d)).toBe(before);
  expect(d.attempts[0].notes).toBe("元のメモを保持");
});
it("deduplicates bottlenecks without rewriting free text and excludes resolved questions", () => {
  const d = fixture();
  withSession(d, math(), "mathematics");
  d.bottlenecks = [1, 2].map((n) => ({
    id: String(n),
    attemptId: "a",
    type: "strategy",
    note: "置換する発想が出なかった",
    createdAt: stamp,
  }));
  d.coachQuestions = [
    { id: "q", createdAt: stamp, text: "未解決質問", resolved: false },
    { id: "q2", createdAt: stamp, text: "解決済み質問", resolved: true },
  ];
  const text = buildWeeklyProgressReport(d, options).text;
  expect(text).toContain("置換する発想が出なかった（2回）");
  expect(text).toContain("未解決質問");
  expect(text).not.toContain("解決済み質問");
});
it("warns about incomplete sessions without blocking output", () => {
  const d = fixture();
  d.studySessions.push({
    id: "active",
    courseId: "mathematics",
    mode: "reproduction",
    startedAt: stamp,
    durationSeconds: 0,
    source: "timer",
    includeInCoachReport: false,
  });
  const r = buildWeeklyProgressReport(d, options);
  expect(r.warnings[0]).toContain("終了していないSession 1件");
  expect(r.text).toContain("期間合計");
});
