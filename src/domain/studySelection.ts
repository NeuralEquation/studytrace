import type { AppData, StudyItem, Course } from "../types/model";
export function isChemistryPracticeCourse(course: Course) {
  return (
    course.subject === "chemistry" &&
    /^(?:化学[・\s]*)?実[践戦]問題(?:[【(].*)?$/.test(
      course.name.normalize("NFKC"),
    )
  );
}

export function isChemistryPractice(item: StudyItem, data: AppData) {
  const course = data.courses.find((c) => c.id === item.courseId);
  if (!course || course.subject !== "chemistry") return false;
  if (isChemistryPracticeCourse(course)) return true;
  const unit = data.units.find((u) => u.id === item.unitId);
  return /実[践戦]問題/.test(
    [item.title, item.sourcePath, unit?.chapter, unit?.name]
      .join(" ")
      .normalize("NFKC"),
  );
}
