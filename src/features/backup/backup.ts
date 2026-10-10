import { z } from "zod";
import {
  courseSchema,
  unitSchema,
  itemSchema,
  sessionSchema,
  attemptSchema,
  bottleneckSchema,
  sprintSchema,
  goalSchema,
  coachSchema,
  directiveSchema,
  questionSchema,
  settingSchema,
  draftSchema,
  safeUrl,
  modes,
  subjects,
} from "../../types/model";
import type { AppData } from "../../types/model";
import { db, readData } from "../../db/database";
import { now, uid } from "../../utils/time";
const dataSchema = z.object({
  courses: z.array(courseSchema),
  units: z.array(unitSchema),
  studyItems: z.array(itemSchema),
  studySessions: z.array(sessionSchema),
  attempts: z.array(attemptSchema),
  bottlenecks: z.array(bottleneckSchema),
  sprints: z.array(sprintSchema),
  sprintGoals: z.array(goalSchema),
  coachSessions: z.array(coachSchema),
  coachDirectives: z.array(directiveSchema),
  coachQuestions: z.array(questionSchema),
  settings: z.array(settingSchema),
  progressReportDrafts: z.array(draftSchema).default([]),
});
export const backupSchema = z
  .object({
    schemaVersion: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
    exportedAt: z.string().datetime({ offset: true }),
    data: dataSchema,
  })
  .superRefine(({ data }, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const [table, rows] of Object.entries(data)) {
      const seen = new Set<string>();
      for (const row of rows) {
        const key = "id" in row ? row.id : row.key;
        if (seen.has(key)) fail(`${table}: IDが重複しています (${key})`);
        seen.add(key);
      }
    }
    const courses = new Map(data.courses.map((c) => [c.id, c]));
    const units = new Map(data.units.map((u) => [u.id, u]));
    const items = new Map(data.studyItems.map((i) => [i.id, i]));
    const sessions = new Map(data.studySessions.map((s) => [s.id, s]));
    for (const u of data.units)
      if (!courses.has(u.courseId)) fail("UnitのCourseがありません");
    for (const i of data.studyItems) {
      if (
        !courses.has(i.courseId) ||
        units.get(i.unitId)?.courseId !== i.courseId
      )
        fail("StudyItemの親教材が不正です");
      if (
        i.relatedItemId &&
        (!items.has(i.relatedItemId) ||
          items.get(i.relatedItemId)?.courseId !== i.courseId ||
          i.relatedItemId === i.id)
      )
        fail("関連項目が不正です");
    }
    for (const s of data.studySessions) {
      if (
        !courses.has(s.courseId) ||
        (s.itemId && items.get(s.itemId)?.courseId !== s.courseId)
      )
        fail("Sessionの参照先が不正です");
      if (
        s.endedAt &&
        new Date(s.endedAt).getTime() < new Date(s.startedAt).getTime()
      )
        fail("Sessionの終了時刻が開始前です");
      if (s.itemId && items.get(s.itemId)?.studyMode !== s.mode)
        fail("Sessionの学習モードが項目と一致しません");
    }
    for (const a of data.attempts) {
      if (
        !items.has(a.itemId) ||
        (a.sessionId && sessions.get(a.sessionId)?.itemId !== a.itemId)
      )
        fail("Attemptの参照先が不正です");
      if (
        items.get(a.itemId)?.studyMode !== a.mode ||
        (a.sessionId && sessions.get(a.sessionId)?.mode !== a.mode)
      )
        fail("Attemptの学習モードが不正です");
      if (
        a.mode === "past_exam" &&
        (a.score > a.maxScore || a.sections.some((s) => s.score > s.maxScore))
      )
        fail("得点が満点を超えています");
    }
    for (const b of data.bottlenecks)
      if (
        !data.attempts.some((a) => a.id === b.attemptId) &&
        !sessions.has(b.attemptId)
      )
        fail("Bottleneckの演習がありません");
    for (const g of data.sprintGoals) {
      if (
        !data.sprints.some((s) => s.id === g.sprintId) ||
        !courses.has(g.courseId) ||
        g.scope?.courseIds.some((id) => !courses.has(id)) ||
        g.scope?.unitIds?.some((id) => !units.has(id)) ||
        g.scope?.itemIds?.some((id) => !items.has(id)) ||
        (g.itemId &&
          (!items.has(g.itemId) ||
            (g.scope
              ? !(
                  g.scope.courseIds.includes(items.get(g.itemId)!.courseId) ||
                  g.scope.unitIds?.includes(items.get(g.itemId)!.unitId) ||
                  g.scope.itemIds?.includes(g.itemId)
                )
              : items.get(g.itemId)?.courseId !== g.courseId)))
      )
        fail("Sprint目標の参照先が不正です");
    }
    for (const d of data.coachDirectives)
      if (
        !data.coachSessions.some((c) => c.id === d.coachSessionId) ||
        (d.courseId && !courses.has(d.courseId))
      )
        fail("指導方針の参照先が不正です");
    for (const s of data.sprints)
      if (
        s.coachSessionId &&
        !data.coachSessions.some((c) => c.id === s.coachSessionId)
      )
        fail("Sprintの指導記録がありません");
    for (const q of data.coachQuestions)
      if (q.relatedItemId && !items.has(q.relatedItemId))
        fail("質問の関連項目がありません");
    for (const s of data.settings)
      if (s.key.startsWith("runner:")) {
        const parsed = attemptSchema.safeParse(s.value);
        const session = sessions.get(s.key.slice(7));
        if (
          !parsed.success ||
          !session ||
          parsed.data.id !== session.id ||
          parsed.data.sessionId !== session.id ||
          parsed.data.itemId !== session.itemId ||
          parsed.data.mode !== session.mode
        )
          fail("演習の下書きが不正です");
      }
  });
