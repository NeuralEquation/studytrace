import { db } from "../../db/database";
import { attemptSchema, sessionSchema } from "../../types/model";
import type {
  AppData,
  Attempt,
  StudySession,
  StudyItem,
} from "../../types/model";
import { now } from "../../utils/time";

export async function addManualRecord(
  item: StudyItem,
  attempt: Attempt,
  startedAt: string,
  durationSeconds: number,
  note: string,
  includeInCoachReport: boolean,
) {
  const endedAt = new Date(
    new Date(startedAt).getTime() + durationSeconds * 1000,
  ).toISOString();
  const parsed = attemptSchema.parse({
    ...attempt,
    itemId: item.id,
    mode: item.studyMode,
    sessionId: attempt.id,
    createdAt: endedAt,
    durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
    notes: note,
    includeInCoachReport,
  });
  if (
    parsed.mode === "past_exam" &&
    (parsed.score > parsed.maxScore ||
      parsed.sections.some((s) => s.score > s.maxScore))
  )
    throw new Error("得点が満点を超えています");
  const session = sessionSchema.parse({
    id: parsed.id,
    itemId: item.id,
    courseId: item.courseId,
    mode: item.studyMode,
    startedAt,
    endedAt,
    durationSeconds,
    source: "manual",
    note,
    includeInCoachReport,
  });
  await db.transaction(
    "rw",
    [db.studyItems, db.units, db.courses, db.studySessions, db.attempts],
    async () => {
      const current = await db.studyItems.get(item.id);
      const unit = current && (await db.units.get(current.unitId));
      const course = current && (await db.courses.get(current.courseId));
      if (
        !current ||
        current.archived ||
        !unit ||
        unit.archived ||
        !course ||
        course.archived ||
        current.studyMode !== item.studyMode ||
        current.courseId !== item.courseId
      )
        throw new Error("授業が変更されています。選び直してください。");
      // Atomic and idempotent for repeated submissions from the same form.
      if (await db.attempts.get(parsed.id)) return;
      await db.studySessions.add(session);
      await db.attempts.add(parsed);
    },
  );
}

export function activeData(data: AppData): AppData {
  const removed = new Set(
    data.studySessions.filter((s) => s.deletedAt).map((s) => s.id),
  );
  const attempts = data.attempts.filter(
    (a) => !a.deletedAt && !removed.has(a.sessionId ?? ""),
  );
  const excluded = new Set(
    data.attempts.filter((a) => !attempts.includes(a)).map((a) => a.id),
  );
  return {
    ...data,
    attempts,
    studySessions: data.studySessions.filter((s) => !s.deletedAt),
    bottlenecks: data.bottlenecks.filter(
      (b) => !excluded.has(b.attemptId) && !removed.has(b.attemptId),
    ),
  };
}
export async function editRecord(
  original: { attempt?: Attempt; session?: StudySession },
  edit: {
    attempt?: Attempt;
    startedAt: string;
    durationSeconds: number;
    note: string;
    includeInCoachReport: boolean;
  },
) {
  await db.transaction(
    "rw",
    [db.attempts, db.studySessions, db.settings],
    async () => {
      const a =
        original.attempt && (await db.attempts.get(original.attempt.id));
      const s =
        original.session && (await db.studySessions.get(original.session.id));
      if (
        (original.attempt &&
          JSON.stringify(a) !== JSON.stringify(original.attempt)) ||
        (original.session &&
          JSON.stringify(s) !== JSON.stringify(original.session))
      )
        throw new Error(
          "別の画面で記録が変更されています。編集を閉じて開き直してください。",
        );
      if (a?.deletedAt || s?.deletedAt || (s && !s.endedAt))
        throw new Error("計測中または削除済みの記録は編集できません。");
      const endedAt = new Date(
        new Date(edit.startedAt).getTime() + edit.durationSeconds * 1000,
      ).toISOString();
      const updatedAt = now();
      if (s)
        await db.studySessions.put(
          sessionSchema.parse({
            ...s,
            startedAt: edit.startedAt,
            endedAt,
            durationSeconds: edit.durationSeconds,
            note: edit.note,
            includeInCoachReport: edit.includeInCoachReport,
            updatedAt,
          }),
        );
      if (a && edit.attempt) {
        const parsed = attemptSchema.parse({
          ...edit.attempt,
          id: a.id,
          itemId: a.itemId,
          sessionId: a.sessionId,
          mode: a.mode,
          createdAt: endedAt,
          durationSeconds:
            edit.durationSeconds > 0 ? edit.durationSeconds : undefined,
          notes: edit.note,
          includeInCoachReport: edit.includeInCoachReport,
          updatedAt,
        });
        if (
          parsed.mode === "past_exam" &&
          (parsed.score > parsed.maxScore ||
            parsed.sections.some((x) => x.score > x.maxScore))
        )
          throw new Error("得点が満点を超えています");
        await db.attempts.put(parsed);
        if (s && (await db.settings.get("runner:" + s.id)))
          await db.settings.put({ key: "runner:" + s.id, value: parsed });
      }
    },
  );
}
export async function setRecordDeleted(
  attemptId: string | undefined,
  sessionId: string | undefined,
  deleted: boolean,
) {
  await db.transaction("rw", [db.attempts, db.studySessions], async () => {
    const a = attemptId ? await db.attempts.get(attemptId) : undefined;
    const sid = a?.sessionId ?? sessionId;
    const s = sid ? await db.studySessions.get(sid) : undefined;
    if (!a && !s) throw new Error("記録がありません");
    if (s && !s.endedAt)
      throw new Error("計測中です。終了してから削除してください。");
    const patch = { deletedAt: deleted ? now() : undefined, updatedAt: now() };
    if (s) {
      await db.studySessions.update(s.id, patch);
      for (const linked of await db.attempts
        .where("sessionId")
        .equals(s.id)
        .toArray())
        await db.attempts.update(linked.id, patch);
    }
    if (a) await db.attempts.update(a.id, patch);
  });
}
