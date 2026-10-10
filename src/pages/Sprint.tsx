import { useState } from "react";
import type { AppData, SprintGoal } from "../types/model";
import { sprintSchema } from "../types/model";
import { db } from "../db/database";
import { action } from "../stores/ui";
import { PageHeader, Field, Progress } from "../components/ui";
import { uid, localDate } from "../utils/time";
import { goalState, goalCourses } from "../domain/planning";
import { GoalEditor } from "./GoalEditor";
import { PriorityEditor } from "./PriorityEditor";
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
      <PriorityEditor data={data} />
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
                  target: undefined,
                  scope: { courseIds: [] },
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
                const p = goalState(g, data, localDate());
                return (
                  <article className="card" key={g.id}>
                    <small>
                      {goalCourses(g, data)
                        .map((c) => c.name)
                        .join(" / ")}
                    </small>
                    <h3>{g.title}</h3>
                    <p>
                      {p.actual} / {p.configured ? p.target : "未設定"}{" "}
                      {g.kind === "daily_count"
                        ? "（今日）"
                        : g.kind === "course_progress"
                          ? "（累積完了）"
                          : g.weeklyPeriod === "calendar"
                            ? "（今週・月〜日）"
                            : "（Sprint期間内）"}
                    </p>
                    <Progress value={p.actual} max={p.target} />
                    <p>
                      {!p.configured
                        ? "目標未設定"
                        : p.achieved
                          ? "最低目標達成"
                          : `最低目標まであと${p.remaining}項目`}
                      {p.max !== undefined ? ` · 推奨上限${p.max}項目` : ""}
                    </p>
                    {g.kind === "daily_count" && (
                      <p>
                        平日{" "}
                        {g.weekdays
                          ? `${g.weekdays.min}${g.weekdays.max !== undefined ? "〜" + g.weekdays.max : ""}`
                          : (g.target ?? "未設定")}{" "}
                        / 土日・祝日{" "}
                        {g.weekends
                          ? `${g.weekends.min}${g.weekends.max !== undefined ? "〜" + g.weekends.max : ""}`
                          : (g.target ?? "未設定")}
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
