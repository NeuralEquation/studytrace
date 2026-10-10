import { z } from "zod";
import type { AppData, Course, SprintGoal } from "../types/model";
import { goalItems, dailyTarget, sprintProgress } from "./study";

export const prioritiesKey = "today-priorities:v1";
export const prioritiesSchema = z.object({
  subjects: z.array(z.string()),
  courses: z.array(z.string()),
});
export function priorities(data: AppData) {
  const parsed = prioritiesSchema.safeParse(
    data.settings.find((s) => s.key === prioritiesKey)?.value,
  );
  return parsed.success ? parsed.data : { subjects: [], courses: [] };
}
export const planPresets = [
  {
    id: "math",
    title: "数学",
    kind: "daily_count",
    weekdays: { min: 2, max: 3 },
    weekends: { min: 5, max: 6 },
    target: 2,
  },
  {
    id: "chemistry",
    title: "化学（実戦問題・3分野合算）",
    kind: "daily_count",
    weekdays: { min: 2 },
    weekends: { min: 7, max: 8 },
    target: 2,
  },
  ...["力学", "電磁気", "熱", "波動"].map((field, n) => ({
    id: "physics-" + n,
    title: "物理・" + field,
    kind: "weekly_count" as const,
    target: 1,
    weeklyRange: { min: 1, max: 2 },
    weeklyPeriod: "calendar" as const,
  })),
] as const;
export function presetChanges(id: string): Partial<SprintGoal> {
  const p = planPresets.find((p) => p.id === id)!;
  const { id: unused, ...fields } = p;
  void unused;
  return {
    weekdays: undefined,
    weekends: undefined,
    weeklyRange: undefined,
    weeklyPeriod: undefined,
    ...fields,
  };
}
export function goalCourses(g: SprintGoal, data: AppData) {
  const ids = new Set(
    g.scope
      ? [
          ...g.scope.courseIds,
          ...goalItems(g, data).map((i) => i.courseId),
          ...data.units
            .filter((u) => g.scope?.unitIds?.includes(u.id))
            .map((u) => u.courseId),
        ]
      : [g.courseId],
  );
  return data.courses.filter((c) => ids.has(c.id));
}
export function goalState(g: SprintGoal, data: AppData, date: string) {
  const sprint = data.sprints.find((s) => s.id === g.sprintId);
  const start = sprint?.startDate ?? date,
    end = sprint?.endDate ?? date;
  const p = sprintProgress(g, data, start, end, date);
  const range =
    g.kind === "daily_count"
      ? dailyTarget(g, date)
      : g.kind === "weekly_count"
        ? g.weeklyRange
        : undefined;
  const configured =
    g.kind === "specific_task" || range !== undefined || g.target !== undefined;
  const target = range?.min ?? g.target;
  const achieved =
    configured && p.actual >= (g.kind === "specific_task" ? 1 : (target ?? 0));
  return {
    ...p,
    configured,
    achieved,
    max: range?.max,
    remaining: configured ? Math.max(0, p.target - p.actual) : undefined,
  };
}
export type TodayTask = {
  id: string;
  goal?: SprintGoal;
  courses: Course[];
  category: number;
  deadline: string;
  unmet: number;
};
export function todayTasks(data: AppData, date: string): TodayTask[] {
  const active = new Set(
    data.sprints
      .filter((s) => s.startDate <= date && s.endDate >= date)
      .map((s) => s.id),
  );
  const goals = data.sprintGoals.filter((g) => active.has(g.sprintId));
  const tasks: TodayTask[] = goals.map((g) => {
    const state = goalState(g, data, date);
    return {
      id: g.id,
      goal: g,
      courses: goalCourses(g, data),
      category: !state.configured
        ? 3
        : state.achieved
          ? 2
          : g.kind === "daily_count"
            ? 0
            : 1,
      deadline: data.sprints.find((s) => s.id === g.sprintId)!.endDate,
      unmet: 0,
    };
  });
  const covered = new Set(tasks.flatMap((t) => t.courses.map((c) => c.id)));
  for (const c of data.courses.filter((c) => !c.archived && !covered.has(c.id)))
    tasks.push({
      id: "course:" + c.id,
      courses: [c],
      category: 3,
      deadline: c.targetDate ?? "9999",
      unmet: 0,
    });
  for (const t of tasks)
    t.unmet = goals.filter(
      (g) =>
        !goalState(g, data, date).achieved &&
        goalCourses(g, data).some((c) => t.courses.some((x) => x.id === c.id)),
    ).length;
  const preferences = priorities(data);
  const rank = (list: string[], id: string) =>
    list.includes(id) ? list.indexOf(id) : list.length;
  const best = (values: number[], fallback: number) =>
    values.length ? Math.min(...values) : fallback;
  const coachRank = (t: TodayTask) =>
    best(
      data.coachDirectives
        .filter(
          (d) =>
            d.activeFrom <= date &&
            (!d.activeUntil || d.activeUntil >= date) &&
            t.courses.some((c) =>
              d.courseId ? c.id === d.courseId : c.subject === d.subject,
            ),
        )
        .map((d) => ({ high: 0, normal: 1, low: 2 })[d.priority]),
      3,
    );
  return tasks.sort(
    (a, b) =>
      a.category - b.category ||
      coachRank(a) - coachRank(b) ||
      best(
        a.courses.map((c) => rank(preferences.subjects, c.subject)),
        preferences.subjects.length,
      ) -
        best(
          b.courses.map((c) => rank(preferences.subjects, c.subject)),
          preferences.subjects.length,
        ) ||
      best(
        a.courses.map((c) => rank(preferences.courses, c.id)),
        preferences.courses.length,
      ) -
        best(
          b.courses.map((c) => rank(preferences.courses, c.id)),
          preferences.courses.length,
        ) ||
      b.unmet - a.unmet ||
      a.deadline.localeCompare(b.deadline) ||
      a.id.localeCompare(b.id),
  );
}
