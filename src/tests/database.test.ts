import { beforeEach, afterAll, it, expect, vi } from "vitest";
import Dexie from "dexie";
import { db, readData, StudyDatabase, v1Stores } from "../db/database";
import {
  importBackup,
  makeBackup,
  importCourse,
  backupSchema,
} from "../features/backup/backup";
import { startStudy, stopStudy, finishStudy } from "../features/study/session";
import { newAttempt } from "../features/study/session";
import { modes } from "../types/model";
import { deleteUnusedUnit } from "../features/courses/deleteUnit";
import { fixture, math, stamp } from "./fixtures";
import { catalog, addCatalog, assignLesson } from "../features/courses/catalog";
import {
  editRecord,
  setRecordDeleted,
  activeData,
} from "../features/study/records";
import { personalBest, mathStatus } from "../domain/study";
import { speed, withSession } from "./fixtures";
import { createTemplates } from "../features/courses/templates";
import {
  informationUnits,
  englishUnits,
} from "../features/courses/public-catalog";
beforeEach(async () => {
  vi.useRealTimers();
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
});
afterAll(() => {
  vi.useRealTimers();
  db.close();
});
it("deletes an unused unit and its items without touching other units", async () => {
  const d = fixture();
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  await deleteUnusedUnit(d.units[0].id);
  expect(await db.units.get(d.units[0].id)).toBeUndefined();
  expect(await db.studyItems.get(d.studyItems[0].id)).toBeUndefined();
  expect(await db.units.count()).toBe(d.units.length - 1);
  expect(backupSchema.safeParse(await makeBackup()).success).toBe(true);
  await expect(startStudy(d.studyItems[0])).rejects.toThrow("削除");
});
it("refuses deletion of a unit with an active session and leaves all records intact", async () => {
  const d = fixture();
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  await startStudy(d.studyItems[0]);
  const before = await readData();
  await expect(deleteUnusedUnit(d.units[0].id)).rejects.toThrow("非表示");
  expect(await readData()).toEqual(before);
});
it("preserves units referenced by questions or explicit initial progress", async () => {
  const d = fixture();
  d.coachQuestions.push({
    id: "q",
    text: "質問",
    createdAt: stamp,
    resolved: false,
    relatedItemId: d.studyItems[0].id,
  });
  d.studyItems[1].initialStatus = "ATTEMPTED";
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  const before = await readData();
  await expect(deleteUnusedUnit(d.units[0].id)).rejects.toThrow();
  await expect(deleteUnusedUnit(d.units[1].id)).rejects.toThrow();
  expect(await readData()).toEqual(before);
});
it("concurrent start and deletion never create orphaned learning records", async () => {
  const d = fixture();
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  await Promise.allSettled([
    deleteUnusedUnit(d.units[0].id),
    startStudy(d.studyItems[0]),
  ]);
  expect(backupSchema.safeParse(await makeBackup()).success).toBe(true);
});
it.each(modes)(
  "round-trips %s results, sessions and drafts through JSON backup",
  async (mode) => {
    const d = fixture();
    const item = { ...d.studyItems[0], studyMode: mode };
    d.studyItems[0] = item;
    await importBackup(
      { schemaVersion: 2, exportedAt: stamp, data: d },
      "replace",
    );
    const sessionId = await startStudy(item);
    const attempt = newAttempt(item, sessionId);
    attempt.notes = "復元後も残るメモ";
    if (attempt.mode === "past_exam") {
      attempt.university = "検証大学";
      attempt.subject = "英語";
      attempt.score = 82;
      attempt.maxScore = 120;
      attempt.sections = [{ name: "大問1", score: 40, maxScore: 60 }];
      attempt.reviewCompleted = true;
    }
    if (attempt.mode === "memorization") {
      attempt.range = "1〜30";
      attempt.completion = 100;
    }
    if (attempt.mode === "reading") {
      attempt.section = "第1章";
      attempt.progress = 75;
    }
    if (attempt.mode === "practice") {
      attempt.completion = 100;
      attempt.result = "completed";
    }
    await stopStudy(sessionId);
    await finishStudy(attempt);
    const saved = await makeBackup();
    expect(backupSchema.safeParse(saved).success).toBe(true);
    const json = JSON.parse(JSON.stringify(saved));
    await importBackup(json, "replace");
    expect(await readData()).toEqual(saved.data);
    expect((await db.attempts.get(sessionId))?.mode).toBe(mode);
  },
);
it("merging the same backup twice is idempotent and retains all rows", async () => {
  const backup = { schemaVersion: 2, exportedAt: stamp, data: fixture() };
  await importBackup(backup, "merge");
  const before = await readData();
  await importBackup(backup, "merge");
  expect(await readData()).toEqual(before);
});
it("starts in DB and restores elapsed time after close/reopen; stop freezes time", async () => {
  const data = fixture();
  await importBackup({ schemaVersion: 2, exportedAt: stamp, data }, "replace");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(stamp));
  const id = await startStudy(data.studyItems[0]);
  db.close();
  await db.open();
  vi.setSystemTime(new Date(new Date(stamp).getTime() + 125000));
  await stopStudy(id);
  expect((await db.studySessions.get(id))?.durationSeconds).toBe(125);
  vi.setSystemTime(new Date(new Date(stamp).getTime() + 999000));
  await finishStudy(math({ id, sessionId: id }));
  expect((await db.attempts.get(id))?.durationSeconds).toBe(125);
  expect((await db.studySessions.get(id))?.endedAt).toBe(
    "2026-10-07T03:02:05.000Z",
  );
});
it("two simultaneous starts cannot create competing timers", async () => {
  const d = fixture();
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  const result = await Promise.allSettled([
    startStudy(d.studyItems[0]),
    startStudy(d.studyItems[1]),
  ]);
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.studySessions.count()).toBe(1);
});
it("persists active draft and bottleneck in a validated backup", async () => {
  const d = fixture();
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  const id = await startStudy(d.studyItems[0]);
  await db.bottlenecks.add({
    id: "b",
    attemptId: id,
    type: "strategy",
    note: "方針を相談",
    createdAt: stamp,
  });
  expect(backupSchema.safeParse(await makeBackup()).success).toBe(true);
});
it("invalid replacement leaves all existing data intact", async () => {
  await db.courses.put(fixture().courses[0]);
  const before = await readData();
  const invalid = { schemaVersion: 2, exportedAt: stamp, data: fixture() };
  invalid.data.studyItems[0].unitId = "missing";
  await expect(importBackup(invalid, "replace")).rejects.toThrow();
  expect(await readData()).toEqual(before);
});
it("replace restores all tables including draft without changing raw data", async () => {
  const d = fixture();
  d.attempts.push(math());
  d.progressReportDrafts.push({
    id: "report",
    startDate: "2026-10-07",
    endDate: "2026-10-14",
    text: "人間が編集した提出文",
    generatedAt: stamp,
    updatedAt: stamp,
    edited: true,
    detail: "compact",
    daily: true,
  });
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  await db.progressReportDrafts.update("report", { text: "別の文章" });
  expect(await db.attempts.toArray()).toEqual(d.attempts);
  expect((await makeBackup()).data.progressReportDrafts[0].text).toBe(
    "別の文章",
  );
});
it("merge conflict aborts every incoming row", async () => {
  const d = fixture();
  await db.courses.put({ ...d.courses[0], name: "現在の教材名" });
  const before = await readData();
  await expect(
    importBackup({ schemaVersion: 2, exportedAt: stamp, data: d }, "merge"),
  ).rejects.toThrow("Merge");
  expect(await readData()).toEqual(before);
});
it("course import assigns independent IDs and preserves separate modes", async () => {
  const value = {
    name: "情報",
    subject: "information",
    units: [
      {
        name: "Unit 1",
        items: [
          { title: "講義", type: "video", studyMode: "video" },
          { title: "演習", type: "programming", studyMode: "practice" },
        ],
      },
    ],
  };
  await importCourse(value);
  await importCourse(value);
  expect(await db.courses.count()).toBe(2);
  const items = await db.studyItems.toArray();
  expect(new Set(items.map((i) => i.id)).size).toBe(4);
  expect(items.filter((i) => i.studyMode === "video")).toHaveLength(2);
  expect(items.filter((i) => i.studyMode === "practice")).toHaveLength(2);
});
it("v1 to v2 migration retains existing records and adds independent report table", async () => {
  const name = "migration-" + crypto.randomUUID();
  const old = new Dexie(name);
  old.version(1).stores(v1Stores);
  await old.table("courses").put(fixture().courses[0]);
  old.close();
  const migrated = new StudyDatabase(name);
  await migrated.open();
  expect((await migrated.courses.toArray())[0].name).toBe("mathematics");
  expect(await migrated.progressReportDrafts.count()).toBe(0);
  migrated.close();
});
it("verified public metadata totals match 73 + 53 and 43, without fabricated lessons", () => {
  expect(
    informationUnits
      .filter((u) => u.teacher === "藤原進之介")
      .reduce((n, u) => n + u.titles.length, 0),
  ).toBe(73);
  expect(
    informationUnits
      .filter((u) => u.teacher === "斎藤昴")
      .reduce((n, u) => n + u.titles.length, 0),
  ).toBe(53);
  expect(englishUnits.reduce((n, u) => n + u.titles.length, 0)).toBe(43);
  const d = createTemplates([
    0,
    catalog.findIndex((c) => c.id === "english_writing"),
    catalog.findIndex((c) => c.id === "information"),
  ]);
  expect(d.attempts).toHaveLength(0);
  expect(
    d.studyItems.filter((i) => i.initialStatus === "ATTEMPTED"),
  ).toHaveLength(0);
  expect(d.studyItems.filter((i) => i.studyMode === "video")).toHaveLength(116);
  expect(
    backupSchema.safeParse({ schemaVersion: 2, exportedAt: stamp, data: d })
      .success,
  ).toBe(true);
});

