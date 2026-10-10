import { useState } from "react";
import type { AppData, SprintGoal } from "../types/model";
import { goalSchema } from "../types/model";
import { db } from "../db/database";
import { action } from "../stores/ui";
import { Field } from "../components/ui";
import { backupSchema } from "../features/backup/backup";
import { readData } from "../db/database";
import { goalItems } from "../domain/study";
import { goalCourses, planPresets, presetChanges } from "../domain/planning";
export function GoalEditor({
  value,
  data,
  onDone,
}: {
  value: SprintGoal;
  data: AppData;
  onDone: () => void;
}) {
  const [g, set] = useState(value);
  const [preset, setPreset] = useState("");
  const scope = g.scope ?? { courseIds: [g.courseId] };
  const toggle = (key: "courseIds" | "unitIds" | "itemIds", id: string) =>
    set({
      ...g,
      scope: {
        ...scope,
        [key]: (scope[key] ?? []).includes(id)
          ? (scope[key] ?? []).filter((x) => x !== id)
          : [...(scope[key] ?? []), id],
      },
    });
  const number = (s: string) => (s === "" ? undefined : Number(s));
  const rangeLabel = (r?: { min: number; max?: number }) =>
    r ? `${r.min}〜${r.max ?? r.min}題` : "未設定";
  const chosen = preset ? presetChanges(preset) : undefined;
  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void action(async () => {
          if (
            g.scope &&
            !g.scope.courseIds.length &&
            !g.scope.unitIds?.length &&
            !g.scope.itemIds?.length
          )
            throw new Error("対象教材・単元・項目を選択してください");
          const courseId = goalCourses(g, data)[0]?.id ?? g.courseId;
          if (
            g.kind !== "specific_task" &&
            g.target === undefined &&
            (g.kind === "daily_count"
              ? !g.weekdays && !g.weekends
              : !g.weeklyRange)
          )
            throw new Error(
              "目標数を入力してください。0題の場合は0を入力します。",
            );
          if (
            g.kind === "weekly_count" &&
            g.weeklyRange?.max !== undefined &&
            g.weeklyRange.max < g.weeklyRange.min
          )
            throw new Error("上限は最低目標以上にしてください");
          const parsed = goalSchema.parse({ ...g, courseId });
          await db.transaction("rw", db.tables, async () => {
            const current = await readData();
            backupSchema.parse({
              schemaVersion: 4,
              exportedAt: new Date().toISOString(),
              data: {
                ...current,
                sprintGoals: [
                  ...current.sprintGoals.filter((x) => x.id !== g.id),
                  parsed,
                ],
              },
            });
            await db.sprintGoals.put(parsed);
          });
          onDone();
        }, "目標を保存しました");
      }}
    >
      <div className="full-width">
        <Field label="学習計画プリセット（任意）">
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="">選んで差分を確認</option>
            {planPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        {chosen && (
          <div className="warning">
            <p>
              保存済み目標にはまだ反映していません。対象教材は変更せず、目標名・種類・数値を次の値へ変更します。
            </p>
            <p>
              {g.title || "名称未設定"} → {chosen.title}
            </p>
            <p>
              目標の種類：
              {g.kind === "daily_count"
                ? "日別ノルマ"
                : g.kind === "weekly_count"
                  ? "週間・期間内"
                  : g.kind === "course_progress"
                    ? "累積完了"
                    : "タスク"}{" "}
              →{" "}
              {chosen.kind === "daily_count" ? "日別ノルマ" : "週間（月〜日）"}
            </p>
            <p>
              平日 {rangeLabel(g.weekdays)} → {rangeLabel(chosen.weekdays)} /
              土日・祝日 {rangeLabel(g.weekends)} →{" "}
              {rangeLabel(chosen.weekends)}
            </p>
            <p>
              期間目標{" "}
              {g.weeklyRange
                ? rangeLabel(g.weeklyRange)
                : (g.target ?? "未設定")}{" "}
              →{" "}
              {chosen.weeklyRange
                ? rangeLabel(chosen.weeklyRange)
                : "日別ノルマ"}
            </p>
            <button
              type="button"
              onClick={() => {
                set({ ...g, ...chosen });
                setPreset("");
              }}
            >
              差分を確認して編集フォームへ適用
            </button>
            <p>適用後も「保存」するまでデータは変更されません。</p>
          </div>
        )}
      </div>
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
          <option value="daily_count">日別ノルマ（同じ日は1項目1回）</option>
          <option value="weekly_count">週間・期間内の項目数</option>
          <option value="course_progress">累積完了数</option>
          <option value="specific_task">具体的なタスク</option>
        </select>
      </Field>
      {g.kind !== "specific_task" && (
        <Field
          label={
            g.kind === "daily_count"
              ? "曜日別ノルマ未設定時の目標（任意）"
              : "目標数（最低）"
          }
        >
          <input
            type="number"
            min="0"
            step="1"
            value={g.target ?? ""}
            placeholder="未設定"
            onChange={(e) =>
              set({
                ...g,
                target: number(e.target.value),
                weeklyRange:
                  g.weeklyRange && e.target.value !== ""
                    ? { ...g.weeklyRange, min: +e.target.value }
                    : undefined,
              })
            }
          />
        </Field>
      )}
      {g.kind === "daily_count" &&
        (["weekdays", "weekends"] as const).map((key) => (
          <Field
            key={key}
            label={
              key === "weekdays"
                ? "平日 最低 / 推奨上限"
                : "土日・祝日 最低 / 推奨上限"
            }
          >
            <div className="actions">
              <input
                aria-label={key + "最小"}
                type="number"
                min="0"
                step="1"
                placeholder="未設定"
                value={g[key]?.min ?? ""}
                onChange={(e) =>
                  set({
                    ...g,
                    [key]:
                      e.target.value === ""
                        ? undefined
                        : { ...g[key], min: +e.target.value },
                  })
                }
              />
              <input
                aria-label={key + "最大"}
                type="number"
                min={g[key]?.min ?? 0}
                step="1"
                placeholder="上限なし"
                disabled={!g[key]}
                value={g[key]?.max ?? ""}
                onChange={(e) =>
                  set({
                    ...g,
                    [key]: {
                      min: g[key]?.min ?? 0,
                      max: number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </Field>
        ))}
      {g.kind === "weekly_count" && (
        <>
          <Field label="集計期間">
            <select
              value={g.weeklyPeriod ?? "sprint"}
              onChange={(e) =>
                set({
                  ...g,
                  weeklyPeriod: e.target.value as "calendar" | "sprint",
                })
              }
            >
              <option value="calendar">今週（月〜日、Sprint期間内）</option>
              <option value="sprint">Sprint全期間（旧形式）</option>
            </select>
          </Field>
          <Field label="週間 推奨上限（任意）">
            <input
              type="number"
              min={g.target ?? 0}
              disabled={g.target === undefined}
              value={g.weeklyRange?.max ?? ""}
              onChange={(e) =>
                set({
                  ...g,
                  weeklyRange:
                    e.target.value === ""
                      ? undefined
                      : { min: g.target ?? 0, max: +e.target.value },
                })
              }
            />
          </Field>
        </>
      )}
      <details className="full-width target-picker" open>
        <summary>
          対象教材・単元・項目を選択（{goalItems(g, data).length}項目）
        </summary>
        <p>
          講座全体、単元、個別項目の選択範囲を合算します。同じ項目は1回だけ集計します。化学は実戦問題25＋25＋27題を選び、講義全体と混同しないでください。
        </p>
        {data.courses.map((c) => (
          <details key={c.id}>
            <summary>
              {c.name}
              {c.archived ? "（非表示）" : ""}
            </summary>
            <label className="check">
              <input
                type="checkbox"
                checked={scope.courseIds.includes(c.id)}
                onChange={() => toggle("courseIds", c.id)}
              />
              {c.name} 全体
            </label>
            {data.units
              .filter((u) => u.courseId === c.id)
              .map((u) => (
                <details key={u.id}>
                  <summary>
                    {u.chapter ? u.chapter + " / " : ""}
                    {u.name}
                    {u.archived ? "（非表示）" : ""}
                  </summary>
                  <label className="check">
                    <input
                      type="checkbox"
                      disabled={scope.courseIds.includes(c.id)}
                      checked={!!scope.unitIds?.includes(u.id)}
                      onChange={() => toggle("unitIds", u.id)}
                    />
                    この単元全体
                  </label>
                  <div className="target-items">
                    {data.studyItems
                      .filter((i) => i.unitId === u.id)
                      .map((i) => (
                        <label className="check" key={i.id}>
                          <input
                            type="checkbox"
                            disabled={
                              scope.courseIds.includes(c.id) ||
                              scope.unitIds?.includes(u.id)
                            }
                            checked={!!scope.itemIds?.includes(i.id)}
                            onChange={() => toggle("itemIds", i.id)}
                          />
                          {i.title}
                        </label>
                      ))}
                  </div>
                </details>
              ))}
          </details>
        ))}
      </details>
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
              {goalItems(g, data).map((i) => (
                <option key={i.id} value={i.id}>
                  {data.courses.find((c) => c.id === i.courseId)?.name} /{" "}
                  {data.units.find((u) => u.id === i.unitId)?.name} / {i.title}
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
      <div className="actions full-width">
        <button>目標を保存</button>
        <button type="button" className="secondary" onClick={onDone}>
          閉じる
        </button>
      </div>
    </form>
  );
}
