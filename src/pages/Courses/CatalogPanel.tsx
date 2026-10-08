import { useState } from "react";
import type { AppData, Course } from "../../types/model";
import {
  catalog,
  addCatalog,
  assignLesson,
} from "../../features/courses/catalog";
import { action } from "../../stores/ui";
import { Field } from "../../components/ui";
export function CatalogPanel({
  data,
  course,
}: {
  data: AppData;
  course?: Course;
}) {
  const [itemId, setItem] = useState("");
  const [lessonKey, setLesson] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const source =
    course &&
    catalog.find((c) => c.id === course.catalogId || c.title === course.name);
  if (!course)
    return (
      <section className="card catalog-panel">
        <h2>確認済みの講座一覧</h2>
        <p>授業数が0の講座は、講座名だけを登録します。</p>
        {catalog.map((c) => (
          <div className="catalog-row" key={c.id}>
            <div>
              <strong>{c.title}</strong>
              <small>
                {c.lessons.length}授業 · {c.source}
              </small>
            </div>
            <button
              className="secondary"
              disabled={
                busy ||
                data.courses.some(
                  (x) => x.catalogId === c.id || x.name === c.title,
                )
              }
              onClick={() => {
                setBusy(true);
                void action(
                  () => addCatalog(c.id),
                  "講座と授業を追加しました",
                ).finally(() => setBusy(false));
              }}
            >
              {data.courses.some(
                (x) => x.catalogId === c.id || x.name === c.title,
              )
                ? "登録済み"
                : "追加"}
            </button>
          </div>
        ))}
      </section>
    );
  if (!source) return null;
  const legacy = data.studyItems.filter(
    (i) => i.courseId === course.id && !i.catalogKey && !i.archived,
  );
  const additions = source.lessons.filter(
    (l) =>
      !data.studyItems.some(
        (i) => i.courseId === course.id && i.catalogKey === l.key,
      ),
  );
  return (
    <details className="card catalog-panel">
      <summary>
        授業一覧の取り込み・既存記録の引き継ぎ{" "}
        <small>{source.lessons.length}授業</small>
      </summary>
      <p>{source.source}</p>
      {legacy.length > 0 && (
        <>
          <h3>既存の授業を対応づける</h3>
          <p>
            既存の記録は残っています。旧番号と授業の並びは自動では対応づけません。下で実際に学習した授業を選ぶと、時間・結果・進捗を保ったまま授業名と章・節を更新します。
          </p>
          <div className="form-grid">
            <Field label="引き継ぐ既存の項目">
              <select
                value={itemId}
                onChange={(e) => {
                  setItem(e.target.value);
                  setPreview(false);
                }}
              >
                <option value="">選択してください</option>
                {legacy.map((i) => (
                  <option key={i.id} value={i.id}>
                    {data.units.find((u) => u.id === i.unitId)?.name} /{" "}
                    {i.title}（
                    {data.attempts.filter((a) => a.itemId === i.id).length}
                    記録）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="授業名を絞り込む">
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
            <Field label="対応する実際の授業">
              <select
                value={lessonKey}
                onChange={(e) => {
                  setLesson(e.target.value);
                  setPreview(false);
                }}
              >
                <option value="">選択してください</option>
                {source.lessons
                  .filter((l) =>
                    [l.title, l.chapter, l.section].join(" ").includes(query),
                  )
                  .map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.chapter} / {l.section} / {l.title}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <button
            className="secondary"
            disabled={!itemId || !lessonKey}
            onClick={() => setPreview(true)}
          >
            対応を確認
          </button>
          {preview && (
            <div className="callout">
              <p>
                「{data.studyItems.find((i) => i.id === itemId)?.title}」→「
                {
                  source.lessons.find((l) => l.key === lessonKey)?.chapter
                } / {source.lessons.find((l) => l.key === lessonKey)?.section} /
                {source.lessons.find((l) => l.key === lessonKey)?.title}」
              </p>
              <p>
                ID・記録・進捗・学習モードを保持します。未学習の重複授業があれば非表示にします。
              </p>
              <button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void action(async () => {
                    await assignLesson(itemId, source.id, lessonKey);
                    setPreview(false);
                    setItem("");
                    setLesson("");
                  }, "授業名と章・節を更新し、記録を引き継ぎました").finally(
                    () => setBusy(false),
                  );
                }}
              >
                この対応で引き継ぐ
              </button>
            </div>
          )}
        </>
      )}
      {additions.length > 0 && (
        <div className="callout">
          <p>
            未登録の{additions.length}
            授業を追加します。既存の項目・記録は残します。対応づけは取り込み後も可能です。
          </p>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void action(
                () => addCatalog(source.id, course.id),
                "授業一覧を取り込みました",
              ).finally(() => setBusy(false));
            }}
          >
            授業一覧を取り込む
          </button>
        </div>
      )}
      <small>
        変更前のデータは「設定」の取り込み前バックアップに保存します。
      </small>
    </details>
  );
}
