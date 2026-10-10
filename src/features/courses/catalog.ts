import source from "./source-catalog.json";
import {
  informationUnits,
  englishUnits,
  englishSource,
} from "./public-catalog";
import { emptyData } from "../../types/model";
import type { AppData, StudyMode, Subject, Course } from "../../types/model";
import { db, readData } from "../../db/database";
import { now, uid } from "../../utils/time";
export type CatalogLesson = {
  key: string;
  title: string;
  chapter: string;
  section: string;
  sourcePath: string;
  order: number;
};
export type CatalogCourse = {
  id: string;
  title: string;
  teacher: string;
  subject: Subject;
  mode: StudyMode;
  source: string;
  externalUrl?: string;
  lessons: CatalogLesson[];
};
const order = [
  "special_math",
  "theoretical",
  "electromag",
  "heat_wave",
  "math_cards",
  "mechanics",
  "organic",
  "inorganic",
  "mathC",
  "probability",
  "integer",
  "information",
  "japanese_ct",
  "todai_math",
];
export const catalog: CatalogCourse[] = source
  .map((c) => ({
    ...c,
    subject: (["theoretical", "organic", "inorganic"].includes(c.id)
      ? "chemistry"
      : ["electromag", "heat_wave", "mechanics"].includes(c.id)
        ? "physics"
        : c.id === "information"
          ? "information"
          : c.id === "japanese_ct"
            ? "japanese"
            : "mathematics") as Subject,
    mode: (c.id === "special_math" ? "reproduction" : "video") as StudyMode,
    source: c.lessons.length
      ? "USBの授業フォルダ・登録サイトと照合済み"
      : "登録サイトの講座名のみ確認・授業未登録",
  }))
  .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const info = catalog.find((c) => c.id === "information")!;
info.source = "受講ページで73授業・5章を確認（2026-10-08）";
info.teacher = "藤原進之介";
info.externalUrl = "https://konojyuku.com/mypage/lecture/118970";
info.lessons = informationUnits
  .filter((u) => u.teacher === "藤原進之介")
  .flatMap((u) =>
    u.titles.map((title, n) => ({
      key: "information:" + u.teacher + "/" + u.name + "/" + title,
      title,
      chapter: u.name,
      section: "授業",
      sourcePath: info.externalUrl!,
      order: n,
    })),
  );
