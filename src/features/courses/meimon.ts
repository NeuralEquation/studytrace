import type { AppData, Course } from "../../types/model";
import { emptyData } from "../../types/model";
import { db, readData } from "../../db/database";

type Section = readonly [
  field: string,
  unit: string,
  first: number,
  last: number,
];
export const meimonBooks: {
  id: string;
  name: string;
  count: number;
  important: number[];
  sections: Section[];
}[] = [
  {
    id: "meimon-mechanics-heat-waves1",
    name: "名問の森 力学・熱・波動Ⅰ",
    count: 75,
    important: [
      1, 2, 4, 7, 8, 10, 11, 13, 14, 15, 17, 20, 21, 25, 28, 29, 32, 34, 40, 44,
      46, 48, 50, 51, 52, 53, 55, 56, 62, 63, 64, 65, 67, 69, 70, 73,
    ],
    sections: [
      ["力学", "放物運動", 1, 3],
      ["力学", "剛体のつり合い", 4, 6],
      ["力学", "運動方程式", 7, 10],
      ["力学", "エネルギー保存則", 11, 12],
      ["力学", "運動量保存則", 13, 14],
      ["力学", "保存則", 15, 19],
      ["力学", "慣性力", 20, 24],
      ["力学", "等速円運動", 25, 27],
      ["力学", "円運動", 28, 30],
      ["力学", "円運動・単振動", 31, 31],
      ["力学", "単振動", 32, 43],
      ["力学", "万有引力", 44, 45],
      ["熱", "比熱・熱容量", 46, 46],
      ["熱", "気体の法則", 47, 47],
      ["熱", "分子運動論", 48, 49],
      ["熱", "熱力学", 50, 61],
      ["波動Ⅰ", "波の性質", 62, 62],
      ["波動Ⅰ", "反射・定常波", 63, 63],
      ["波動Ⅰ", "弦の共振", 64, 65],
      ["波動Ⅰ", "気柱の共鳴", 66, 66],
      ["波動Ⅰ", "弦と気柱の共鳴", 67, 67],
      ["波動Ⅰ", "波の式", 68, 68],
      ["波動Ⅰ", "ドップラー効果", 69, 72],
      ["波動Ⅰ", "反射・屈折の法則", 73, 73],
      ["波動Ⅰ", "レンズ", 74, 74],
      ["波動Ⅰ", "光波", 75, 75],
    ],
  },
  {
    id: "meimon-waves2-electromagnetism-atom",
    name: "名問の森 波動Ⅱ・電磁気・原子",
    count: 69,
    important: [
      1, 3, 5, 6, 7, 10, 11, 16, 18, 19, 20, 23, 25, 26, 27, 28, 29, 30, 31, 32,
      34, 36, 37, 40, 41, 44, 47, 51, 52, 53, 56, 59, 63, 64, 65,
    ],
    sections: [
      ["波動Ⅱ", "波の干渉", 1, 2],
      ["波動Ⅱ", "光の干渉", 3, 9],
      ["電磁気", "静電気", 10, 15],
      ["電磁気", "コンデンサー", 16, 24],
      ["電磁気", "直流回路", 25, 33],
      ["電磁気", "電流と磁場", 34, 35],
      ["電磁気", "電磁誘導", 36, 46],
      ["電磁気", "過渡現象・交流", 47, 47],
      ["電磁気", "交流", 48, 49],
      ["電磁気", "電磁場中の粒子", 50, 55],
      ["原子", "光の粒子性", 56, 58],
      ["原子", "X線管・物質波", 59, 59],
      ["原子", "原子構造", 60, 62],
      ["原子", "原子核", 63, 69],
    ],
  },
];
export const meimonUpdateKey = "builtin-meimon:v1";
export function meimonData(existing: Course[] = []): AppData {
  const data = emptyData();
  for (const book of meimonBooks) {
    const matches = existing.filter(
      (c) =>
        c.id === book.id || c.catalogId === book.id || c.name === book.name,
    );
    if (matches.length > 1)
      throw new Error(
        book.name +
          "が複数登録されています。既存記録を保護するため自動追加を中止しました。",
      );
    const course: Course = matches[0]
      ? { ...matches[0], catalogId: book.id }
      : {
          id: book.id,
          catalogId: book.id,
          name: book.name,
          subject: "physics",
          defaultMode: "deep_recall",
          createdAt: "2026-10-17T00:00:00.000Z",
          archived: false,
        };
    data.courses.push(course);
    book.sections.forEach(([field, name, first, last], order) => {
      const unitId = course.id + ":unit:" + first;
      data.units.push({
        id: unitId,
        courseId: course.id,
        chapter: field,
        name,
        order,
        catalogKey: book.id + ":unit:" + first,
        archived: false,
      });
      for (let number = first; number <= last; number++)
        data.studyItems.push({
          id: course.id + ":q:" + number,
          courseId: course.id,
          unitId,
          catalogKey: book.id + ":q:" + number,
          title: `第${number}問`,
          number,
          type: "problem",
          studyMode: "deep_recall",
          important: book.important.includes(number),
          order: number,
          initialStatus: "UNSEEN",
          archived: false,
        });
    });
  }
  return data;
}
// Additive, atomic installation; never replaces histories, progress or user priorities.
export async function ensureMeimonBooks() {
  return db.transaction("rw", db.tables, async () => {
    if ((await db.settings.get(meimonUpdateKey))?.value === true) return;
    const current = await readData();
    const incoming = meimonData(current.courses);
    for (const course of incoming.courses) await db.courses.put(course);
    const unitIds = new Map<string, string>();
    for (const unit of incoming.units) {
      const matches = current.units.filter(
        (u) =>
          u.courseId === unit.courseId &&
          (u.id === unit.id ||
            u.catalogKey === unit.catalogKey ||
            (u.chapter === unit.chapter && u.name === unit.name)),
      );
      if (matches.length > 1)
        throw new Error(
          "名問の森の単元が重複しています。自動追加を中止しました。",
        );
      const old = matches[0];
      unitIds.set(unit.id, old?.id ?? unit.id);
      if (!old) await db.units.add(unit);
    }
    for (const item of incoming.studyItems) {
      const matches = current.studyItems.filter(
        (i) =>
          i.courseId === item.courseId &&
          (i.id === item.id ||
            i.catalogKey === item.catalogKey ||
            i.number === item.number),
      );
      if (matches.length > 1)
        throw new Error(
          "名問の森の問題番号が重複しています。自動追加を中止しました。",
        );
      const old = matches[0];
      if (old)
        await db.studyItems.update(old.id, {
          important: item.important,
          catalogKey: item.catalogKey,
          number: item.number,
        });
      else
        await db.studyItems.add({ ...item, unitId: unitIds.get(item.unitId)! });
    }
    await db.settings.put({ key: meimonUpdateKey, value: true });
  });
}
