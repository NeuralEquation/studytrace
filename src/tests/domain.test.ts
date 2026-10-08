import { describe, it, expect } from "vitest";
import {
  personalBest,
  mathStatus,
  recallScore,
  dailyTarget,
  courseProgress,
  studyTimes,
  sprintProgress,
  videoPace,
} from "../domain/study";
import {
  backupSchema,
  courseImportSchema,
  csv,
} from "../features/backup/backup";
import { fixture, math, speed, withSession, stamp } from "./fixtures";
import type { SprintGoal } from "../types/model";
describe("chemistry PB", () => {
  it("only compares fully correct attempts and same item", () => {
    const previous = speed({
      id: "prev",
      durationSeconds: 522,
      createdAt: "2026-10-06T03:00:00.000Z",
    });
    const current = speed({ durationSeconds: 478 });
    const result = personalBest(
      [
        previous,
        speed({ id: "fastwrong", result: "incorrect", durationSeconds: 1 }),
        speed({ id: "other", itemId: "other", durationSeconds: 1 }),
      ],
      current,
    );
    expect(result.best).toBe(522);
    expect(result.isNewBest).toBe(true);
    expect(result.improvement).toBe(44);
    expect(result.percent).toBeCloseTo(8.43, 2);
  });
  it("does not reward inaccurate or zero duration attempts, ties or future records", () => {
    expect(personalBest([], speed({ accuracy: 99 })).isNewBest).toBe(false);
    expect(personalBest([], speed({ durationSeconds: 0 })).isNewBest).toBe(
      false,
    );
    expect(
      personalBest(
        [speed({ id: "earlier", createdAt: "2026-10-06T03:00:00.000Z" })],
        speed(),
      ).isNewBest,
    ).toBe(false);
    expect(
      personalBest(
        [
          speed({
            id: "future",
            createdAt: "2026-10-08T03:00:00.000Z",
            durationSeconds: 1,
          }),
        ],
        speed(),
      ).isNewBest,
    ).toBe(true);
  });
});
describe("mathematics mastery", () => {
  const item = fixture().studyItems[0];
  it("starts unseen and retains explicit baseline", () => {
    expect(mathStatus(item, [])).toBe("UNSEEN");
    expect(mathStatus({ ...item, initialStatus: "ATTEMPTED" }, [])).toBe(
      "ATTEMPTED",
    );
  });
  it("one perfect answer is reproducible, never stable", () =>
    expect(mathStatus(item, [math()])).toBe("REPRODUCIBLE"));
  it("needs two spaced successes; later failure lowers status", () => {
    const second = math({ id: "b", createdAt: "2026-10-10T03:00:00.000Z" });
    expect(mathStatus(item, [math(), second])).toBe("STABLE");
    expect(
      mathStatus(item, [
        math(),
        math({ id: "same", createdAt: "2026-10-07T04:00:00.000Z" }),
      ]),
    ).toBe("REPRODUCIBLE");
    expect(
      mathStatus(item, [
        math(),
        second,
        math({
          id: "c",
          createdAt: "2026-10-11T03:00:00.000Z",
          result: "failed",
          reproducibility: 1,
        }),
      ]),
    ).toBe("ATTEMPTED");
  });
  it("distinguishes understood from independent recall", () =>
    expect(
      mathStatus(item, [
        math({ result: "solution_understood", reproducibility: 5 }),
      ]),
    ).toBe("UNDERSTOOD"));
});
it("physics scores settings and reasoning separately", () =>
  expect(
    recallScore([true, true, false, false, true, false, false, true]),
  ).toEqual({
    setupRecall: 50,
    reasoningRecall: 50,
    solutionRecall: 100,
    overallRecall: 50,
  }));