catalog.push({
  id: "english_writing",
  title: "徹底基礎講座【英作文】",
  teacher: "",
  subject: "english",
  mode: "video",
  source: "公式公開カリキュラム（以前の登録教材）",
  externalUrl: englishSource,
  lessons: englishUnits.flatMap((u) =>
    u.titles.map((title, n) => ({
      key: "english_writing:" + u.name + "/" + title,
      title,
      chapter: "英作文",
      section: u.name,
      sourcePath: englishSource,
      order: n,
    })),
  ),
});
export function catalogData(catalogId: string, existing?: Course): AppData {
  const c = catalog.find((c) => c.id === catalogId);
  if (!c) throw new Error("講座がありません");
  const data = emptyData();
  const course: Course = existing
    ? { ...existing, catalogId: c.id, teacher: c.teacher }
    : {
        id: uid(),
        name: c.title,
        subject: c.subject,
        defaultMode: c.mode,
        catalogId: c.id,
        teacher: c.teacher,
        externalUrl: c.externalUrl,
        createdAt: now(),
        archived: false,
      };
  data.courses.push(course);
  for (const lesson of c.lessons) {
    const catalogKey = c.id + ":" + lesson.chapter + "/" + lesson.section;
    let unit = data.units.find((u) => u.catalogKey === catalogKey);
    if (!unit) {
      unit = {
        id: uid(),
        courseId: course.id,
        name: lesson.section,
        chapter: lesson.chapter,
        catalogKey,
        order: data.units.length,
        archived: false,
      };
      data.units.push(unit);
    }
    data.studyItems.push({
      id: uid(),
      courseId: course.id,
      unitId: unit.id,
      title: lesson.title,
      type: "video",
      studyMode: course.defaultMode,
      catalogKey: lesson.key,
      sourcePath: lesson.sourcePath,
      order: lesson.order,
      initialStatus: "UNSEEN",
      archived: false,
    });
  }
  return data;
}
export async function addCatalog(catalogId: string, existingId?: string) {
  return db.transaction("rw", db.tables, async () => {
    const existing = existingId ? await db.courses.get(existingId) : undefined;
    if (existingId && !existing) throw new Error("教材がありません");
    const current = await readData();
    if (
      !existing &&
      current.courses.some(
        (c) =>
          c.catalogId === catalogId ||
          c.name === catalog.find((x) => x.id === catalogId)?.title,
      )
    )
      throw new Error(
        "同名の講座があります。その講座の「授業一覧を取り込む」を使用してください。",
      );
    if (existing?.catalogId && existing.catalogId !== catalogId)
      throw new Error("別の講座に紐付いています");
    const incoming = catalogData(catalogId, existing);
    await saveCatalogSnapshot(current, incoming.courses[0].id);
    await db.courses.put(incoming.courses[0]);
    const unitIds = new Map<string, string>();
    for (const u of incoming.units) {
      const old = current.units.find(
        (x) => x.courseId === u.courseId && x.catalogKey === u.catalogKey,
      );
      unitIds.set(u.id, old?.id ?? u.id);
      if (!old) await db.units.add(u);
    }
    let added = 0;
    for (const i of incoming.studyItems)
      if (
        !current.studyItems.some(
          (x) => x.courseId === i.courseId && x.catalogKey === i.catalogKey,
        )
      ) {
        await db.studyItems.add({ ...i, unitId: unitIds.get(i.unitId)! });
        added++;
      }
    return added;
  });
}
// One-time, user-requested inclusion. Keep legacy IDs, records and mappings untouched.
export const inorganicUpdateKey = "catalog-inorganic-2026-10-09";
export async function ensureInorganicCourse() {
  return db.transaction("rw", db.tables, async () => {
    if ((await db.settings.get(inorganicUpdateKey))?.value) return;
    const courses = await db.courses.toArray();
    if (!courses.length) return;
    const exact = courses.filter(
      (c) =>
        c.catalogId === "inorganic" || c.name === "徹底基礎講座【無機化学】",
    );
    const legacy = courses.filter(
      (c) =>
        c.subject === "chemistry" && /無機化学/.test(c.name) && !c.catalogId,
    );
    const existing = exact[0] ?? (legacy.length === 1 ? legacy[0] : undefined);
    // Ambiguous legacy names need the visible import/mapping UI; never guess a mapping.
    if (!exact.length && legacy.length > 1) {
      await db.settings.put({
        key: inorganicUpdateKey,
        value: "multiple-existing",
      });
      return;
    }
    await addCatalog("inorganic", existing?.id);
    if (existing) await db.courses.update(existing.id, { archived: false });
    await db.settings.put({ key: inorganicUpdateKey, value: true });
  });
}
// Explicit selection only: never match a legacy ordinal to a lesson index.
export async function assignLesson(
  itemId: string,
  catalogId: string,
  lessonKey: string,
) {
  await db.transaction("rw", db.tables, async () => {
    const item = await db.studyItems.get(itemId);
    const c = catalog.find((c) => c.id === catalogId);
    const lesson = c?.lessons.find((l) => l.key === lessonKey);
    if (!item || !c || !lesson) throw new Error("授業がありません");
    const course = await db.courses.get(item.courseId);
    if (course?.catalogId !== catalogId && course?.name !== c.title)
      throw new Error("講座が一致しません");
    const all = await db.studyItems
      .where("courseId")
      .equals(item.courseId)
      .toArray();
    const duplicate = all.find(
      (i) => i.id !== item.id && i.catalogKey === lessonKey,
    );
    if (
      duplicate &&
      ((await db.attempts.where("itemId").equals(duplicate.id).count()) ||
        (await db.studySessions.where("itemId").equals(duplicate.id).count()) ||
        duplicate.initialStatus !== "UNSEEN" ||
        (await db.sprintGoals.toArray()).some(
          (g) =>
            g.itemId === duplicate.id ||
            g.scope?.itemIds?.includes(duplicate.id),
        ) ||
        (await db.coachQuestions.toArray()).some(
          (q) => q.relatedItemId === duplicate.id,
        ) ||
        all.some((i) => i.relatedItemId === duplicate.id))
    )
      throw new Error(
        "選んだ授業にも既存の記録・参照があります。記録を混ぜず、先に両方の内容を確認してください。",
      );
    const current = await readData();
    await saveCatalogSnapshot(current, item.courseId);
    const key = c.id + ":" + lesson.chapter + "/" + lesson.section;
    let unit = (
      await db.units.where("courseId").equals(item.courseId).toArray()
    ).find((u) => u.catalogKey === key);
    if (!unit) {
      unit = {
        id: uid(),
        courseId: item.courseId,
        name: lesson.section,
        chapter: lesson.chapter,
        catalogKey: key,
        order: [
          ...new Set(c.lessons.map((l) => l.chapter + "/" + l.section)),
        ].indexOf(lesson.chapter + "/" + lesson.section),
        archived: false,
      };
      await db.units.add(unit);
    }
    if (duplicate)
      await db.studyItems.update(duplicate.id, {
        archived: true,
        catalogKey: undefined,
      });
    await db.studyItems.update(item.id, {
      title: lesson.title,
      number: undefined,
      unitId: unit.id,
      catalogKey: lesson.key,
      sourcePath: lesson.sourcePath,
      order: lesson.order,
    });
  });
}

async function saveCatalogSnapshot(current: AppData, courseId: string) {
  const value = {
    schemaVersion: 4,
    exportedAt: now(),
    data: {
      ...current,
      settings: current.settings.filter(
        (s) => !s.key.startsWith("before-catalog:"),
      ),
    },
  };
  const baseline = "before-catalog:baseline:" + courseId;
  if (!(await db.settings.get(baseline)))
    await db.settings.put({ key: baseline, value });
  await db.settings.put({ key: "before-catalog:latest:" + courseId, value });
}
