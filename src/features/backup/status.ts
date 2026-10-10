import { useEffect, useState } from "react";
import { z } from "zod";
import type { AppData } from "../../types/model";

// Table read order is not part of the saved contents. Nested array order is.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function dataSnapshot(data: Partial<AppData>): string {
  return JSON.stringify(
    canonical(
      Object.fromEntries(
        Object.entries(data).map(([table, rows]) => [
          table,
          [...rows].sort((a, b) =>
            String("id" in a ? a.id : a.key).localeCompare(
              String("id" in b ? b.id : b.key),
            ),
          ),
        ]),
      ),
    ),
  );
}
export async function fingerprint(snapshot: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(snapshot),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function useFingerprint(snapshot: string) {
  const [result, setResult] = useState({ snapshot: "", hash: "" });
  useEffect(() => {
    let active = true;
    void fingerprint(snapshot)
      .then((hash) => {
        if (active) setResult({ snapshot, hash });
      })
      .catch(() => {
        if (active) setResult({ snapshot, hash: "" });
      });
    return () => {
      active = false;
    };
  }, [snapshot]);
  return result.snapshot === snapshot ? result.hash : "";
}
const markerSchema = z.object({
  exportedAt: z.string().datetime({ offset: true }),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export type BackupMarker = z.infer<typeof markerSchema>;
const markerKey = "studytrace:backup-export:v1";
export function readBackupMarker(): BackupMarker | undefined {
  try {
    const parsed = markerSchema.safeParse(
      JSON.parse(localStorage.getItem(markerKey) ?? "null"),
    );
    if (parsed.success) return parsed.data;
  } catch {
    /* Local metadata is optional. */
  }
}
export function writeBackupMarker(marker: BackupMarker): boolean {
  try {
    localStorage.setItem(markerKey, JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
}
export function reportSourceSnapshot(data: AppData) {
  return dataSnapshot({
    courses: data.courses,
    units: data.units,
    studyItems: data.studyItems,
    studySessions: data.studySessions,
    attempts: data.attempts,
    bottlenecks: data.bottlenecks,
    coachQuestions: data.coachQuestions,
    settings: data.settings.filter((s) =>
      s.key.startsWith("daily-study-time:"),
    ),
  });
}