it("edits linked time and result atomically, updates PB, preserves identity, and rejects stale edits", async () => {
  const d = fixture();
  const a = speed();
  withSession(d, a, "chemistry");
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  const original = {
    attempt: await db.attempts.get(a.id),
    session: await db.studySessions.get(a.sessionId!),
  };
  const edit = {
    attempt: { ...a, result: "incorrect" as const, accuracy: 0 },
    startedAt: stamp,
    durationSeconds: 90,
    note: "訂正",
    includeInCoachReport: true,
  };
  await editRecord(original, edit);
  const changed = activeData(await readData());
  expect(changed.attempts[0]).toMatchObject({
    id: a.id,
    itemId: a.itemId,
    durationSeconds: 90,
    notes: "訂正",
    result: "incorrect",
  });
  expect(changed.studySessions[0]).toMatchObject({
    id: a.sessionId,
    durationSeconds: 90,
    note: "訂正",
  });
  expect(personalBest(changed.attempts).best).toBeUndefined();
  expect(backupSchema.safeParse(await makeBackup()).success).toBe(true);
  await expect(editRecord(original, edit)).rejects.toThrow("別の画面");
});
it("removes and restores a complete record from progress, time, and bottleneck aggregation", async () => {
  const d = fixture();
  const a = math();
  withSession(d, a, "mathematics");
  d.bottlenecks.push({
    id: "b",
    attemptId: a.id,
    type: "strategy",
    createdAt: stamp,
  });
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  await setRecordDeleted(a.id, a.sessionId, true);
  const raw = await readData();
  const active = activeData(raw);
  expect(raw.attempts).toHaveLength(1);
  expect(raw.studySessions).toHaveLength(1);
  expect(active.attempts).toHaveLength(0);
  expect(active.studySessions).toHaveLength(0);
  expect(active.bottlenecks).toHaveLength(0);
  expect(mathStatus(d.studyItems[0], active.attempts)).toBe("UNSEEN");
  expect(backupSchema.safeParse(await makeBackup()).success).toBe(true);
  await setRecordDeleted(a.id, a.sessionId, false);
  const restored = activeData(await readData());
  expect(mathStatus(d.studyItems[0], restored.attempts)).toBe("REPRODUCIBLE");
  expect(restored.studySessions[0].durationSeconds).toBe(600);
  expect(restored.bottlenecks).toHaveLength(1);
});
it("edits and restores manual time, and prevents editing or deleting a running timer", async () => {
  const d = fixture();
  d.studySessions.push({
    id: "manual",
    courseId: "mathematics",
    mode: "reading",
    startedAt: stamp,
    endedAt: stamp,
    durationSeconds: 600,
    source: "manual",
    includeInCoachReport: false,
  });
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  await editRecord(
    { session: await db.studySessions.get("manual") },
    {
      startedAt: stamp,
      durationSeconds: 120,
      note: "manual edit",
      includeInCoachReport: false,
    },
  );
  expect((await db.studySessions.get("manual"))?.durationSeconds).toBe(120);
  await setRecordDeleted(undefined, "manual", true);
  expect(activeData(await readData()).studySessions).toHaveLength(0);
  await setRecordDeleted(undefined, "manual", false);
  const id = await startStudy(d.studyItems[0]);
  await expect(setRecordDeleted(undefined, id, true)).rejects.toThrow("計測中");
  await expect(
    editRecord(
      { session: await db.studySessions.get(id) },
      {
        startedAt: stamp,
        durationSeconds: 120,
        note: "",
        includeInCoachReport: false,
      },
    ),
  ).rejects.toThrow("計測中");
});
it("catalog has all 1211 USB titles and 73 current information lessons, with unique stable keys", () => {
  expect(
    catalog
      .filter((c) => c.source.startsWith("USB"))
      .reduce((n, c) => n + c.lessons.length, 0),
  ).toBe(1211);
  expect(catalog.find((c) => c.id === "information")?.lessons).toHaveLength(73);
  const d = createTemplates(catalog.map((_, i) => i));
  expect(d.studyItems.every((i) => !!i.catalogKey && !!i.sourcePath)).toBe(
    true,
  );
  expect(new Set(d.studyItems.map((i) => i.catalogKey)).size).toBe(
    d.studyItems.length,
  );
  expect(d.studyItems.some((i) => /^問題\d+$/.test(i.title))).toBe(false);
  expect(
    backupSchema.safeParse({ schemaVersion: 3, exportedAt: stamp, data: d })
      .success,
  ).toBe(true);
});
it("imports titles without guessing legacy numbers, and explicitly maps a record without changing its id", async () => {
  const d = fixture();
  d.courses[0].name = "特別応用講座【数学】";
  const a = math();
  withSession(d, a, "mathematics");
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  await addCatalog("special_math", "mathematics");
  expect((await db.studyItems.get("i-mathematics"))?.title).toBe("問題53");
  expect(await addCatalog("special_math", "mathematics")).toBe(0);
  const lesson = catalog[0].lessons[0];
  await assignLesson("i-mathematics", "special_math", lesson.key);
  const mapped = await db.studyItems.get("i-mathematics");
  expect(mapped).toMatchObject({
    id: "i-mathematics",
    title: "例題1",
    studyMode: "reproduction",
    catalogKey: lesson.key,
  });
  expect(await db.attempts.get(a.id)).toEqual(a);
  expect(
    await db.studyItems
      .where("courseId")
      .equals("mathematics")
      .filter((i) => !i.archived)
      .count(),
  ).toBe(143);
  expect(backupSchema.safeParse(await makeBackup()).success).toBe(true);
  const snapshots = (await db.settings.toArray()).filter((s) =>
    s.key.startsWith("before-catalog:"),
  );
  expect(snapshots.length).toBeGreaterThan(0);
  expect(snapshots.every((s) => backupSchema.safeParse(s.value).success)).toBe(
    true,
  );
});

