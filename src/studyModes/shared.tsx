import type { ModeAttempt, StudyMode } from "../types/model";
import { Field } from "../components/ui";
export type ModeProps<M extends StudyMode> = {
  value: ModeAttempt<M>;
  onChange: (value: ModeAttempt<M>) => void;
};
export function Score({
  label,
  value,
  onChange,
  descriptions,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  descriptions?: string[];
}) {
  return (
    <fieldset className="score-field">
      <legend>{label}</legend>
      <div className="score-buttons">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            aria-pressed={value === n}
            className={value === n ? "selected" : "secondary"}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      {descriptions && <p>{descriptions[value - 1]}</p>}
    </fieldset>
  );
}
export function Completion({
  value,
  onChange,
  label = "完了率（%）",
}: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  return (
    <Field label={label}>
      <div className="actions">
        <input
          type="number"
          required
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
        />
        <button
          type="button"
          className="secondary"
          onClick={() => onChange(100)}
        >
          完了にする
        </button>
      </div>
    </Field>
  );
}
