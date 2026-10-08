import { Completion } from "../shared";
import type { ModeProps } from "../shared";
import { Field } from "../../components/ui";
export function ReadingRunner({ value, onChange }: ModeProps<"reading">) {
  return (
    <>
      <h2>すきま時間に、読み進める。</h2>
      <Field label="節・ページ範囲">
        <input
          value={value.section}
          onChange={(e) => onChange({ ...value, section: e.target.value })}
        />
      </Field>
      <Completion
        label="進捗（%）"
        value={value.progress}
        onChange={(n) => onChange({ ...value, progress: n })}
      />
    </>
  );
}
