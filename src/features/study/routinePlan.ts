import type { AppData, SprintGoal } from "../../types/model";
import { db, readData } from "../../db/database";
import { meimonBooks } from "../courses/meimon";
import { goalCourses } from "../../domain/planning";
import { localDate } from "../../utils/time";
import {
  isChemistryPractice,
  isChemistryPracticeCourse,
} from "../../domain/studySelection";

export const routinePlanKey = "routine-plan:2026-10-17:v1";
export const routineSprintId = "routine-plan";
export const routineGoalIds = {
  math: "routine-goal:math",
  chemistry: "routine-goal:chemistry",
  physics: "routine-goal:physics",
};
export function routineCourses(data: AppData) {
  const dedicated = data.courses.filter(
    (c) => !c.archived && isChemistryPracticeCourse(c),
  );
  return {
    math: data.courses.filter(
      (c) =>
        !c.archived &&
        (c.catalogId === "special_math" || c.name.includes("特別応用講座")) &&
        c.subject === "mathematics",
    ),
    chemistry: dedicated.length
      ? dedicated
      : data.courses.filter(
          (c) =>
            !c.archived &&
            c.subject === "chemistry" &&
            data.studyItems.some(
              (i) => i.courseId === c.id && isChemistryPractice(i, data),
            ),
        ),
    physics: data.courses.filter(
      (c) =>
        !c.archived &&
        meimonBooks.some(
          (b) => c.id === b.id || c.catalogId === b.id || c.name === b.name,
        ),
    ),
    cards: data.courses.filter(
      (c) =>
        c.catalogId === "math_cards" || /数学解法カード.*無料公開/.test(c.name),
    ),
  };
}
export function routineSignature(data: AppData) {
  return JSON.stringify(
    Object.entries(routineCourses(data)).map(([key, courses]) => [
      key,
      courses.map((c) => c.id).sort(),
    ]),
  );
}
export async function ensureRoutinePlan(date = localDate()) {
  await db.transaction("rw", db.tables, async () => {
    const data = await readData(),
      groups = routineCourses(data),
      signature = routineSignature(data);
    const previous = data.settings.find((s) => s.key === routinePlanKey);
    if (previous?.value === signature) return;
    const active = new Set(
      data.sprints
        .filter((s) => s.startDate <= date && s.endDate >= date)
        .map((s) => s.id),
    );
    const legacy = data.sprintGoals.filter(
      (g) =>
        active.has(g.sprintId) &&
        !g.id.startsWith("routine-goal:") &&
        !g.inactiveFrom &&
        ["daily_count", "weekly_count"].includes(g.kind),
    );
    const affected = legacy.filter(
      (g) =>
        new Set(goalCourses(g, data).map((c) => c.subject)).size === 1 &&
        goalCourses(g, data).some(
          (c) =>
            ["chemistry", "physics"].includes(c.subject) ||
            groups.math.some((m) => m.id === c.id) ||
            groups.cards.some((m) => m.id === c.id),
        ),
    );
    if (!previous)
      await db.settings.put({
        key: routinePlanKey + ":before",
        value: {
          goals: affected,
          cards: groups.cards.map((c) => ({ id: c.id, archived: c.archived })),
        },
      });
    for (const course of groups.cards)
      if (
        !previous ||
        !String(previous.value).includes(JSON.stringify(course.id))
      )
        await db.courses.update(course.id, { archived: true });
    for (const goal of affected)
      await db.sprintGoals.update(goal.id, { inactiveFrom: date });
    if (!data.sprints.some((s) => s.id === routineSprintId))
      await db.sprints.add({
        id: routineSprintId,
        title: "継続ノルマ",
        startDate: date,
        endDate: "2100-12-31",
        ongoing: true,
      });
    for (const subject of ["math", "chemistry", "physics"] as const) {
      const courses = groups[subject];
      if (!courses.length) continue;
      const id = routineGoalIds[subject],
        stored = data.sprintGoals.find((g) => g.id === id);
      const old =
        affected.find((g) =>
          goalCourses(g, data).some((c) => courses.some((x) => x.id === c.id)),
        ) ??
        affected.find((g) =>
          goalCourses(g, data).some(
            (c) => c.subject === (subject === "math" ? "mathematics" : subject),
          ),
        );
      const goal: SprintGoal = stored
        ? {
            ...stored,
            courseId: courses[0].id,
            scope: { courseIds: courses.map((c) => c.id) },
          }
        : {
            id,
            sprintId: routineSprintId,
            courseId: courses[0].id,
            kind: "daily_count",
            completed: false,
            title:
              subject === "math"
                ? "特別応用講座"
                : subject === "chemistry"
                  ? "化学・実践問題（3分野合算）"
                  : "名問の森（全分野合算）",
            scope: { courseIds: courses.map((c) => c.id) },
            selection:
              subject === "chemistry"
                ? "chemistry-practice"
                : subject === "physics"
                  ? "important"
                  : undefined,
            weekdays:
              subject === "physics"
                ? { min: 2 }
                : (old?.weekdays ??
                  (old?.target !== undefined
                    ? { min: old.target }
                    : subject === "math"
                      ? { min: 2, max: 3 }
                      : { min: 2 })),
            weekends:
              subject === "physics"
                ? { min: 2 }
                : (old?.weekends ??
                  (subject === "math"
                    ? { min: 5, max: 6 }
                    : { min: 7, max: 8 })),
          };
      await db.sprintGoals.put(goal);
    }
    await db.settings.put({ key: routinePlanKey, value: signature });
  });
}
