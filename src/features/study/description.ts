import type { Attempt } from "../../types/model";
import { resultNames } from "../../types/model";
import { recallScore } from "../../domain/study";
export function attemptDescription(a: Attempt): string {
  switch (a.mode) {
    case "reproduction":
      return `${resultNames[a.result]} / 再現度 ${a.reproducibility}`;
    case "speed":
      return `${a.result === "correct" ? "正解" : a.result === "partial" ? "部分正解" : "不正解"} / 正確性 ${a.accuracy}%`;
    case "deep_recall":
      return `白紙再現 ${recallScore(a.checks).overallRecall}%`;
    case "video":
      return `視聴 ${a.completion}% / 理解度 ${a.understanding}`;
    case "past_exam":
      return `${a.university} ${a.year} / ${a.score}/${a.maxScore} / ${a.reviewCompleted ? "復習済み" : "未復習"}`;
    case "reading":
      return `${a.section} / 進捗 ${a.progress}%`;
    case "memorization":
      return `${a.range} / 完了 ${a.completion}%`;
    case "practice":
      return `${a.result} / 完了 ${a.completion}%`;
  }
}
