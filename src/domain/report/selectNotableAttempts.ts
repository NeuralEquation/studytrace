import type { Attempt } from "../../types/model";
export function selectNotableAttempts(attempts: Attempt[], limit = 3) {
  const rank = (a: Attempt) =>
    (a.includeInCoachReport ? 1e9 : 0) +
    (a.mode === "reproduction"
      ? (6 - a.reproducibility) * 10000 +
        (["failed", "solution_understood"].includes(a.result) ? 1e5 : 0)
      : 0) +
    (a.durationSeconds ?? 0);
  const pinned = attempts.filter((a) => a.includeInCoachReport);
  const others = attempts
    .filter((a) => !a.includeInCoachReport)
    .sort((a, b) => rank(b) - rank(a));
  return [...pinned, ...others.slice(0, Math.max(0, limit - pinned.length))];
}
