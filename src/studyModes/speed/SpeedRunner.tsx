import type { ModeProps } from "../shared";
import { Field } from "../../components/ui";
import { useState } from "react";
import { countedAccuracy, formatAccuracy } from "./accuracy";
export function SpeedRunner({ value, onChange }: ModeProps<"speed">) {
  const [counts, setCounts] = useState(
    value.totalCount !== undefined ||
      (value.accuracy === 0 && value.result === "incorrect"),
  );
  const correct = value.correctCount ?? 0;
  const total = value.totalCount ?? 1;
  const computed =
    value.correctCount === undefined && value.totalCount === undefined
      ? countedAccuracy(correct, total)
      : countedAccuracy(value.correctCount!, value.totalCount!);
  function change(
    correctCount: number | undefined,
    totalCount: number | undefined,
  ) {
    const computed = countedAccuracy(correctCount!, totalCount!);
    onChange({ ...value, correctCount, totalCount, ...(computed ?? {}) });
  }
  return (
    <>
      <h2>正確さと、解答速度</h2>
      <div className="actions" aria-label="正答率の入力方法">
        <button
          type="button"
          className={counts ? "" : "secondary"}
          aria-pressed={counts}
          onClick={() => {
            setCounts(true);
            if (
              value.correctCount === undefined &&
              value.totalCount === undefined
            )
              change(0, 1);
          }}
        >
          正解数で入力
        </button>
        <button
          type="button"
          className={counts ? "secondary" : ""}
          aria-pressed={!counts}
          onClick={() => {
            setCounts(false);
            onChange({
              ...value,
              correctCount: undefined,
              totalCount: undefined,
            });
          }}
        >
          ％で入力
        </button>
      </div>
      {counts ? (
        <>
          <div className="correct-count-input">
            <Field label="正解数">
              <input
                aria-label="正解数"
                type="number"
                inputMode="numeric"
                min={0}
                max={total}
                step={1}
                required
                value={
                  value.correctCount === undefined &&
                  value.totalCount !== undefined
                    ? ""
                    : correct
                }
                onChange={(e) =>
                  change(
                    e.target.value === "" ? undefined : +e.target.value,
                    total,
                  )
                }
              />
            </Field>
            <span aria-hidden="true">/</span>
            <Field label="総問題数">
              <input
                aria-label="総問題数"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={
                  value.totalCount === undefined &&
                  value.correctCount !== undefined
                    ? ""
                    : total
                }
                onChange={(e) =>
                  change(
                    correct,
                    e.target.value === "" ? undefined : +e.target.value,
                  )
                }
              />
            </Field>
          </div>
          <p role="status">
            正答率：
            {computed
              ? formatAccuracy(value.accuracy)
              : "問題数を確認してください"}{" "}
            ·{" "}
            {value.result === "correct"
              ? "正解"
              : value.result === "partial"
                ? "部分正解"
                : "不正解"}
          </p>
        </>
      ) : (
        <>
          <Field label="結果">
            <select
              value={value.result}
              onChange={(e) =>
                onChange({
                  ...value,
                  result: e.target.value as typeof value.result,
                  accuracy: e.target.value === "correct" ? 100 : value.accuracy,
                })
              }
            >
              <option value="incorrect">不正解</option>
              <option value="partial">部分正解</option>
              <option value="correct">正解</option>
            </select>
          </Field>
          <Field label="正確性（%）">
            <input
              type="number"
              required
              min={0}
              max={100}
              step="any"
              value={value.accuracy}
              onChange={(e) =>
                onChange({ ...value, accuracy: +e.target.value })
              }
            />
          </Field>
        </>
      )}
      <p className="muted">
        最速記録は、正解かつ正確性100%の解答だけを比較します。
      </p>
    </>
  );
}
