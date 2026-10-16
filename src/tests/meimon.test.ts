import { beforeEach, afterAll, expect, it } from "vitest";
import {
  meimonData,
  ensureMeimonBooks,
  meimonUpdateKey,
} from "../features/courses/meimon";
import { db, readData } from "../db/database";
import {
  importBackup,
  makeBackup,
  backupSchema,
} from "../features/backup/backup";
import { fixture, math, stamp, withSession } from "./fixtures";
import { courseProgress } from "../domain/study";
import { itemNeighbors } from "../features/study/itemNavigation";
import { addManualRecord } from "../features/study/records";
import { newAttempt } from "../features/study/session";

const ids = [
  "meimon-mechanics-heat-waves1",
  "meimon-waves2-electromagnetism-atom",
];
// Independent expectations transcribed from the user's tables, including all boundaries.
const expected = [
  {
    name: "名問の森 力学・熱・波動Ⅰ",
    count: 75,
    important: [
      1, 2, 4, 7, 8, 10, 11, 13, 14, 15, 17, 20, 21, 25, 28, 29, 32, 34, 40, 44,
      46, 48, 50, 51, 52, 53, 55, 56, 62, 63, 64, 65, 67, 69, 70, 73,
    ],
    fields: [
      [
        "力学",
        [
          ["放物運動", 1, 3],
          ["剛体のつり合い", 4, 6],
          ["運動方程式", 7, 10],
          ["エネルギー保存則", 11, 12],
          ["運動量保存則", 13, 14],
          ["保存則", 15, 19],
          ["慣性力", 20, 24],
          ["等速円運動", 25, 27],
          ["円運動", 28, 30],
          ["円運動・単振動", 31, 31],
          ["単振動", 32, 43],
          ["万有引力", 44, 45],
        ],
      ],
      [
        "熱",
        [
          ["比熱・熱容量", 46, 46],
          ["気体の法則", 47, 47],
          ["分子運動論", 48, 49],
          ["熱力学", 50, 61],
        ],
      ],
      [
        "波動Ⅰ",
        [
          ["波の性質", 62, 62],
          ["反射・定常波", 63, 63],
          ["弦の共振", 64, 65],
          ["気柱の共鳴", 66, 66],
          ["弦と気柱の共鳴", 67, 67],
          ["波の式", 68, 68],
          ["ドップラー効果", 69, 72],
          ["反射・屈折の法則", 73, 73],
          ["レンズ", 74, 74],
          ["光波", 75, 75],
        ],
      ],
    ],
  },
  {
    name: "名問の森 波動Ⅱ・電磁気・原子",
    count: 69,
    important: [
      1, 3, 5, 6, 7, 10, 11, 16, 18, 19, 20, 23, 25, 26, 27, 28, 29, 30, 31, 32,
      34, 36, 37, 40, 41, 44, 47, 51, 52, 53, 56, 59, 63, 64, 65,
    ],
    fields: [
      [
        "波動Ⅱ",
        [
          ["波の干渉", 1, 2],
          ["光の干渉", 3, 9],
        ],
      ],
      [
        "電磁気",
        [
          ["静電気", 10, 15],
          ["コンデンサー", 16, 24],
          ["直流回路", 25, 33],
          ["電流と磁場", 34, 35],
          ["電磁誘導", 36, 46],
          ["過渡現象・交流", 47, 47],
          ["交流", 48, 49],
          ["電磁場中の粒子", 50, 55],
        ],
      ],
      [
        "原子",
        [
          ["光の粒子性", 56, 58],
          ["X線管・物質波", 59, 59],
          ["原子構造", 60, 62],
          ["原子核", 63, 69],
        ],
      ],
    ],
  },
] as const;
beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
});
afterAll(() => db.close());
it.each([0, 1])(
  "registers every number and exact field/unit in book %i",
  (index) => {
    const data = meimonData(),
      book = expected[index];
    expect(data.courses[index]).toMatchObject({
      id: ids[index],
      name: book.name,
      subject: "physics",
      defaultMode: "deep_recall",
    });
    const items = data.studyItems.filter((i) => i.courseId === ids[index]);
    expect(items.map((i) => i.number)).toEqual(
      Array.from({ length: book.count }, (_, n) => n + 1),
    );
    let checked = 0;
    for (const [field, units] of book.fields)
      for (const [name, first, last] of units) {
        for (let n = first; n <= last; n++) {
          const item = items.find((i) => i.number === n)!;
          expect(item).toMatchObject({
            title: `第${n}問`,
            type: "problem",
            studyMode: "deep_recall",
          });
          expect(data.units.find((u) => u.id === item.unitId)).toMatchObject({
            courseId: ids[index],
            chapter: field,
            name,
          });
          checked++;
        }
      }
    expect(checked).toBe(book.count);
  },
);
it.each([0, 1])(
  "matches the complete important-number list in book %i",
  (index) => {
    const items = meimonData().studyItems.filter(
      (i) => i.courseId === ids[index],
    );
    expect(items.filter((i) => i.important).map((i) => i.number)).toEqual([
      ...expected[index].important,
    ]);
    expect(items.filter((i) => i.important)).toHaveLength(
      index === 0 ? 36 : 35,
    );
  },
);
it("has 144 unique stable IDs, 71 important questions, and ordinary waves-I question 66", () => {
  const data = meimonData();
  expect(data.studyItems).toHaveLength(144);
  expect(data.studyItems.filter((i) => i.important)).toHaveLength(71);
  expect(new Set(data.studyItems.map((i) => i.id)).size).toBe(144);
  expect(meimonData().studyItems).toEqual(data.studyItems);
  expect(
    data.studyItems.find((i) => i.courseId === ids[0] && i.number === 66)
      ?.important,
  ).toBe(false);
  const firsts = ids.map((id) =>
    data.studyItems.find((i) => i.courseId === id && i.number === 1)!,
  );
  expect(firsts[0].id).not.toBe(firsts[1].id);
  expect(itemNeighbors(data, firsts[0], undefined, true).next?.number).toBe(2);
  const second = data.studyItems.find(
    (i) => i.courseId === ids[0] && i.number === 2,
  )!;
  expect(itemNeighbors(data, second, undefined, true).next?.number).toBe(4);
  expect(itemNeighbors(data, second).next?.number).toBe(3);
});
it("adds both books atomically and idempotently without modifying old records, goals or priorities", async () => {
  const old = fixture();
  withSession(old, math(), "mathematics", "manual");
  old.sprints.push({
    id: "old-sprint",
    title: "existing",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
  });
  old.sprintGoals.push({
    id: "chem-quota",
    sprintId: "old-sprint",
    courseId: "chemistry",
    title: "existing combined chemistry",
    kind: "daily_count",
    target: 2,
    weekends: { min: 7, max: 8 },
    completed: false,
  });
  old.settings.push({
    key: "today-priorities:v1",
    value: { courses: ["chemistry", "physics"], subjects: ["physics"] },
  });
  await importBackup(
    { schemaVersion: 4, exportedAt: stamp, data: old },
    "replace",
  );
  const before = await readData();
  await Promise.all([ensureMeimonBooks(), ensureMeimonBooks()]);
  const after = await readData();
  expect(after.courses).toHaveLength(before.courses.length + 2);
  expect(after.studyItems).toHaveLength(before.studyItems.length + 144);
  for (const row of before.courses)
    expect(after.courses.find((c) => c.id === row.id)).toEqual(row);
  for (const row of before.studyItems)
    expect(after.studyItems.find((i) => i.id === row.id)).toEqual(row);
  expect(after.attempts).toEqual(before.attempts);
  expect(after.studySessions).toEqual(before.studySessions);
  expect(after.sprints).toEqual(before.sprints);
  expect(after.sprintGoals).toEqual(before.sprintGoals);
  for (const setting of before.settings)
    expect(after.settings.find((s) => s.key === setting.key)).toEqual(setting);
  await ensureMeimonBooks();
  expect(await readData()).toEqual(after);
  expect(backupSchema.safeParse(await makeBackup()).success).toBe(true);
});
it("reuses the same-named course and numbered item IDs and preserves recall history when importance is refreshed", async () => {
  const incoming = meimonData();
  const course = {
    ...incoming.courses[0],
    id: "existing-book",
    catalogId: undefined,
  };
  const unit = {
    ...incoming.units[0],
    id: "existing-unit",
    courseId: course.id,
  };
  const item = {
    ...incoming.studyItems[0],
    id: "existing-question",
    courseId: course.id,
    unitId: unit.id,
    important: false,
    initialStatus: "UNDERSTOOD" as const,
  };
  await db.courses.add(course);
  await db.units.add(unit);
  await db.studyItems.add(item);
  const attempt = newAttempt(item, "saved-physics");
  if (attempt.mode !== "deep_recall") throw Error("wrong mode");
  attempt.checks = Array(8).fill(true);
  await addManualRecord(item, attempt, stamp, 600, "既存の記録", true);
  const history = await db.attempts.toArray(),
    sessions = await db.studySessions.toArray();
  await ensureMeimonBooks();
  let data = await readData();
  expect(data.courses.filter((c) => c.name === expected[0].name)).toHaveLength(
    1,
  );
  expect(data.studyItems.filter((i) => i.courseId === course.id)).toHaveLength(
    75,
  );
  expect(await db.studyItems.get(item.id)).toMatchObject({
    id: item.id,
    important: true,
    initialStatus: "UNDERSTOOD",
  });
  expect(
    courseProgress(
      data.studyItems.filter((i) => i.courseId === course.id && i.important),
      data.attempts,
    ),
  ).toMatchObject({ total: 36, attempted: 1, completed: 1, remaining: 35 });
  await db.studyItems.update(item.id, { important: false });
  await db.settings.delete(meimonUpdateKey);
  await ensureMeimonBooks();
  data = await readData();
  expect(data.attempts).toEqual(history);
  expect(data.studySessions).toEqual(sessions);
  expect(
    data.studyItems.filter((i) => i.courseId === course.id && i.number === 1),
  ).toHaveLength(1);
  expect(
    backupSchema
      .parse(await makeBackup())
      .data.studyItems.find((i) => i.id === item.id)?.important,
  ).toBe(true);
});
it("refuses ambiguous existing duplicates without partially adding either book", async () => {
  const data = meimonData();
  await db.courses.bulkAdd([
    { ...data.courses[0], id: "one" },
    { ...data.courses[0], id: "two" },
  ]);
  const before = await readData();
  await expect(ensureMeimonBooks()).rejects.toThrow("複数");
  expect(await readData()).toEqual(before);
});
