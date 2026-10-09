import { subjectNames, resultNames, bottleneckNames } from "../../types/model";
import type { AppData, Attempt, ModeAttempt, Subject } from "../../types/model";
import {
  attemptsInPeriod,
  attemptsAsOf,
  chronological,
  courseProgress,
  mathStatus,
  personalBest,
  recallScore,
  studyTimes,
} from "../study";
import { dateRange, clock, humanTime, localDate } from "../../utils/time";
import { compressItemNumbers } from "./compressItemNumbers";
import { selectNotableAttempts } from "./selectNotableAttempts";
import { reportedStudyTimes } from "../../features/study/dailyTime";
export function formatMathWeeklyReport(
  attempts: ModeAttempt<"reproduction">[],
  data: AppData,
  end: string,
) {
  const latest = [
    ...new Map(
      [...attempts].sort(chronological).map((a) => [a.itemId, a]),
    ).values(),
  ];
  const counts = Object.entries(resultNames).map(
    ([key, name]) =>
      `${name}：${latest.filter((a) => a.result === key).length}題`,
  );
  const reproduced = latest.filter((a) => {
    const item = data.studyItems.find((i) => i.id === a.itemId);
    return (
      item &&
      ["REPRODUCIBLE", "STABLE"].includes(
        mathStatus(item, attemptsAsOf(data, end)),
      )
    );
  }).length;
  return [
    ...counts,
    `再現可能：${reproduced}/${latest.length}題`,
    `安定：${
      latest.filter((a) => {
        const item = data.studyItems.find((i) => i.id === a.itemId);
        return item && mathStatus(item, attemptsAsOf(data, end)) === "STABLE";
      }).length
    }題`,
    `演習回数：${attempts.length}回（結果別件数は各問題の期間内最終結果）`,
  ];
}
export function formatChemistryWeeklyReport(
  attempts: ModeAttempt<"speed">[],
  data: AppData,
) {
  const timed = attempts.filter((a) => a.durationSeconds !== undefined);
  const pb = attempts.filter((a) => {
    const result = personalBest(data.attempts, a);
    return result.isNewBest && result.best !== undefined;
  });
  const initial = attempts.filter((a) => {
    const result = personalBest(data.attempts, a);
    return result.isNewBest && result.best === undefined;
  }).length;
  const improvements = attempts.flatMap((a) => {
    const prior = data.attempts
      .filter(
        (p): p is ModeAttempt<"speed"> =>
          p.mode === "speed" &&
          p.itemId === a.itemId &&
          p.id !== a.id &&
          chronological(p, a) < 0 &&
          p.result === "correct" &&
          p.accuracy === 100,
      )
      .sort(chronological)
      .at(-1);
    return a.result === "correct" &&
      a.accuracy === 100 &&
      prior?.durationSeconds &&
      a.durationSeconds !== undefined
      ? [prior.durationSeconds - a.durationSeconds]
      : [];
  });
  return [
    `正答：${attempts.filter((a) => a.result === "correct" && a.accuracy === 100).length}/${attempts.length}回`,
    `平均解答時間：${timed.length ? clock(timed.reduce((n, a) => n + a.durationSeconds!, 0) / timed.length) : "未計測"}`,
    `最速更新：${pb.length}回 / ${new Set(pb.map((a) => a.itemId)).size}題（初回記録 ${initial}題は別集計）`,
    ...(improvements.length
      ? [
          `前回正答から平均 ${Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length)}秒短縮（負値は増加）`,
        ]
      : []),
  ];
}
export function formatPhysicsWeeklyReport(
  attempts: ModeAttempt<"deep_recall">[],
) {
  const latest = [
    ...new Map(
      [...attempts].sort(chronological).map((a) => [a.itemId, a]),
    ).values(),
  ];
  const avg = (key: "setupRecall" | "reasoningRecall" | "overallRecall") =>
    Math.round(
      attempts.reduce((n, a) => n + recallScore(a.checks)[key], 0) /
        attempts.length,
    );
  return [
    `白紙再現できた：${latest.filter((a) => a.checks.every(Boolean)).length}/${latest.length}題`,
    `平均Recall：${avg("overallRecall")}%（設定 ${avg("setupRecall")}% / 説明 ${avg("reasoningRecall")}%）`,
    `弱い領域：${avg("setupRecall") < avg("reasoningRecall") ? "状況・系の設定" : avg("setupRecall") > avg("reasoningRecall") ? "法則と解法の説明" : "設定・説明は同程度"}`,
  ];
}
export function formatVideoWeeklyReport(
  attempts: ModeAttempt<"video">[],
  data: AppData,
  end: string,
) {
  const completed = new Set(
    attempts
      .filter((a) => a.watched && a.completion === 100)
      .map((a) => a.itemId),
  );
  const lines = [
    `映像完了：${completed.size}本`,
    `視聴時間：${humanTime(attempts.reduce((n, a) => n + (a.durationSeconds ?? 0), 0))}`,
  ];
  const courses = new Set(
    attempts.map(
      (a) => data.studyItems.find((i) => i.id === a.itemId)?.courseId,
    ),
  );
  for (const id of courses) {
    const course = data.courses.find((c) => c.id === id);
    if (course) {
      const p = courseProgress(
        data.studyItems.filter(
          (i) => i.courseId === id && i.studyMode === "video",
        ),
        attemptsAsOf(data, end),
      );
      lines.push(
        `${course.name}：${p.completed}/${p.total}講（登録講義・期間末時点）`,
      );
    }
  }
  return lines;
}
export function formatInformationWeeklyReport(attempts: Attempt[]) {
  return [
    `関連演習：${new Set(attempts.filter((a) => a.mode === "practice" && a.completion === 100).map((a) => a.itemId)).size}題完了`,
  ];
}
export function formatDailyStudyTimes(
  data: AppData,
  start: string,
  end: string,
  daily: boolean,
) {
  const times = reportedStudyTimes(data, start, end);
  const days = dateRange(start, end);
  return [
    "【勉強時間】",
    ...(times.manual.length
      ? ["日別の手入力合計を優先（個別の記録時間との重複加算なし）"]
      : []),
    ...(daily
      ? days.map(
          (d) =>
            `${d.slice(5).replace("-", "/")}　${humanTime(times.byDay[d] ?? 0)}`,
        )
      : []),
    `期間合計：${humanTime(times.total)}`,
    `1日平均：${humanTime(times.total / Math.max(1, days.length))}（${days.length}日間）`,
  ];
}
export type ReportOptions = {
  start: string;
  end: string;
  detail: "compact" | "detailed";
  daily: boolean;
};
export function buildWeeklyProgressReport(
  data: AppData,
  options: ReportOptions,
) {
  const { start, end, detail, daily } = options;
  const attempts = attemptsInPeriod(data, start, end);
  const times = studyTimes(data.studySessions, start, end);
  const periodSessions = data.studySessions.filter(
    (s) => localDate(s.startedAt) >= start && localDate(s.startedAt) <= end,
  );
  const warnings: string[] = [];
  const unfinished = periodSessions.filter((s) => !s.endedAt).length;
  if (unfinished)
    warnings.push(`終了していないSession ${unfinished}件（時間集計から除外）`);
  const noAttempt = periodSessions.filter(
    (s) =>
      s.endedAt &&
      s.source === "timer" &&
      !data.attempts.some((a) => a.sessionId === s.id),
  ).length;
  if (noAttempt) warnings.push(`結果が未保存のSession ${noAttempt}件`);
  if (attempts.some((a) => !data.studyItems.some((i) => i.id === a.itemId)))
    warnings.push("教材が見つからないAttemptがあります");
  const lines = [
    `${start.replaceAll("-", "/")}〜${end.replaceAll("-", "/")} 進捗報告`,
  ];
  const summary: { subject: Subject; count: number; seconds: number }[] = [];
  for (const subject of Object.keys(subjectNames) as Subject[]) {
    const courses = data.courses.filter((c) => c.subject === subject);
    const ids = new Set(courses.map((c) => c.id));
    const items = data.studyItems.filter((i) => ids.has(i.courseId));
    const itemIds = new Set(items.map((i) => i.id));
    const aa = attempts.filter((a) => itemIds.has(a.itemId));
    const ss = periodSessions.filter((s) => ids.has(s.courseId));
    if (!aa.length && !ss.length) continue;
    const seconds = courses.reduce(
      (n, c) => n + (times.byCourse[c.id] ?? 0),
      0,
    );
    summary.push({
      subject,
      count: new Set(aa.map((a) => a.itemId)).size,
      seconds,
    });
    lines.push("", `【${subjectNames[subject]}】`);
    if (["japanese", "civics"].includes(subject)) {
      for (const c of courses) {
        const cs = ss.filter((s) => s.courseId === c.id);
        if (cs.length) {
          lines.push(
            `${c.name}：${new Set(cs.map((s) => localDate(s.startedAt))).size}日`,
          );
          const last = aa
            .filter(
              (a) => items.find((i) => i.id === a.itemId)?.courseId === c.id,
            )
            .sort(chronological)
            .at(-1);
          if (last?.mode === "memorization")
            lines.push(`範囲：${last.range} / 完了 ${last.completion}%`);
          if (last?.mode === "reading")
            lines.push(`節：${last.section} / 進捗 ${last.progress}%`);
        }
      }
    } else {
      for (const c of courses) {
        for (const u of data.units.filter((u) => u.courseId === c.id)) {
          const studied = items.filter(
            (i) => i.unitId === u.id && aa.some((a) => a.itemId === i.id),
          );
          if (studied.length)
            lines.push(
              `${c.name} / ${u.name}：${compressItemNumbers(studied.flatMap((i) => (i.number === undefined ? [] : [i.number])))}${
                studied.some((i) => i.number === undefined)
                  ? " " +
                    studied
                      .filter((i) => i.number === undefined)
                      .map((i) => i.title)
                      .slice(0, detail === "compact" ? 3 : 50)
                      .join("、")
                  : ""
              }　計${studied.length}項目`,
            );
        }
      }
    }
    lines.push(`合計 ${humanTime(seconds)}`);
    const math = aa.filter(
      (a): a is ModeAttempt<"reproduction"> => a.mode === "reproduction",
    );
    if (math.length) lines.push(...formatMathWeeklyReport(math, data, end));
    const chem = aa.filter(
      (a): a is ModeAttempt<"speed"> => a.mode === "speed",
    );
    if (chem.length) lines.push(...formatChemistryWeeklyReport(chem, data));
    const physics = aa.filter(
      (a): a is ModeAttempt<"deep_recall"> => a.mode === "deep_recall",
    );
    if (physics.length) lines.push(...formatPhysicsWeeklyReport(physics));
    const videos = aa.filter(
      (a): a is ModeAttempt<"video"> => a.mode === "video",
    );
    if (videos.length)
      lines.push(...formatVideoWeeklyReport(videos, data, end));
    if (subject === "information")
      lines.push(...formatInformationWeeklyReport(aa));
    for (const a of aa)
      if (a.mode === "past_exam")
        lines.push(
          `${a.university} ${a.year} ${a.subject}：${a.score}/${a.maxScore}　${a.reviewCompleted ? "復習済み" : "復習未完了"}`,
          ...a.sections.map((s) => `  ${s.name} ${s.score}/${s.maxScore}`),
          ...(a.mistakeReasons ? [`失点理由：${a.mistakeReasons}`] : []),
        );
    const bs = data.bottlenecks.filter((b) =>
      aa.some((a) => a.id === b.attemptId),
    );
    const counts = new Map<string, number>();
    for (const b of bs) {
      const key = b.note?.trim() || bottleneckNames[b.type];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (counts.size)
      lines.push(
        "主な詰まり",
        ...[...counts]
          .sort((a, b) => b[1] - a[1])
          .slice(0, detail === "compact" ? 3 : 10)
          .map(([text, count]) => `・${text}（${count}回）`),
      );
    const notable = selectNotableAttempts(
      aa.filter(
        (a) =>
          a.includeInCoachReport ||
          a.notes ||
          (a.durationSeconds ?? 0) >= 1800 ||
          (a.mode === "reproduction" &&
            (a.reproducibility <= 2 ||
              ["failed", "solution_understood", "hint"].includes(a.result))) ||
          bs.some((b) => b.attemptId === a.id),
      ),
      detail === "compact" ? 2 : 20,
    );
    if (notable.length)
      lines.push(
        "特に",
        ...notable.map((a) => {
          const i = items.find((i) => i.id === a.itemId);
          const u = data.units.find((u) => u.id === i?.unitId);
          return `${a.includeInCoachReport ? "★ " : ""}${u?.name ?? ""} ${i?.title ?? a.itemId}：${a.mode === "reproduction" ? resultNames[a.result] + " / 再現度 " + a.reproducibility : a.mode === "deep_recall" ? "Recall " + recallScore(a.checks).overallRecall + "%" : a.mode === "speed" ? a.result : ""}${a.durationSeconds !== undefined ? "　" + humanTime(a.durationSeconds) : ""}${a.notes ? "\n    " + a.notes : ""}`;
        }),
      );
    for (const s of ss.filter(
      (s) =>
        s.includeInCoachReport &&
        !aa.some((a) => a.sessionId === s.id && a.includeInCoachReport),
    ))
      lines.push(
        `★ 学習記録：${s.note || "相談したい学習"} ${humanTime(s.durationSeconds)}`,
      );
  }
  lines.push("", ...formatDailyStudyTimes(data, start, end, daily));
  const questions = [
    ...new Set([
      ...data.coachQuestions
        .filter((q) => !q.resolved && localDate(q.createdAt) <= end)
        .map((q) => q.text),
      ...attempts.flatMap((a) =>
        a.mode === "video" && a.question ? [a.question] : [],
      ),
    ]),
  ];
  if (questions.length)
    lines.push("", "【次回相談したいこと】", ...questions.map((q) => "・" + q));
  if (!summary.length && !reportedStudyTimes(data, start, end).manual.length)
    lines.push("", "この期間の記録はまだありません。");
  return { text: lines.join("\n"), warnings, summary };
}
