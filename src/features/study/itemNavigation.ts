import type { AppData, StudyItem, SprintGoal } from "../../types/model";
import { goalItems, itemComplete, chronological } from "../../domain/study";
import { priorities, activeGoals } from "../../domain/planning";
import { readViewState } from "../navigation/viewState";
import { isChemistryPractice } from "../../domain/studySelection";

export function courseStudyItems(data: AppData, courseId: string): StudyItem[] {
  if (!data.courses.some((c) => c.id === courseId && !c.archived)) return [];
  const units = new Map(
    data.units
      .filter((u) => u.courseId === courseId && !u.archived)
      .map((u) => [u.id, u]),
  );
  return data.studyItems
    .filter(
      (i) => i.courseId === courseId && !i.archived && units.has(i.unitId),
    )
    .sort(
      (a, b) =>
        units.get(a.unitId)!.order - units.get(b.unitId)!.order ||
        a.unitId.localeCompare(b.unitId) ||
        a.order - b.order ||
        a.id.localeCompare(b.id),
    );
}
export function goalStudyItems(data: AppData, goal: SprintGoal) {
  const ids = new Set(
    goal.kind === "specific_task"
      ? [goal.itemId]
      : goalItems(goal, data).map((i) => i.id),
  );
  const order = priorities(data).courses;
  return [...data.courses]
    .sort((a, b) => {
      const rank = (id: string) =>
        order.includes(id) ? order.indexOf(id) : order.length;
      return (
        rank(a.id) - rank(b.id) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id)
      );
    })
    .flatMap((c) => courseStudyItems(data, c.id))
    .filter((i) => ids.has(i.id));
}
export function itemGoals(data: AppData, item: StudyItem, date: string) {
  return activeGoals(data, date).filter((g) =>
    goalStudyItems(data, g).some((i) => i.id === item.id),
  );
}
export function nextStudyItem(
  data: AppData,
  items: StudyItem[],
  goalId?: string,
) {
  if (!items.length) return;
  const multi = new Set(items.map((i) => i.courseId)).size > 1;
  const fallback = readViewState(
    multi ? "study-cursor:last" : "study-cursor:" + items[0].courseId,
    "",
  );
  const cursor =
    multi && goalId
      ? readViewState("study-cursor:goal:" + goalId, fallback)
      : fallback;
  let index = items.findIndex((i) => i.id === cursor);
  if (index < 0) {
    const ids = new Set(items.map((i) => i.id));
    const latest = data.attempts
      .filter((a) => !a.deletedAt && ids.has(a.itemId))
      .sort(chronological)
      .at(-1);
    if (latest) index = items.findIndex((i) => i.id === latest.itemId);
  }
  const unseen = (i: StudyItem) =>
    i.initialStatus === "UNSEEN" &&
    !data.attempts.some((a) => !a.deletedAt && a.itemId === i.id);
  if (index >= 0 && unseen(items[index])) return items[index];
  const sequence =
    index >= 0
      ? [...items.slice(index + 1), ...items.slice(0, index + 1)]
      : items;
  return (
    sequence.find(unseen) ??
    sequence.find((i) => !itemComplete(i, data.attempts)) ??
    sequence[0]
  );
}
export function courseStudyEntry(
  data: AppData,
  courseId: string,
  date: string,
  importantOnly = true,
  practiceOnly = true,
) {
  const courseItems = courseStudyItems(data, courseId);
  const hasPractice = courseItems.some((i) => isChemistryPractice(i, data));
  const hasImportant = courseItems.some((i) => i.important !== undefined);
  const goal = activeGoals(data, date).find(
    (g) =>
      g.id.startsWith("routine-goal:") &&
      goalStudyItems(data, g).some((i) => i.courseId === courseId),
  );
  const useGoal =
    goal &&
    (goal.selection !== "important" || importantOnly) &&
    (goal.selection !== "chemistry-practice" || practiceOnly);
  const items = (useGoal ? goalStudyItems(data, goal) : courseItems).filter(
    (i) =>
      i.courseId === courseId &&
      (!practiceOnly || !hasPractice || isChemistryPractice(i, data)) &&
      (!importantOnly || !hasImportant || i.important === true),
  );
  return { item: nextStudyItem(data, items), goal: useGoal ? goal : undefined };
}
export function studyPath(
  item: StudyItem,
  goalId?: string,
  importantOnly = false,
) {
  const params = new URLSearchParams();
  if (goalId) params.set("goal", goalId);
  if (importantOnly) params.set("important", "1");
  return (
    "/study/" +
    encodeURIComponent(item.id) +
    (params.size ? "?" + params.toString() : "")
  );
}
export function itemNeighbors(
  data: AppData,
  item: StudyItem,
  goal?: SprintGoal,
  importantOnly = false,
) {
  const sequence = goal
    ? goalStudyItems(data, goal)
    : courseStudyItems(data, item.courseId);
  const items = sequence.filter((i) => !importantOnly || i.important === true);
  const index = items.findIndex((i) => i.id === item.id);
  return {
    index,
    total: items.length,
    previous: index > 0 ? items[index - 1] : undefined,
    next: index >= 0 ? items[index + 1] : undefined,
  };
}