it("chooses local weekday/weekend, including Sunday", () => {
  const rules = { weekdays: { min: 2, max: 3 }, weekends: { min: 5, max: 6 } };
  expect(dailyTarget(rules, "2026-10-07")).toEqual(rules.weekdays);
  expect(dailyTarget(rules, "2026-10-10")).toEqual(rules.weekends);
  expect(dailyTarget(rules, "2026-10-11")).toEqual(rules.weekends);
});
it("course progress counts unique registered items and baseline, no hardcoded totals", () => {
  const d = fixture();
  const i = d.studyItems[0];
  expect(
    courseProgress([{ ...i, initialStatus: "UNDERSTOOD" }], []).completed,
  ).toBe(0);
  expect(
    courseProgress([{ ...i, initialStatus: "REPRODUCIBLE" }], []).completed,
  ).toBe(1);
  expect(
    courseProgress(
      [
        i,
        { ...i, id: "b", initialStatus: "ATTEMPTED" },
        { ...i, id: "archived", archived: true },
      ],
      [math(), math({ id: "repeat" })],
    ),
  ).toMatchObject({
    total: 2,
    attempted: 2,
    reproducible: 1,
    stable: 0,
    remaining: 0,
  });
});
it("aggregates manual time, assigns overnight to start date, excludes unfinished", () => {
  const d = fixture();
  d.studySessions = [
    {
      id: "s",
      courseId: "mathematics",
      mode: "reproduction",
      startedAt: new Date("2026-10-07T23:50:00").toISOString(),
      endedAt: new Date("2026-10-08T00:20:00").toISOString(),
      durationSeconds: 1800,
      source: "timer",
      includeInCoachReport: false,
    },
    {
      id: "m",
      courseId: "chemistry",
      mode: "speed",
      startedAt: stamp,
      endedAt: stamp,
      durationSeconds: 600,
      source: "manual",
      includeInCoachReport: false,
    },
    {
      id: "u",
      courseId: "physics",
      mode: "deep_recall",
      startedAt: stamp,
      durationSeconds: 999,
      source: "timer",
      includeInCoachReport: false,
    },
  ];
  const t = studyTimes(d.studySessions, "2026-10-07", "2026-10-07");
  expect(t.total).toBe(2400);
  expect(t.byCourse).toEqual({ mathematics: 1800, chemistry: 600 });
});
it("sprint count deduplicates same problem, not attempt count", () => {
  const d = fixture();
  withSession(d, math(), "mathematics");
  withSession(d, math({ id: "b" }), "mathematics");
  const g: SprintGoal = {
    id: "g",
    sprintId: "s",
    courseId: "mathematics",
    kind: "daily_count",
    title: "goal",
    target: 2,
    weekdays: { min: 2, max: 3 },
    completed: false,
  };
  expect(
    sprintProgress(g, d, "2026-10-07", "2026-10-14", "2026-10-07"),
  ).toEqual({ actual: 1, target: 2, ratio: 0.5 });
  expect(
    sprintProgress(
      { ...g, kind: "specific_task", itemId: "i-mathematics" },
      d,
      "2026-10-07",
      "2026-10-14",
    ).actual,
  ).toBe(1);
});
describe("backup validation", () => {
  const valid = () => ({
    schemaVersion: 2,
    exportedAt: stamp,
    data: fixture(),
  });
  it("accepts complete backup and version 1 without drafts", () => {
    expect(backupSchema.safeParse(valid()).success).toBe(true);
    expect(
      backupSchema.safeParse({
        ...valid(),
        schemaVersion: 1,
        data: { ...fixture(), progressReportDrafts: undefined },
      }).success,
    ).toBe(true);
  });
  it("rejects unknown schema, duplicate IDs and broken course links", () => {
    expect(
      backupSchema.safeParse({ ...valid(), schemaVersion: 99 }).success,
    ).toBe(false);
    const d = fixture();
    d.courses.push(d.courses[0]);
    expect(backupSchema.safeParse({ ...valid(), data: d }).success).toBe(false);
    const broken = fixture();
    broken.studyItems[0].courseId = "missing";
    expect(backupSchema.safeParse({ ...valid(), data: broken }).success).toBe(
      false,
    );
  });
  it("rejects invalid URL, result, NaN and impossible dates", () => {
    expect(
      courseImportSchema.safeParse({
        name: "x",
        subject: "information",
        externalUrl: "javascript:alert(1)",
        units: [],
      }).success,
    ).toBe(false);
    const d = fixture();
    d.attempts.push({ ...math(), reproducibility: 9 });
    expect(backupSchema.safeParse({ ...valid(), data: d }).success).toBe(false);
    d.attempts = [];
    d.sprints.push({
      id: "s",
      title: "x",
      startDate: "2026-02-30",
      endDate: "2026-03-02",
    });
    expect(backupSchema.safeParse({ ...valid(), data: d }).success).toBe(false);
  });
});
it("video pace requires a known denominator and dates", () => {
  expect(videoPace(10, 2, "2026-10-01", "2026-10-11", "2026-10-10")).toBe(
    "遅れ",
  );
  expect(videoPace(10, 9, "2026-10-01", "2026-10-11", "2026-10-03")).toBe(
    "前倒し",
  );
  expect(videoPace(0, 0)).toContain("登録");
});
it("CSV neutralizes spreadsheet formulas and escapes quotes", () => {
  const d = fixture();
  d.courses[0].name = "=DANGEROUS()";
  withSession(d, math({ notes: '"quoted"' }), "mathematics");
  const result = csv(d);
  expect(result).toContain("'=DANGEROUS()");
  expect(result).toContain('""quoted');
});
