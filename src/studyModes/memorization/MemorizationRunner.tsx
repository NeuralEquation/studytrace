import { Completion } from "../shared";
import type { ModeProps } from "../shared";
import { Field } from "../../components/ui";
export function MemorizationRunner({
  value,
  onChange,
}: ModeProps<"memorization">) {
  return (
    <>
      <h2>今日も、少しずつ。</h2>
      <Field label="範囲・単語">
        <input
          value={value.range}
          onChange={(e) => onChange({ ...value, range: e.target.value })}
        />
      </Field>
      <Completion
        value={value.completion}
        onChange={(n) => onChange({ ...value, completion: n })}
      />
    </>
  );
}
