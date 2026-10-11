import type { ModeAttempt } from "../../types/model";
export function formatAccuracy(accuracy: number) {
  const rounded = Number(accuracy.toFixed(2));
  if (accuracy < 100 && rounded === 100) return "100%未満";
  if (accuracy > 0 && rounded === 0) return "0.01%未満";
  return `${rounded}%`;
}

export function countedAccuracy(correct: number, total: number) {
  if (
    !Number.isSafeInteger(correct) ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    correct < 0 ||
    correct > total
  )
    return;
  return {
    accuracy: (correct / total) * 100,
    result:
      correct === total
        ? ("correct" as const)
        : correct === 0
          ? ("incorrect" as const)
          : ("partial" as const),
  };
}
export function validateCountedAccuracy(value: ModeAttempt<"speed">) {
  if (value.correctCount === undefined && value.totalCount === undefined)
    return;
  const computed = countedAccuracy(value.correctCount!, value.totalCount!);
  if (
    !computed ||
    Math.abs(computed.accuracy - value.accuracy) > 1e-9 ||
    computed.result !== value.result
  )
    throw new Error(
      "正解数は総問題数以下の整数、総問題数は1以上の整数にしてください。正答率は問題数から計算します。",
    );
}
