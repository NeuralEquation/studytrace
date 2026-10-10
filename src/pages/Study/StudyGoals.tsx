import type { AppData, SprintGoal } from "../../types/model";
import { goalState } from "../../domain/planning";
import { Field } from "../../components/ui";

export function StudyGoals({
  data,
  goals,
  selected,
  date,
  onSelect,
}: {
  data: AppData;
  goals: SprintGoal[];
  selected?: SprintGoal;
  date: string;
  onSelect: (id: string) => void;
}) {
  if (!goals.length) return null;
  return (
    <section className="card study-goals" aria-label="この問題のノルマ">
      <h2>この問題のノルマ</h2>
      <p className="muted">{date} · 保存した記録から集計します。</p>
      <div className="goal-progress-list">
        {goals.map((g) => {
          const p = goalState(g, data, date);
          const period =
            g.kind === "daily_count"
              ? "今日"
              : g.kind === "weekly_count"
                ? g.weeklyPeriod === "calendar"
                  ? "今週"
                  : "Sprint"
                : "Sprint";
          return (
            <div className="goal-progress-row" key={g.id}>
              <strong>{g.title}</strong>
              <span>
                {period} {p.actual} / {p.configured ? p.target : "未設定"}
                {p.max !== undefined && p.max !== p.target ? `〜${p.max}` : ""}
              </span>
              <span className={p.achieved ? "goal-done" : ""}>
                {p.achieved
                  ? "達成"
                  : p.remaining !== undefined
                    ? `あと${p.remaining}`
                    : "目標を設定してください"}
              </span>
            </div>
          );
        })}
      </div>
      <Field label="連続学習の順番">
        <select
          value={selected?.id ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">講座の授業順</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              ノルマ対象順：{g.title}
            </option>
          ))}
        </select>
      </Field>
      {selected && (
        <p className="muted">
          このノルマに含まれる授業・問題だけを、講座をまたいで移動します。
        </p>
      )}
    </section>
  );
}
