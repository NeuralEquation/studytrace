import { Score, Completion } from "../shared";
import type { ModeProps } from "../shared";
import { Field } from "../../components/ui";
export function VideoRunner({ value, onChange }: ModeProps<"video">) {
  return (
    <>
      <h2>映像から、理解へ。</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={value.watched}
          onChange={(e) =>
            onChange({
              ...value,
              watched: e.target.checked,
              completion: e.target.checked ? 100 : value.completion,
            })
          }
        />
        視聴済み
      </label>
      <Completion
        value={value.completion}
        onChange={(n) =>
          onChange({ ...value, completion: n, watched: n === 100 })
        }
      />
      <Score
        label="理解度"
        value={value.understanding}
        onChange={(n) => onChange({ ...value, understanding: n })}
      />
      <Field label="講師への質問">
        <textarea
          value={value.question}
          onChange={(e) => onChange({ ...value, question: e.target.value })}
        />
      </Field>
    </>
  );
}
