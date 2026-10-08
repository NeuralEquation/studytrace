import type { ModeProps } from "../shared";
import { Field } from "../../components/ui";
export function ExamRunner({ value, onChange }: ModeProps<"past_exam">) {
  return (
    <>
      <h2>過去問の実施・採点・復習</h2>
      <div className="form-grid">
        <Field label="大学">
          <input
            required
            value={value.university}
            onChange={(e) => onChange({ ...value, university: e.target.value })}
          />
        </Field>
        <Field label="年度">
          <input
            type="number"
            required
            min={1900}
            max={2200}
            value={value.year}
            onChange={(e) => onChange({ ...value, year: +e.target.value })}
          />
        </Field>
        <Field label="科目">
          <input
            required
            value={value.subject}
            onChange={(e) => onChange({ ...value, subject: e.target.value })}
          />
        </Field>
        <Field label="得点">
          <input
            type="number"
            required
            min={0}
            max={value.maxScore}
            value={value.score}
            onChange={(e) => onChange({ ...value, score: +e.target.value })}
          />
        </Field>
        <Field label="満点">
          <input
            type="number"
            required
            min={1}
            value={value.maxScore}
            onChange={(e) => onChange({ ...value, maxScore: +e.target.value })}
          />
        </Field>
      </div>
      <fieldset>
        <legend>大問別得点</legend>
        {value.sections.map((s, i) => (
          <div className="section-score" key={i}>
            <input
              aria-label={"大問名" + (i + 1)}
              required
              value={s.name}
              onChange={(e) =>
                onChange({
                  ...value,
                  sections: value.sections.map((v, j) =>
                    j === i ? { ...v, name: e.target.value } : v,
                  ),
                })
              }
            />
            <input
              aria-label={"大問得点" + (i + 1)}
              type="number"
              min={0}
              max={s.maxScore}
              value={s.score}
              onChange={(e) =>
                onChange({
                  ...value,
                  sections: value.sections.map((v, j) =>
                    j === i ? { ...v, score: +e.target.value } : v,
                  ),
                })
              }
            />
            <span>/</span>
            <input
              aria-label={"大問満点" + (i + 1)}
              type="number"
              min={1}
              value={s.maxScore}
              onChange={(e) =>
                onChange({
                  ...value,
                  sections: value.sections.map((v, j) =>
                    j === i ? { ...v, maxScore: +e.target.value } : v,
                  ),
                })
              }
            />
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...value,
              sections: [
                ...value.sections,
                {
                  name: `大問${value.sections.length + 1}`,
                  score: 0,
                  maxScore: 20,
                },
              ],
            })
          }
        >
          大問を追加
        </button>
      </fieldset>
      <Field label="失点理由">
        <textarea
          value={value.mistakeReasons}
          onChange={(e) =>
            onChange({ ...value, mistakeReasons: e.target.value })
          }
        />
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={value.reviewCompleted}
          onChange={(e) =>
            onChange({ ...value, reviewCompleted: e.target.checked })
          }
        />
        復習済み
      </label>
    </>
  );
}
