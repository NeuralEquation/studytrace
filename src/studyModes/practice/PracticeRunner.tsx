import { Completion, Score } from "../shared";
import type { ModeProps } from "../shared";
import { Field } from "../../components/ui";
export function PracticeRunner({ value, onChange }: ModeProps<"practice">) {
  return (
    <>
      <h2>学んだことを、手を動かして確かめる。</h2>
      <Completion
        value={value.completion}
        onChange={(n) => onChange({ ...value, completion: n })}
      />
      <Field label="演習結果">
        <select
          value={value.result}
          onChange={(e) =>
            onChange({
              ...value,
              result: e.target.value as typeof value.result,
            })
          }
        >
          <option value="partial">途中まで</option>
          <option value="completed">完了</option>
          <option value="failed">未達</option>
        </select>
      </Field>
      <Score
        label="難易度（1 易しい → 5 難しい）"
        value={value.difficulty}
        onChange={(n) => onChange({ ...value, difficulty: n })}
      />
    </>
  );
}
