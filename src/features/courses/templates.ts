import { catalog, catalogData } from "./catalog";
import { emptyData } from "../../types/model";
import type { AppData } from "../../types/model";
export const templates = catalog.map((c) => ({
  name: c.title,
  subject: c.subject,
  mode: c.mode,
  count: c.lessons.length,
  source: c.source,
}));
export function createTemplates(
  selected: number[],
  _initialMath = 0,
  _informationTeacher = "both",
): AppData {
  const data = emptyData();
  for (const index of selected) {
    const c = catalog[index];
    if (!c) continue;
    const part = catalogData(c.id);
    data.courses.push(...part.courses);
    data.units.push(...part.units);
    data.studyItems.push(...part.studyItems);
  }
  return data;
}
