import { afterEach, expect, it, vi } from "vitest";
import { fixture, math, stamp } from "./fixtures";
import { draftSchema } from "../types/model";
import { goalState } from "../domain/planning";
import {
  goalStudyItems,
  itemGoals,
  itemNeighbors,
  studyPath,
} from "../features/study/itemNavigation";
import {
  loadManualDraft,
  storeManualDraft,
} from "../features/study/manualDraft";
import {
  dataSnapshot,
  fingerprint,
  reportSourceSnapshot,
  readBackupMarker,
  writeBackupMarker,
} from "../features/backup/status";

afterEach(() => vi.unstubAllGlobals());
function memoryStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  });
  return map;
}
it("restores unsaved results and time by item without adding a learning record", () => {
  memoryStorage();
  const data = fixture();
  const value = math();
  const draft = {
    revision: "current",
    value,
    date: "2026-10-07",
    time: "23:50:00",
    minutes: 30,
    seconds: 0,
    note: "途中",
    pin: true,
  };
  expect(storeManualDraft("new:i-mathematics", draft)).toBe(true);
  expect(loadManualDraft("new:i-mathematics", "current", value)).toEqual(draft);
  expect(loadManualDraft("new:other", "current", value)).toBeUndefined();
  expect(
    loadManualDraft("new:i-mathematics", "changed-record-or-item", value),
  ).toBeUndefined();
  expect(
    loadManualDraft("new:i-mathematics", "current", {
      ...value,
      itemId: "another",
    }),
  ).toBeUndefined();
  expect(data.attempts).toHaveLength(0);
  expect(data.studySessions).toHaveLength(0);
  storeManualDraft("new:i-mathematics");
  expect(
    loadManualDraft("new:i-mathematics", "current", value),
  ).toBeUndefined();
});
it("does not crash or claim a draft was saved when local storage is unavailable", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => "{broken",
    setItem: () => {
      throw Error("full");
    },
    removeItem: () => {
      throw Error("disabled");
    },
  });
  expect(loadManualDraft("item", "current", math())).toBeUndefined();
  expect(storeManualDraft("item")).toBe(false);
});
function planFixture() {
  const data = fixture();
  data.sprints.push({
    id: "s",
    title: "test",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
  });
  data.sprintGoals.push({
    id: "g",
    sprintId: "s",
    courseId: "mathematics",
    kind: "daily_count",
    title: "combined",
    target: 2,
    scope: { courseIds: [], itemIds: ["i-mathematics", "i-chemistry"] },
    completed: false,
  });
  data.settings.push({
    key: "today-priorities:v1",
    value: { courses: ["mathematics", "chemistry"], subjects: [] },
  });
  return data;
}
it("moves only through selected quota items across courses, keeping the explicit mode", () => {
  const data = planFixture(),
    goal = data.sprintGoals[0],
    first = data.studyItems[0];
  expect(goalStudyItems(data, goal).map((i) => i.id)).toEqual([
    "i-mathematics",
    "i-chemistry",
  ]);
  expect(itemNeighbors(data, first, goal).next?.id).toBe("i-chemistry");
  expect(itemNeighbors(data, first).next).toBeUndefined();
  expect(studyPath(data.studyItems[1], goal.id)).toBe(
    "/study/i-chemistry?goal=g",
  );
  data.courses[1].archived = true;
  expect(goalStudyItems(data, goal).map((i) => i.id)).toEqual([first.id]);
});
it("shows every active matching quota independently and keeps combined targets", () => {
  const data = planFixture(),
    first = data.studyItems[0];
  data.sprintGoals.push({
    ...data.sprintGoals[0],
    id: "weekly",
    kind: "weekly_count",
    target: 4,
  });
  data.attempts.push(math());
  const goals = itemGoals(data, first, "2026-10-07");
  expect(goals.map((g) => g.id)).toEqual(["g", "weekly"]);
  expect(goals.map((g) => goalState(g, data, "2026-10-07").remaining)).toEqual([
    1, 3,
  ]);
  expect(data.sprintGoals[0].scope?.itemIds).toHaveLength(2);
  expect(itemGoals(data, first, "2026-11-01")).toEqual([]);
  expect(
    goalStudyItems(data, {
      ...goals[0],
      kind: "specific_task",
      itemId: first.id,
    }).map((i) => i.id),
  ).toEqual([first.id]);
  expect(
    goalStudyItems(data, { ...goals[0], scope: { courseIds: [] } }),
  ).toEqual([]);
});
it("fingerprints content independently of table and property order and detects edits", async () => {
  const data = fixture();
  const before = await fingerprint(dataSnapshot(data));
  data.courses.reverse();
  data.units.reverse();
  data.settings.push({ key: "example", value: { b: 2, a: 1 } });
  const ordered = dataSnapshot(data);
  data.settings[0].value = { a: 1, b: 2 };
  expect(dataSnapshot(data)).toBe(ordered);
  data.settings = [];
  expect(await fingerprint(dataSnapshot(data))).toBe(before);
  data.studyItems[0].title = "edited";
  expect(await fingerprint(dataSnapshot(data))).not.toBe(before);
});
it("tracks report source changes while ignoring report edits and timer input drafts", async () => {
  const data = fixture();
  const before = await fingerprint(reportSourceSnapshot(data));
  const legacy = {
    id: "report",
    startDate: "2026-10-07",
    endDate: "2026-10-08",
    text: "手で編集した提出文",
    generatedAt: stamp,
    updatedAt: stamp,
    edited: true,
    detail: "compact" as const,
    daily: true,
  };
  expect(draftSchema.parse(legacy).sourceFingerprint).toBeUndefined();
  data.progressReportDrafts.push({ ...legacy, sourceFingerprint: before });
  data.settings.push({ key: "runner:one", value: math() });
  expect(await fingerprint(reportSourceSnapshot(data))).toBe(before);
  data.attempts.push(math());
  expect(await fingerprint(reportSourceSnapshot(data))).not.toBe(before);
  expect(data.progressReportDrafts[0].text).toBe(legacy.text);
  expect(data.progressReportDrafts[0].sourceFingerprint).toBe(before);
  data.attempts = [];
  data.settings.push({
    key: "daily-study-time:2026-10-07",
    value: { seconds: 1200 },
  });
  expect(await fingerprint(reportSourceSnapshot(data))).not.toBe(before);
});
it("remembers JSON export metadata without changing exported study data", async () => {
  const storage = memoryStorage(),
    data = fixture(),
    snapshot = dataSnapshot(data);
  expect(readBackupMarker()).toBeUndefined();
  const marker = {
    exportedAt: stamp,
    fingerprint: await fingerprint(snapshot),
  };
  expect(writeBackupMarker(marker)).toBe(true);
  expect(readBackupMarker()).toEqual(marker);
  expect(dataSnapshot(data)).toBe(snapshot);
  storage.set("studytrace:backup-export:v1", '{"exportedAt":"invalid"}');
  expect(readBackupMarker()).toBeUndefined();
});
