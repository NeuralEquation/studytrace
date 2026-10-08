import type { ModeProps } from "../shared";
import { Field } from "../../components/ui";
export function SpeedRunner({ value, onChange }: ModeProps<"speed">) {
  return (
    <>
      <h2>正確さと、解答速度</h2>
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
          value={value.accuracy}
          onChange={(e) => onChange({ ...value, accuracy: +e.target.value })}
        />
      </Field>
      <p className="muted">
        最速記録は、正解かつ正確性100%の解答だけを比較します。
      </p>
    </>
  );
}
