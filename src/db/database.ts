import Dexie, { type Table } from "dexie";
import type { AppData } from "../types/model";
import { subjects } from "../types/model";
export const v1Stores = {
  courses: "id,subject",
  units: "id,courseId",
  studyItems: "id,courseId,unitId",
  studySessions: "id,courseId,itemId,startedAt",
  attempts: "id,itemId,sessionId,createdAt,mode",
  bottlenecks: "id,attemptId",
  sprints: "id,startDate,endDate",
  sprintGoals: "id,sprintId,courseId",
  coachSessions: "id,date",
  coachDirectives: "id,coachSessionId",
  coachQuestions: "id,createdAt",
  settings: "key",
};
export class StudyDatabase extends Dexie {
  courses!: Table<AppData["courses"][number], string>;
  units!: Table<AppData["units"][number], string>;
  studyItems!: Table<AppData["studyItems"][number], string>;
  studySessions!: Table<AppData["studySessions"][number], string>;
  attempts!: Table<AppData["attempts"][number], string>;
  bottlenecks!: Table<AppData["bottlenecks"][number], string>;
  sprints!: Table<AppData["sprints"][number], string>;
  sprintGoals!: Table<AppData["sprintGoals"][number], string>;
  coachSessions!: Table<AppData["coachSessions"][number], string>;
  coachDirectives!: Table<AppData["coachDirectives"][number], string>;
  coachQuestions!: Table<AppData["coachQuestions"][number], string>;
  settings!: Table<AppData["settings"][number], string>;
  progressReportDrafts!: Table<AppData["progressReportDrafts"][number], string>;
  constructor(name = "StudyTrace") {
    super(name);
    this.version(1).stores(v1Stores);
    this.version(2).stores({
      ...v1Stores,
      progressReportDrafts: "id,[startDate+endDate],updatedAt",
    });
  }
}
export const db = new StudyDatabase();
export async function readData(): Promise<AppData> {
  return db.transaction("r", db.tables, async () => {
    const data = Object.fromEntries(
      await Promise.all(
        db.tables.map(async (t) => [t.name, await t.toArray()]),
      ),
    ) as AppData;
    data.courses.sort(
      (a, b) =>
        subjects.indexOf(a.subject) - subjects.indexOf(b.subject) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.name.localeCompare(b.name),
    );
    data.units.sort((a, b) => a.order - b.order);
    const units = new Map(data.units.map((u) => [u.id, u.order]));
    data.studyItems.sort(
      (a, b) =>
        (units.get(a.unitId) ?? 0) - (units.get(b.unitId) ?? 0) ||
        a.order - b.order,
    );
    data.sprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return data;
  });
}
