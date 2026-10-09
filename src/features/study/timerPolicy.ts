import type { AppData, Course, StudyItem, Unit } from "../../types/model";

// Restore "all" here when unrestricted timing is wanted again. Timer engine stays intact.
export const timerPolicy: "all" | "chemistry-practice-only" =
  "chemistry-practice-only";
export function canTimeItem(
  item: StudyItem,
  course?: Course,
  unit?: Unit,
  policy: string = timerPolicy,
) {
  if (policy === "all") return true;
  return (
    course?.subject === "chemistry" &&
    /(?:実践|発展)問題/.test(
      [item.title, unit?.name, unit?.chapter, item.sourcePath].join(" "),
    )
  );
}
export function timerAllowed(data: AppData, item: StudyItem) {
  return canTimeItem(
    item,
    data.courses.find((c) => c.id === item.courseId),
    data.units.find((u) => u.id === item.unitId),
  );
}
