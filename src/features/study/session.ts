import type { Attempt, StudyItem } from "../../types/model";
import { attemptSchema, sessionSchema } from "../../types/model";
import { db } from "../../db/database";
import { now, uid, elapsed } from "../../utils/time";
export function newAttempt(item: StudyItem, id: string): Attempt {
  const base = {
    id,
    itemId: item.id,
    sessionId: id,
    createdAt: now(),
    notes: "",
    includeInCoachReport: false,
  };
  switch (item.studyMode) {
    case "reproduction":
      return {
        ...base,
        mode: "reproduction",
        result: "failed",
        reproducibility: 1,
      };
    case "speed":
      return { ...base, mode: "speed", result: "incorrect", accuracy: 0 };
    case "deep_recall":
      return {
        ...base,
        mode: "deep_recall",
        checks: Array(8).fill(false) as boolean[],
      };
    case "video":
      return {
        ...base,
        mode: "video",
        watched: false,
        completion: 0,
        understanding: 1,
        question: "",
      };
    case "past_exam":
      return {
        ...base,
        mode: "past_exam",
        university: "",
        year: new Date().getFullYear(),
        subject: "",
        score: 0,
        maxScore: 100,
        sections: [],
        mistakeReasons: "",
        reviewCompleted: false,
      };
    case "memorization":
      return { ...base, mode: "memorization", range: "", completion: 0 };
    case "reading":
      return { ...base, mode: "reading", section: "", progress: 0 };
    case "practice":
      return {
        ...base,
        mode: "practice",
        completion: 0,
        result: "partial",
        difficulty: 3,
      };
  }
}
export async function startStudy(item: StudyItem) {
  return db.transaction(
    "rw",
    [db.studySessions, db.settings, db.studyItems, db.units, db.courses],
    async () => {
      const stored = await db.studyItems.get(item.id);
      if (
        !stored ||
        stored.studyMode !== item.studyMode ||
        !(await db.units.get(stored.unitId)) ||
        !(await db.courses.get(stored.courseId))
      )
        throw new Error(
          "学習項目が変更または削除されています。教材一覧から選び直してください。",
        );
      const active = (await db.studySessions.toArray()).find(
        (s) => !s.endedAt && !s.deletedAt,
      );
      if (active) {
        if (active.itemId === item.id) return active.id;
        throw new Error(
          "ほかの学習が進行中です。Todayから再開し、終了してください。",
        );
      }
      const id = uid();
      await db.studySessions.add(
        sessionSchema.parse({
          id,
          courseId: item.courseId,
          itemId: item.id,
          mode: item.studyMode,
          startedAt: now(),
          durationSeconds: 0,
          source: "timer",
        }),
      );
      await db.settings.put({
        key: "runner:" + id,
        value: newAttempt(item, id),
      });
      return id;
    },
  );
}
export async function stopStudy(id: string) {
  await db.transaction("rw", db.studySessions, async () => {
    const s = await db.studySessions.get(id);
    if (!s || s.deletedAt) throw new Error("有効なSessionがありません");
    if (!s.endedAt)
      await db.studySessions.update(id, {
        endedAt: now(),
        durationSeconds: elapsed(s.startedAt),
      });
  });
}
export async function finishStudy(a: Attempt) {
  const parsed = attemptSchema.parse(a);
  if (
    parsed.mode === "past_exam" &&
    (parsed.score > parsed.maxScore ||
      parsed.sections.some((s) => s.score > s.maxScore))
  )
    throw new Error("得点が満点を超えています");
  await db.transaction(
    "rw",
    db.studySessions,
    db.attempts,
    db.settings,
    async () => {
      const s = await db.studySessions.get(parsed.sessionId!);
      if (!s || s.deletedAt) throw new Error("有効なSessionがありません");
      if (
        s.itemId !== parsed.itemId ||
        s.mode !== parsed.mode ||
        s.id !== parsed.id
      )
        throw new Error("演習とSessionの対応が不正です");
      if (await db.attempts.get(parsed.id)) return;
      const durationSeconds = s.endedAt
        ? s.durationSeconds
        : elapsed(s.startedAt);
      const endedAt = s.endedAt ?? now();
      await db.studySessions.update(s.id, {
        endedAt,
        durationSeconds,
        includeInCoachReport: parsed.includeInCoachReport,
        note: parsed.notes,
      });
      await db.attempts.put({ ...parsed, createdAt: endedAt, durationSeconds });
      await db.settings.put({
        key: "runner:" + s.id,
        value: { ...parsed, durationSeconds },
      });
    },
  );
}
