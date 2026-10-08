import type { ModeProps } from "../shared";
import { recallLabels } from "../../types/model";
import { recallScore } from "../../domain/study";
import { Progress } from "../../components/ui";
export function DeepRecallRunner({
  value,
  onChange,
}: ModeProps<"deep_recall">) {
  const score = recallScore(value.checks);
  return (
    <>
      <span className="eyebrow">WHITEBOARD RECALL CHECK</span>
      <h2>状況から解法まで、自分の言葉で。</h2>
      {["状況・問題設定", "法則・解法の説明"].map((name, g) => (
        <fieldset key={name}>
          <legend>{name}</legend>
          {recallLabels.slice(g * 4, g * 4 + 4).map((label, i) => (
            <label className="recall-check" key={label}>
              <input
                type="checkbox"
                checked={value.checks[g * 4 + i]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    checks: value.checks.map((v, j) =>
                      j === g * 4 + i ? e.target.checked : v,
                    ),
                  })
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="recall-summary">
        設定 {score.setupRecall}% · 説明 {score.reasoningRecall}% · 最後まで{" "}
        {score.solutionRecall}%<Progress value={score.overallRecall} />
        <strong>総合Recall {score.overallRecall}%</strong>
      </div>
    </>
  );
}
