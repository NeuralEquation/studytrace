import { useState } from "react";
import { templates, createTemplates } from "../features/courses/templates";
import { db } from "../db/database";
import { action } from "../stores/ui";
import { Field } from "../components/ui";
import { importBackup } from "../features/backup/backup";
export function Onboarding() {
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <main className="setup-page">
      <div className="brand">StudyTrace</div>
      <h1>講座と授業から、学習を始める</h1>
      <p>
        使う講座を選んでください。確認できた授業名・章・節を登録します。あとから追加できます。
      </p>
      <section className="card">
        <h2>すでに使っている方</h2>
        <p>
          以前のStudyTraceの「設定 →
          JSONバックアップ」から書き出し、ここで読み込んでください。
        </p>
        <Field label="既存データを引き継ぐ（JSON）">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void action(async () => {
                  if (file.size > 50 * 1024 * 1024)
                    throw new Error("50MB以下のファイルを選択してください");
                  await importBackup(JSON.parse(await file.text()), "merge");
                  await db.settings.put({ key: "onboarded", value: true });
                }, "バックアップを復元しました");
              e.target.value = "";
            }}
          />
        </Field>
      </section>
      <div className="template-list">
        {templates.map((t, i) => (
          <label key={i}>
            <input
              type="checkbox"
              checked={selected.includes(i)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, i]
                    : selected.filter((n) => n !== i),
                )
              }
            />
            <span>
              {t.name}
              <small>
                {t.count ? `${t.count}授業` : "授業未登録"} · {t.source}
              </small>
            </span>
          </label>
        ))}
      </div>
      <p>過去の進捗は、登録後に各授業の「編集」から個別に設定できます。</p>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void action(async () => {
            const data = createTemplates(selected);
            await db.transaction("rw", db.tables, async () => {
              if (await db.settings.get("onboarded")) return;
              await db.courses.bulkAdd(data.courses);
              await db.units.bulkAdd(data.units);
              await db.studyItems.bulkAdd(data.studyItems);
              await db.settings.put({ key: "onboarded", value: true });
            });
          }, "授業を登録しました").finally(() => setBusy(false));
        }}
      >
        選んだ講座で始める（{selected.length}講座）
      </button>
    </main>
  );
}