export const courseImportSchema = z.object({
  name: z.string().min(1),
  subject: z.enum(subjects),
  defaultMode: z.enum(modes).optional(),
  externalUrl: safeUrl.optional(),
  units: z.array(
    z.object({
      name: z.string().min(1),
      items: z.array(
        z.object({
          title: z.string().min(1),
          number: z.number().int().positive().optional(),
          type: itemSchema.shape.type,
          studyMode: z.enum(modes),
          externalUrl: safeUrl.optional(),
        }),
      ),
    }),
  ),
});
export async function importCourse(value: unknown) {
  const c = courseImportSchema.parse(value);
  const courseId = uid();
  await db.transaction("rw", db.courses, db.units, db.studyItems, async () => {
    await db.courses.add({
      id: courseId,
      name: c.name,
      subject: c.subject,
      defaultMode:
        c.defaultMode ??
        c.units.flatMap((u) => u.items)[0]?.studyMode ??
        "practice",
      externalUrl: c.externalUrl,
      createdAt: now(),
      archived: false,
    });
    for (const [order, u] of c.units.entries()) {
      const unitId = uid();
      await db.units.add({
        id: unitId,
        courseId,
        name: u.name,
        order,
        archived: false,
      });
      await db.studyItems.bulkAdd(
        u.items.map((i, order) => ({
          ...i,
          id: uid(),
          courseId,
          unitId,
          order,
          initialStatus: "UNSEEN" as const,
          archived: false,
        })),
      );
    }
  });
}
export async function makeBackup() {
  return {
    schemaVersion: 4 as const,
    exportedAt: now(),
    data: await readData(),
  };
}
export async function importBackup(value: unknown, mode: "replace" | "merge") {
  const parsed = backupSchema.parse(value);
  await db.transaction("rw", db.tables, async () => {
    const incoming: Record<string, unknown[]> = {};
    if (mode === "merge") {
      const current = await readData();
      for (const table of db.tables) {
        const key = table.name as keyof AppData;
        const existing = new Map<string, unknown>(
          current[key].map((row) => ["id" in row ? row.id : row.key, row]),
        );
        incoming[key] = [];
        for (const row of parsed.data[key]) {
          const rowKey = "id" in row ? row.id : row.key;
          const old = existing.get(rowKey);
          if (old !== undefined) {
            if (canonicalJSON(old) !== canonicalJSON(row))
              throw new Error(
                `Merge中止: ${key}の同じIDに異なる内容があります。既存データは変更していません。`,
              );
          } else incoming[key].push(row);
        }
      }
    }
    for (const table of db.tables) {
      if (mode === "replace") await table.clear();
      await table.bulkAdd(
        mode === "replace"
          ? parsed.data[table.name as keyof AppData]
          : incoming[table.name],
      );
    }
  });
}
function canonicalJSON(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([, value]) => value !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function csv(data: AppData) {
  const rows = [
    [
      "table",
      "id",
      "course",
      "item",
      "date",
      "mode",
      "durationSeconds",
      "details",
    ],
  ];
  for (const s of data.studySessions)
    rows.push([
      "session",
      s.id,
      data.courses.find((c) => c.id === s.courseId)?.name ?? s.courseId,
      data.studyItems.find((i) => i.id === s.itemId)?.title ?? "",
      s.startedAt,
      s.mode,
      String(s.durationSeconds),
      JSON.stringify(s),
    ]);
  for (const a of data.attempts)
    rows.push([
      "attempt",
      a.id,
      "",
      data.studyItems.find((i) => i.id === a.itemId)?.title ?? a.itemId,
      a.createdAt,
      a.mode,
      String(a.durationSeconds ?? ""),
      JSON.stringify(a),
    ]);
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              (/^[=+@\-\t\r]/.test(v) ? "'" : "") +
              v.replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
