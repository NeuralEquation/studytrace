import { beforeEach, afterEach, afterAll, expect, it, vi } from "vitest";
import { db, readData } from "../db/database";
import { fixture, math, speed, stamp } from "./fixtures";
import {
  importBackup,
  backupSchema,
  makeBackup,
} from "../features/backup/backup";
import { meimonData } from "../features/courses/meimon";
import {
  ensureRoutinePlan,
  routineGoalIds,
  routinePlanKey,
} from "../features/study/routinePlan";
import { goalItems } from "../domain/study";
import { activeGoals, goalState, todayTasks } from "../domain/planning";
import {
  courseStudyEntry,
  goalStudyItems,
  nextStudyItem,
} from "../features/study/itemNavigation";
import { writeViewState } from "../features/navigation/viewState";
import { isChemistryPractice } from "../domain/studySelection";

function input() {
  const data = fixture();
  data.courses[0].name = "特別応用講座【数学】";
  data.courses[0].catalogId = "special_math";
  data.courses.push({
    ...data.courses[0],
    id: "cards",
    catalogId: "math_cards",
    name: "数学解法カード【無料公開】",
  });
  data.units.push({ ...data.units[0], id: "cards-unit", courseId: "cards" });
  data.studyItems.push({
    ...data.studyItems[0],
    id: "cards-question",
    courseId: "cards",
    unitId: "cards-unit",
  });
  data.attempts.push(math({ id: "saved-cards", itemId: "cards-question" }));
  for (const n of [0, 1, 2]) {
    const courseId = n === 0 ? "chemistry" : "chemistry-" + n;
    if (n)
      data.courses.push({
        ...data.courses[1],
        id: courseId,
        name: n === 1 ? "有機化学" : "無機化学",
      });
    for (const [key, name] of [
      ["lecture", "講義"],
      ["practice", "実践問題"],
      ["advanced", "発展問題"],
    ]) {
      const unitId = courseId + ":" + key;
      data.units.push({
        id: unitId,
        courseId,
        name,
        chapter: name,
        order: n * 3 + 1,
        archived: false,
      });
      for (const q of [1, 2])
        data.studyItems.push({
          ...data.studyItems[1],
          id: unitId + ":" + q,
          courseId,
          unitId,
          title: "第" + q + "問",
          order: q,
        });
    }
  }
  const books = meimonData();
  data.courses.push(...books.courses);
  data.units.push(...books.units);
  data.studyItems.push(...books.studyItems);
  data.sprints.push({
    id: "old",
    title: "旧Sprint",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
  });
  for (const [id, courseId] of [
    ["math", "mathematics"],
    ["chemistry", "chemistry"],
    ["physics", "physics"],
  ])
    data.sprintGoals.push({
      id: "old-" + id,
      sprintId: "old",
      courseId,
      title: id,
      kind: id === "physics" ? "weekly_count" : "daily_count",
      target: 2,
      weekdays: id === "math" ? { min: 2, max: 3 } : { min: 2 },
      weekends: id === "math" ? { min: 5, max: 6 } : { min: 7, max: 8 },
      completed: false,
    });
  data.settings.push({
    key: "today-priorities:v1",
    value: {
      courses: ["chemistry-2", "chemistry", "mathematics"],
      subjects: ["chemistry"],
    },
  });
  return data;
}
async function setup() {
  const data = input();
  await importBackup({ schemaVersion: 4, exportedAt: stamp, data }, "replace");
  await ensureRoutinePlan("2026-10-17");
  return readData();
}
beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => db.close());
it("respects important-only material entry even before continuing-goal installation", () => {
  const data = meimonData(),
    courseId = data.courses[0].id;
  const one = data.studyItems.find(
      (i) => i.courseId === courseId && i.number === 1,
    )!,
    two = data.studyItems.find(
      (i) => i.courseId === courseId && i.number === 2,
    )!;
  data.attempts.push(
    ...[one, two].map((item, n) => ({
      id: "p" + n,
      itemId: item.id,
      mode: "deep_recall" as const,
      createdAt: "2026-10-17T00:00:0" + n + "Z",
      notes: "",
      checks: Array(8).fill(false),
      includeInCoachReport: false,
    })),
  );
  expect(courseStudyEntry(data, courseId, "2026-10-17").item?.number).toBe(4);
  expect(
    courseStudyEntry(data, courseId, "2026-10-17", false).item?.number,
  ).toBe(3);
});
it("persists three continuing quotas, retires old ones without deleting them and hides cards without changing records", async () => {
  const old = input(),
    data = await setup();
  expect(
    activeGoals(data, "2026-10-17")
      .map((g) => g.id)
      .sort(),
  ).toEqual(Object.values(routineGoalIds).sort());
  expect(activeGoals(data, "2027-01-01")).toHaveLength(3);
  expect(data.sprintGoals.filter((g) => g.id.startsWith("old-"))).toHaveLength(
    3,
  );
  expect(
    data.sprintGoals.find((g) => g.id === "old-physics")?.inactiveFrom,
  ).toBe("2026-10-17");
  expect(
    activeGoals(data, "2026-10-16").some((g) => g.id === "old-physics"),
  ).toBe(true);
  expect(data.courses.find((c) => c.id === "cards")?.archived).toBe(true);
  expect(data.attempts).toEqual(old.attempts);
  expect(data.studyItems).toEqual(expect.arrayContaining(old.studyItems));
  expect(data.settings.find((s) => s.key === "today-priorities:v1")).toEqual(
    old.settings[0],
  );
  expect(backupSchema.safeParse(await makeBackup()).success).toBe(true);
  const before = await readData();
  await Promise.all([
    ensureRoutinePlan("2026-10-18"),
    ensureRoutinePlan("2026-10-18"),
  ]);
  expect(await readData()).toEqual(before);
  expect(
    data.settings.find((s) => s.key === routinePlanKey + ":before"),
  ).toBeDefined();
});
it("counts only chemistry practice across three courses, excluding lectures and advanced questions", async () => {
  const data = await setup(),
    goal = data.sprintGoals.find((g) => g.id === routineGoalIds.chemistry)!;
  const selected = goalItems(goal, data);
  expect(selected).toHaveLength(6);
  expect(selected.every((i) => isChemistryPractice(i, data))).toBe(true);
  expect(new Set(selected.map((i) => i.courseId)).size).toBe(3);
  data.attempts.push(
    speed({
      id: "practice-a",
      itemId: "chemistry:practice:1",
      createdAt: "2026-10-16T15:00:00Z",
    }),
    speed({
      id: "practice-b",
      itemId: "chemistry-1:practice:1",
      createdAt: "2026-10-16T15:01:00Z",
    }),
    speed({
      id: "lecture",
      itemId: "chemistry:lecture:1",
      createdAt: "2026-10-16T15:02:00Z",
    }),
    speed({
      id: "advanced",
      itemId: "chemistry:advanced:1",
      createdAt: "2026-10-16T15:03:00Z",
    }),
  );
  expect(goalState(goal, data, "2026-10-17")).toMatchObject({
    actual: 2,
    target: 7,
    max: 8,
    remaining: 5,
  });
  expect(goalState(goal, data, "2026-10-19")).toMatchObject({ target: 2 });
});
it("counts two physics questions across books/fields for both weekdays and weekends as one combined quota", async () => {
  const data = await setup(),
    goal = data.sprintGoals.find((g) => g.id === routineGoalIds.physics)!;
  expect(goalItems(goal, data)).toHaveLength(71);
  for (const day of ["2026-10-17", "2026-10-19", "2026-11-03"])
    expect(goalState(goal, data, day).target).toBe(2);
  const one = data.studyItems.find(
    (i) => i.courseId === "meimon-mechanics-heat-waves1" && i.number === 1,
  )!;
  const two = data.studyItems.find(
    (i) =>
      i.courseId === "meimon-waves2-electromagnetism-atom" && i.number === 56,
  )!;
  data.attempts.push(
    ...[one, two].map((item, n) => ({
      id: "recall-" + n,
      itemId: item.id,
      mode: "deep_recall" as const,
      createdAt: "2026-10-16T15:01:00Z",
      checks: Array(8).fill(false),
      notes: "",
      includeInCoachReport: false,
    })),
  );
  expect(goalState(goal, data, "2026-10-17")).toMatchObject({
    actual: 2,
    target: 2,
    achieved: true,
  });
});
it("keeps all three quotas out of Other and preserves math/chemistry target ranges", async () => {
  const data = await setup(),
    rows = todayTasks(data, "2026-10-17");
  for (const id of Object.values(routineGoalIds))
    expect(rows.find((t) => t.id === id)?.category).toBe(0);
  expect(rows.some((t) => t.courses.some((c) => c.id === "cards"))).toBe(false);
  const mathGoal = data.sprintGoals.find((g) => g.id === routineGoalIds.math)!;
  expect(mathGoal.scope?.courseIds).toEqual(["mathematics"]);
  expect(goalState(mathGoal, data, "2026-10-17")).toMatchObject({
    target: 5,
    max: 6,
  });
  expect(goalState(mathGoal, data, "2026-10-19")).toMatchObject({
    target: 2,
    max: 3,
  });
});
it("shares a chemistry continuation cursor between material and goal entry and skips all non-practice items", async () => {
  const data = await setup(),
    goal = data.sprintGoals.find((g) => g.id === routineGoalIds.chemistry)!;
  const cursor = "chemistry-1:practice:1";
  writeViewState("study-cursor:chemistry-1", cursor);
  writeViewState("study-cursor:last", cursor);
  const material = courseStudyEntry(data, "chemistry-1", "2026-10-17");
  expect(material.item?.id).toBe(cursor);
  expect(material.goal?.id).toBe(goal.id);
  expect(nextStudyItem(data, goalStudyItems(data, goal))?.id).toBe(
    material.item?.id,
  );
  data.attempts.push(speed({ id: "completed", itemId: cursor }));
  writeViewState("study-cursor:goal:" + goal.id, cursor);
  writeViewState("study-cursor:last", "i-physics");
  expect(nextStudyItem(data, goalStudyItems(data, goal), goal.id)?.id).toBe(
    "chemistry-1:practice:2",
  );
  writeViewState("study-cursor:last", cursor);
  expect(courseStudyEntry(data, "chemistry-1", "2026-10-17").item?.id).toBe(
    "chemistry-1:practice:2",
  );
  expect(nextStudyItem(data, goalStudyItems(data, goal))?.id).toBe(
    "chemistry-1:practice:2",
  );
  expect(
    courseStudyEntry(data, "chemistry-1", "2026-10-17", true, false).goal,
  ).toBeUndefined();
  writeViewState("study-cursor:chemistry-1", "");
  writeViewState("study-cursor:last", "");
  expect(courseStudyEntry(data, "chemistry-1", "2026-10-17").item?.id).toBe(
    "chemistry-1:practice:2",
  );
});
it("preserves edited ongoing quotas when new courses arrive and dynamically includes new practice items", async () => {
  let data = await setup();
  await db.sprintGoals.update(routineGoalIds.physics, { weekdays: { min: 3 } });
  await db.courses.add({
    ...data.courses.find((c) => c.id === "chemistry")!,
    id: "new-chemistry",
  });
  await db.units.add({
    id: "new-unit",
    courseId: "new-chemistry",
    name: "実践問題",
    order: 0,
    archived: false,
  });
  await db.studyItems.add({
    ...data.studyItems.find((i) => i.id === "chemistry:practice:1")!,
    id: "new-course-item",
    courseId: "new-chemistry",
    unitId: "new-unit",
  });
  await ensureRoutinePlan("2026-10-18");
  data = await readData();
  expect(
    data.sprintGoals.find((g) => g.id === routineGoalIds.physics)?.weekdays
      ?.min,
  ).toBe(3);
  const goal = data.sprintGoals.find((g) => g.id === routineGoalIds.chemistry)!;
  expect(goal.scope?.courseIds).toContain("new-chemistry");
  data.studyItems.push({
    ...data.studyItems.find((i) => i.id === "chemistry:practice:1")!,
    id: "new-practice",
  });
  expect(goalItems(goal, data).some((i) => i.id === "new-practice")).toBe(true);
});
it("prefers the user's dedicated practice book over duplicate practice lessons inside chemistry courses", async () => {
  const original = input();
  original.courses.push({
    ...original.courses.find((c) => c.id === "chemistry")!,
    id: "dedicated",
    name: "実践問題",
  });
  for (const [n, name] of ["理論", "無機", "有機"].entries()) {
    original.units.push({
      id: "dedicated-unit-" + n,
      courseId: "dedicated",
      name,
      order: n,
      archived: false,
    });
    original.studyItems.push({
      ...original.studyItems[1],
      id: "dedicated-question-" + n,
      courseId: "dedicated",
      unitId: "dedicated-unit-" + n,
    });
  }
  await importBackup(
    { schemaVersion: 4, exportedAt: stamp, data: original },
    "replace",
  );
  await ensureRoutinePlan("2026-10-17");
  const data = await readData(),
    goal = data.sprintGoals.find((g) => g.id === routineGoalIds.chemistry)!;
  expect(goal.scope?.courseIds).toEqual(["dedicated"]);
  expect(
    goalItems(goal, data)
      .map((i) => i.id)
      .sort(),
  ).toEqual([
    "dedicated-question-0",
    "dedicated-question-1",
    "dedicated-question-2",
  ]);
});
