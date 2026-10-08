import { useState } from "react";
import type { AppData, SprintGoal } from "../types/model";
import { sprintSchema, goalSchema } from "../types/model";
import { db } from "../db/database";
import { action } from "../stores/ui";
import { PageHeader, Field, Progress } from "../components/ui";
import { uid, localDate } from "../utils/time";
import { sprintProgress } from "../domain/study";
export function SprintPage({ data }: { data: AppData }) {
  const [selected, setSelected] = useState(data.sprints.at(-1)?.id ?? "");
  const [goal, setGoal] = useState<SprintGoal | null>(null);
  const sprint = data.sprints.find((s) => s.id === selected);
  return (
    <>
      <PageHeader
        eyebrow="PLAN YOUR WEEK"
        title="Sprint"
        description="量の目標も、理解の目標も。講師の方針に沿って設定しましょう。"
      />
      <div className="toolbar">
        <select
          aria-label="Sprintを選択"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setGoal(null);
          }}
        >
          <option value="">新しいSprint</option>
          {data.sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {s.startDate}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          onClick={() => {
            setSelected("");
            setGoal(null);
          }}
        >
          新規作成
        </button>
      </div>
      <form
        key={selected}
        className="card form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void action(async () => {
            const id = sprint?.id ?? uid();
            await db.sprints.put(
              sprintSchema.parse({
                id,
                title: f.get("title"),
                startDate: f.get("start"),
                endDate: f.get("end"),
                coachSessionId: f.get("coach") || undefined,
              }),
            );
            setSelected(id);
          }, "Sprintを保存しました");
        }}
      >
        <Field label="Sprint名">
          <input
            name="title"
            required
            defaultValue={sprint?.title ?? "今週の学習"}
          />
        </Field>
        <Field label="開始日">
          <input
            name="start"
            type="date"
            required
            defaultValue={sprint?.startDate ?? localDate()}
          />
        </Field>
        <Field label="終了日">
          <input
            name="end"
            type="date"
            required
            defaultValue={sprint?.endDate ?? localDate()}
          />
        </Field>
        <Field label="関連する指導">
          <select name="coach" defaultValue={sprint?.coachSessionId ?? ""}>
            <option value="">なし</option>
            {data.coachSessions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.date} {c.title}
              </option>
            ))}
          </select>
        </Field>
        <button>期間を保存</button>
      </form>
      {sprint && (
        <>
          <div className="section-heading">
            <h2>学習目標</h2>
            <button
              disabled={!data.courses.length}
              onClick={() =>
                setGoal({
                  id: uid(),
                  sprintId: sprint.id,
                  courseId: data.courses[0].id,
                  kind: "daily_count",
                  title: "",
                  target: 2,
                  weekdays: { min: 2, max: 3 },
                  weekends: { min: 5, max: 6 },
                  completed: false,
                })
              }
            >
              目標を追加
            </button>
          </div>
          {goal && (
            <GoalEditor
              key={goal.id}
              value={goal}
              data={data}
              onDone={() => setGoal(null)}
            />
          )}
          <div className="course-grid">
            {data.sprintGoals
              .filter((g) => g.sprintId === sprint.id)
              .map((g) => {
                const p = sprintProgress(
                  g,
                  data,
                  sprint.startDate,
                  sprint.endDate,
                );
                return (
                  <article className="card" key={g.id}>
                    <small>
                      {data.courses.find((c) => c.id === g.courseId)?.name}
                    </small>
                    <h3>{g.title}</h3>
                    <p>
                      {p.actual} / {p.target}{" "}
                      {g.kind === "daily_count"
                        ? "（今日）"
                        : g.kind === "course_progress"
                          ? "（累積完了）"
                          : "（期間内）"}
                    </p>
                    <Progress value={p.actual} max={p.target} />
                    {g.kind === "daily_count" && (
                      <p>
                        平日 {g.weekdays?.min}〜
                        {g.weekdays?.max ?? g.weekdays?.min} / 土日{" "}
                        {g.weekends?.min}〜{g.weekends?.max ?? g.weekends?.min}
                      </p>
                    )}
                    <button className="text-button" onClick={() => setGoal(g)}>
                      目標を編集
                    </button>
                  </article>
                );
              })}
          </div>
        </>
      )}
    </>
  );
}
function GoalEditor({
  value,
  data,
  onDone,
}: {
  value: SprintGoal;
  data: AppData;
  onDone: () => void;
}) {
  const [g, set] = useState(value);
  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void action(async () => {
          await db.sprintGoals.put(goalSchema.parse(g));
          onDone();
        }, "目標を保存しました");
      }}
    >
      <Field label="教材">
        <select
          value={g.courseId}
          onChange={(e) =>
            set({ ...g, courseId: e.target.value, itemId: undefined })
          }
        >
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="目標の内容">
        <input
          required
          value={g.title}
          onChange={(e) => set({ ...g, title: e.target.value })}
        />
      </Field>
      <Field label="目標の種類">
        <select
          value={g.kind}
          onChange={(e) =>
            set({ ...g, kind: e.target.value as SprintGoal["kind"] })
          }
        >
          <option value="daily_count">1日の項目数</option>
          <option value="weekly_count">期間内の項目数</option>
          <option value="course_progress">教材の累積完了数</option>
          <option value="specific_task">具体的なタスク</option>
        </select>
      </Field>
      <Field label="目標数">
        <input
          type="number"
          min={0}
          value={g.target}
          onChange={(e) => set({ ...g, target: +e.target.value })}
        />
      </Field>
      {g.kind === "daily_count" &&
        (["weekdays", "weekends"] as const).map((key) => (
          <div key={key}>
            <Field
              label={
                key === "weekdays" ? "平日 最小 / 最大" : "土日 最小 / 最大"
              }
            >
              <div className="actions">
                <input
                  aria-label={key + "最小"}
                  type="number"
                  min={0}
                  value={g[key]?.min ?? 0}
                  onChange={(e) =>
                    set({ ...g, [key]: { ...g[key], min: +e.target.value } })
                  }
                />
                <input
                  aria-label={key + "最大"}
                  type="number"
                  min={0}
                  value={g[key]?.max ?? ""}
                  onChange={(e) =>
                    set({
                      ...g,
                      [key]: {
                        min: g[key]?.min ?? 0,
                        max: e.target.value ? +e.target.value : undefined,
                      },
                    })
                  }
                />
              </div>
            </Field>
          </div>
        ))}
      {g.kind === "specific_task" && (
        <>
          <Field label="対象項目（任意）">
            <select
              value={g.itemId ?? ""}
              onChange={(e) =>
                set({ ...g, itemId: e.target.value || undefined })
              }
            >
              <option value="">手動で完了にする</option>
              {data.studyItems
                .filter((i) => i.courseId === g.courseId)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={g.completed}
              onChange={(e) => set({ ...g, completed: e.target.checked })}
            />
            タスク完了
          </label>
        </>
      )}
      <div className="actions">
        <button>保存</button>
        <button type="button" className="secondary" onClick={onDone}>
          閉じる
        </button>
      </div>
    </form>
  );
}
