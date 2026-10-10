import type { AppData, StudyItem, SprintGoal } from "../../types/model";
import { goalItems } from "../../domain/study";
import { priorities } from "../../domain/planning";

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
  const active = new Set(
    data.sprints
      .filter((s) => s.startDate <= date && s.endDate >= date)
      .map((s) => s.id),
  );
  return data.sprintGoals.filter(
    (g) =>
      active.has(g.sprintId) &&
      goalStudyItems(data, g).some((i) => i.id === item.id),
  );
}
export function studyPath(item: StudyItem, goalId?: string) {
  return (
    "/study/" +
    encodeURIComponent(item.id) +
    (goalId ? "?goal=" + encodeURIComponent(goalId) : "")
  );
}
export function itemNeighbors(
  data: AppData,
  item: StudyItem,
  goal?: SprintGoal,
) {
  const items = goal
    ? goalStudyItems(data, goal)
    : courseStudyItems(data, item.courseId);
  const index = items.findIndex((i) => i.id === item.id);
  return {
    index,
    total: items.length,
    previous: index > 0 ? items[index - 1] : undefined,
    next: index >= 0 ? items[index + 1] : undefined,
  };
}
