import type {
  AppData,
  Attempt,
  ModeAttempt,
  StudyMode,
  Subject,
} from "../types/model";
import { emptyData } from "../types/model";
export const stamp = "2026-10-07T03:00:00.000Z";
export function fixture(): AppData {
  const data = emptyData();
  const ss: Subject[] = [
    "mathematics",
    "chemistry",
    "physics",
    "english",
    "information",
    "japanese",
    "civics",
  ];
  const modes: StudyMode[] = [
    "reproduction",
    "speed",
    "deep_recall",
    "video",
    "video",
    "memorization",
    "reading",
  ];
  ss.forEach((subject, i) => {
    data.courses.push({
      id: subject,
      name: subject,
      subject,
      defaultMode: modes[i],
      createdAt: stamp,
      archived: false,
    });
    data.units.push({
      id: "u-" + subject,
      courseId: subject,
      name: "単元",
      order: 0,
      archived: false,
    });
    data.studyItems.push({
      id: "i-" + subject,
      courseId: subject,
      unitId: "u-" + subject,
      title: "問題53",
      number: 53,
      type: "problem",
      studyMode: modes[i],
      order: 0,
      initialStatus: "UNSEEN",
      archived: false,
    });
  });
  return data;
}
export function math(
  extra: Partial<ModeAttempt<"reproduction">> = {},
): ModeAttempt<"reproduction"> {
  return {
    id: "a",
    itemId: "i-mathematics",
    createdAt: stamp,
    mode: "reproduction",
    result: "perfect",
    reproducibility: 5,
    notes: "",
    includeInCoachReport: false,
    durationSeconds: 600,
    ...extra,
  };
}
export function speed(
  extra: Partial<ModeAttempt<"speed">> = {},
): ModeAttempt<"speed"> {
  return {
    id: "a",
    itemId: "i-chemistry",
    createdAt: stamp,
    mode: "speed",
    result: "correct",
    accuracy: 100,
    notes: "",
    includeInCoachReport: false,
    durationSeconds: 600,
    ...extra,
  };
}
export function withSession(
  data: AppData,
  a: Attempt,
  courseId: string,
  source: "timer" | "manual" = "timer",
) {
  a.sessionId = "s-" + a.id;
  data.attempts.push(a);
  data.studySessions.push({
    id: a.sessionId,
    courseId,
    itemId: a.itemId,
    mode: a.mode,
    startedAt: a.createdAt,
    endedAt: new Date(
      new Date(a.createdAt).getTime() + (a.durationSeconds ?? 0) * 1000,
    ).toISOString(),
    durationSeconds: a.durationSeconds ?? 0,
    source,
    includeInCoachReport: false,
  });
}
