import { useState } from "react";
import type { AppData } from "../types/model";
import { subjectNames } from "../types/model";
import { priorities, prioritiesKey } from "../domain/planning";
import { db } from "../db/database";
import { action } from "../stores/ui";
export function PriorityEditor({ data }: { data: AppData }) {
  const [value, set] = useState(() => priorities(data));
  const subjects = [...new Set(data.courses.map((c) => c.subject))].sort(
    (a, b) => a.localeCompare(b),
  );
  function ordered(ids: string[], saved: string[]) {
    return [
      ...saved.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !saved.includes(id)),
    ];
  }
  function move(
    key: "subjects" | "courses",
    list: string[],
    at: number,
    delta: number,
  ) {
    const next = [...list];
    [next[at], next[at + delta]] = [next[at + delta], next[at]];
    set({
      ...value,
      [key]:
        key === "courses"
          ? [...value.courses.filter((id) => !list.includes(id)), ...next]
          : next,
    });
  }
  function controls(
    key: "subjects" | "courses",
    ids: string[],
    name: (id: string) => string,
  ) {
    const list = ordered(ids, value[key]);
    return (
      <ol className="priority-list">
        {list.map((id, n) => (
          <li key={id}>
            <span>{name(id)}</span>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                disabled={n === 0}
                aria-label={name(id) + "を上へ"}
                onClick={() => move(key, list, n, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="secondary"
                disabled={n === list.length - 1}
                aria-label={name(id) + "を下へ"}
                onClick={() => move(key, list, n, 1)}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <details className="card">
      <summary>科目・教材の表示優先順位</summary>
      <p>
        同じノルマ分類では、Coachの有効な優先度、ここで保存した科目・教材順、未達目標数、締切の順で並べます。未設定の科目は同順位です。
      </p>
      <h3>科目</h3>
      {controls(
        "subjects",
        subjects,
        (id) => subjectNames[id as keyof typeof subjectNames],
      )}
      {subjects.map((subject) => (
        <details key={subject}>
          <summary>{subjectNames[subject]}の教材順</summary>
          {controls(
            "courses",
            data.courses
              .filter((c) => c.subject === subject)
              .map((c) => c.id)
              .sort(),
            (id) => data.courses.find((c) => c.id === id)!.name,
          )}
        </details>
      ))}
      <button
        type="button"
        onClick={() =>
          void action(
            () => db.settings.put({ key: prioritiesKey, value }),
            "優先順位を保存しました",
          )
        }
      >
        優先順位を保存
      </button>
    </details>
  );
}
