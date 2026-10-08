import type { AppData } from "../../types/model";
import { db, readData } from "../../db/database";

export function unitDeletionInfo(data: AppData, unitId: string) {
  const items = data.studyItems.filter((i) => i.unitId === unitId);
  const ids = new Set(items.map((i) => i.id));
  const hasRecords =
    items.some((i) => i.initialStatus !== "UNSEEN") ||
    data.attempts.some((a) => ids.has(a.itemId)) ||
    data.studySessions.some((s) => s.itemId && ids.has(s.itemId));
  const hasLinks =
    data.sprintGoals.some((g) => g.itemId && ids.has(g.itemId)) ||
    data.coachQuestions.some(
      (q) => q.relatedItemId && ids.has(q.relatedItemId),
    ) ||
    data.studyItems.some(
      (i) => !ids.has(i.id) && i.relatedItemId && ids.has(i.relatedItemId),
    );
  return {
    itemCount: items.length,
    hasRecords,
    hasLinks,
    canDelete: !hasRecords && !hasLinks,
  };
}

// Check inside the same write transaction: a timer starting in another tab must
// not leave an orphaned session if the unit is removed at the same moment.
export async function deleteUnusedUnit(unitId: string) {
  await db.transaction("rw", db.tables, async () => {
    const data = await readData();
    if (!data.units.some((u) => u.id === unitId))
      throw new Error("単元が見つかりません");
    const info = unitDeletionInfo(data, unitId);
    if (!info.canDelete)
      throw new Error(
        "学習記録や関連付けがあります。記録を残す「非表示」を利用してください。",
      );
    await db.studyItems.bulkDelete(
      data.studyItems.filter((i) => i.unitId === unitId).map((i) => i.id),
    );
    await db.units.delete(unitId);
  });
}
