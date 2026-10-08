import type { ModeProps } from "../shared";
import { Score } from "../shared";
import { resultNames } from "../../types/model";
export function ReproductionRunner({
  value,
  onChange,
}: ModeProps<"reproduction">) {
  return (
    <>
      <h2>解法を、白紙から再現できる？</h2>
      <fieldset>
        <legend>今回の結果</legend>
        <div className="result-options">
          {Object.entries(resultNames).map(([key, label]) => (
            <label key={key} className={value.result === key ? "chosen" : ""}>
              <input
                type="radio"
                name="result"
                checked={value.result === key}
                onChange={() =>
                  onChange({ ...value, result: key as typeof value.result })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Score
        label="解法の再現度"
        value={value.reproducibility}
        onChange={(n) => onChange({ ...value, reproducibility: n })}
        descriptions={[
          "まだ再現できない",
          "解説を見ると思い出す",
          "重要部分は再現できる",
          "ほぼ白紙から再現可能",
          "完全に白紙から再現可能",
        ]}
      />
      <p className="muted">
        安定：直近2回が完全独力・再現度5、かつ48時間以上離れていること。
      </p>
    </>
  );
}