it.each(modes)(
  "keeps %s result fields and timing through edit and backup roundtrip",
  async (mode) => {
    const d = fixture();
    const item = { ...d.studyItems[0], studyMode: mode };
    d.studyItems[0] = item;
    await importBackup(
      { schemaVersion: 2, exportedAt: stamp, data: d },
      "replace",
    );
    const sid = await startStudy(item);
    await stopStudy(sid);
    await finishStudy(newAttempt(item, sid));
    const original = {
      attempt: await db.attempts.get(sid),
      session: await db.studySessions.get(sid),
    };
    await editRecord(original, {
      attempt: original.attempt,
      startedAt: stamp,
      durationSeconds: 754,
      note: "訂正",
      includeInCoachReport: true,
    });
    const backup = await makeBackup();
    expect(backup.data.attempts[0]).toMatchObject({
      id: sid,
      mode,
      durationSeconds: 754,
      notes: "訂正",
    });
    expect(backupSchema.safeParse(backup).success).toBe(true);
    await importBackup(backup, "replace");
    expect((await db.attempts.get(sid))?.durationSeconds).toBe(754);
  },
);
it("rolls back both time and result when an edited exam score is invalid", async () => {
  const d = fixture();
  d.studyItems[0].studyMode = "past_exam";
  await importBackup(
    { schemaVersion: 2, exportedAt: stamp, data: d },
    "replace",
  );
  const sid = await startStudy(d.studyItems[0]);
  await stopStudy(sid);
  await finishStudy(newAttempt(d.studyItems[0], sid));
  const original = {
    attempt: await db.attempts.get(sid),
    session: await db.studySessions.get(sid),
  };
  if (original.attempt?.mode !== "past_exam") throw new Error("fixture");
  await expect(
    editRecord(original, {
      attempt: { ...original.attempt, score: 101, maxScore: 100 },
      startedAt: stamp,
      durationSeconds: 754,
      note: "invalid",
      includeInCoachReport: false,
    }),
  ).rejects.toThrow("満点");
  expect(await db.studySessions.get(sid)).toEqual(original.session);
  expect(await db.attempts.get(sid)).toEqual(original.attempt);
});
