import type {
  AppData,
  Attempt,
  StudyItem,
  StudySession,
  SprintGoal,
  ModeAttempt,
} from "../types/model";
import { inPeriod, localDate } from "../utils/time";
import { studyDay, calendarWeek } from "./calendar";
export const chronological = (a: Attempt, b: Attempt) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
  a.id.localeCompare(b.id);
export function mathStatus(
  item: StudyItem,
  attempts: Attempt[],
  asOf?: string,
) {
  const a = attempts
    .filter(
      (x): x is ModeAttempt<"reproduction"> =>
        x.itemId === item.id &&
        x.mode === "reproduction" &&
        (!asOf || localDate(x.createdAt) <= asOf),
    )
    .sort(chronological);
  if (!a.length) return item.initialStatus;
  const last = a.at(-1)!;
  if (last.result === "perfect" && last.reproducibility === 5) {
    const previous = a.at(-2);
    if (
      previous?.result === "perfect" &&
      previous.reproducibility === 5 &&
      new Date(last.createdAt).getTime() -
        new Date(previous.createdAt).getTime() >=
        2 * 86400000
    )
      return "STABLE";
  }
  if (
    last.reproducibility >= 4 &&
    ["perfect", "independent_with_stuck"].includes(last.result)
  )
    return "REPRODUCIBLE";
  if (last.result !== "failed") return "UNDERSTOOD";
  return "ATTEMPTED";
}
export function personalBest(
  history: Attempt[],
  current?: ModeAttempt<"speed">,
) {
  const valid = history.filter(
    (a): a is ModeAttempt<"speed"> =>
      a.mode === "speed" &&
      a.result === "correct" &&
      a.accuracy === 100 &&
      (a.durationSeconds ?? 0) > 0 &&
      a.id !== current?.id &&
      (!current ||
        (a.itemId === current.itemId && chronological(a, current) < 0)),
  );
  const best = valid.length
    ? Math.min(...valid.map((a) => a.durationSeconds!))
    : undefined;
  const eligible =
    !!current &&
    current.result === "correct" &&
    current.accuracy === 100 &&
    (current.durationSeconds ?? 0) > 0;
  return {
    best,
    isNewBest:
      eligible && (best === undefined || current!.durationSeconds! < best),
    improvement:
      eligible && best !== undefined
        ? best - current!.durationSeconds!
        : undefined,
    percent:
      eligible && best !== undefined
        ? ((best - current!.durationSeconds!) / best) * 100
        : undefined,
  };
}
export function recallScore(checks: boolean[]) {
  const ratio = (xs: boolean[]) =>
    (xs.filter(Boolean).length / xs.length) * 100;
  return {
    setupRecall: ratio(checks.slice(0, 4)),
    reasoningRecall: ratio(checks.slice(4, 8)),
    solutionRecall: checks[7] ? 100 : 0,
    overallRecall: ratio(checks),
  };
}
export function itemComplete(item: StudyItem, attempts: Attempt[]) {
  const a = attempts
    .filter((a) => a.itemId === item.id)
    .sort(chronological)
    .at(-1);
  if (!a)
    return item.studyMode === "reproduction"
      ? item.initialStatus === "REPRODUCIBLE"
      : ["UNDERSTOOD", "REPRODUCIBLE"].includes(item.initialStatus);
  switch (a.mode) {
    case "reproduction":
      return ["REPRODUCIBLE", "STABLE"].includes(mathStatus(item, attempts));
    case "speed":
      return a.result === "correct" && a.accuracy === 100;
    case "deep_recall":
      return recallScore(a.checks).overallRecall === 100;
    case "video":
      return a.watched && a.completion === 100;
    case "past_exam":
      return a.reviewCompleted;
    case "memorization":
    case "practice":
      return a.completion === 100;
    case "reading":
      return a.progress === 100;
  }
}
export function courseProgress(items: StudyItem[], attempts: Attempt[]) {
  const active = items.filter((i) => !i.archived);
  const attempted = active.filter(
    (i) =>
      i.initialStatus !== "UNSEEN" || attempts.some((a) => a.itemId === i.id),
  ).length;
  return {
    total: active.length,
    attempted,
    completed: active.filter((i) => itemComplete(i, attempts)).length,
    remaining: active.length - attempted,
    reproducible: active.filter((i) =>
      ["REPRODUCIBLE", "STABLE"].includes(mathStatus(i, attempts)),
    ).length,
    stable: active.filter((i) => mathStatus(i, attempts) === "STABLE").length,
  };
}
export function dailyTarget(
  rule: Pick<SprintGoal, "weekdays" | "weekends">,
  date: string,
) {
  return studyDay(date).restDay ? rule.weekends : rule.weekdays;
}
// Sessions crossing midnight are attributed entirely to their Japan-time start date.
export function studyTimes(
  sessions: StudySession[],
  start: string,
  end: string,
) {
  const byDay: Record<string, number> = {},
    byCourse: Record<string, number> = {};
  for (const s of sessions) {
    if (s.deletedAt || !s.endedAt || !inPeriod(s.startedAt, start, end))
      continue;
    const d = localDate(s.startedAt);
    byDay[d] = (byDay[d] ?? 0) + s.durationSeconds;
    byCourse[s.courseId] = (byCourse[s.courseId] ?? 0) + s.durationSeconds;
  }
  return {
    byDay,
    byCourse,
    total: Object.values(byDay).reduce((a, b) => a + b, 0),
  };
}
export function attemptsInPeriod(data: AppData, start: string, end: string) {
  return data.attempts.filter((a) => {
    const s = data.studySessions.find((s) => s.id === a.sessionId);
    return (
      !a.deletedAt &&
      !s?.deletedAt &&
      inPeriod(s?.startedAt ?? a.createdAt, start, end)
    );
  });
}
export function attemptsAsOf(data: AppData, end: string) {
  return data.attempts.filter((a) => {
    const session = data.studySessions.find((s) => s.id === a.sessionId);
    return (
      !a.deletedAt &&
      !session?.deletedAt &&
      localDate(session?.startedAt ?? a.createdAt) <= end
    );
  });
}
export function sprintProgress(
  goal: SprintGoal,
  data: AppData,
  start: string,
  end: string,
  date = localDate(),
) {
  const courseItems = goalItems(goal, data);
  const ids = new Set(courseItems.map((i) => i.id));
  const week = calendarWeek(date);
  const from =
    goal.kind === "weekly_count" && goal.weeklyPeriod === "calendar"
      ? week.start > start
        ? week.start
        : start
      : start;
  const until =
    goal.kind === "weekly_count" && goal.weeklyPeriod === "calendar"
      ? week.end < end
        ? week.end
        : end
      : end;
  const period = attemptsInPeriod(
    data,
    goal.kind === "daily_count" ? date : from,
    goal.kind === "daily_count" ? date : until,
  ).filter(
    (a) =>
      ids.has(a.itemId) &&
      (goal.kind !== "daily_count" || (date >= start && date <= end)),
  );
  let actual = 0;
  let target = goal.target ?? 0;
  if (goal.kind === "specific_task") {
    actual =
      goal.completed ||
      (!!goal.itemId && period.some((a) => a.itemId === goal.itemId))
        ? 1
        : 0;
    target = 1;
  } else if (goal.kind === "course_progress") {
    actual = courseProgress(courseItems, attemptsAsOf(data, end)).completed;
  } else {
    actual = new Set(period.map((a) => a.itemId)).size;
    if (goal.kind === "daily_count")
      target = dailyTarget(goal, date)?.min ?? goal.target ?? 0;
    if (goal.kind === "weekly_count")
      target = goal.weeklyRange?.min ?? goal.target ?? 0;
  }
  return {
    actual,
    target,
    ratio: target > 0 ? Math.min(1, actual / target) : 0,
  };
}
// Explicit scopes are a union: whole courses OR selected units OR selected items.
// An absent scope retains the old courseId behavior; an empty scope selects nothing.
export function goalItems(goal: SprintGoal, data: AppData) {
  return data.studyItems.filter((i) =>
    goal.scope
      ? goal.scope.courseIds.includes(i.courseId) ||
        !!goal.scope.unitIds?.includes(i.unitId) ||
        !!goal.scope.itemIds?.includes(i.id)
      : i.courseId === goal.courseId,
  );
}
export function videoPace(
  total: number,
  completed: number,
  start?: string,
  target?: string,
  today = localDate(),
) {
  if (!total || !start || !target)
    return "講義登録・開始日・目標日を設定すると進度を表示";
  if (completed >= total) return "完了";
  const full =
    new Date(target + "T12:00:00").getTime() -
    new Date(start + "T12:00:00").getTime();
  const past =
    new Date(today + "T12:00:00").getTime() -
    new Date(start + "T12:00:00").getTime();
  const expected =
    full > 0 ? Math.min(1, Math.max(0, past / full)) * total : total;
  return completed > expected + 1
    ? "前倒し"
    : completed < expected - 1
      ? "遅れ"
      : "予定通り";
}
