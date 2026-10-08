import { useState } from "react";
import { Link } from "react-router-dom";
import type { AppData } from "../../types/model";
import {
  subjectNames,
  coachSchema,
  directiveSchema,
  questionSchema,
} from "../../types/model";
import { PageHeader, Field } from "../../components/ui";
import { db } from "../../db/database";
import { action } from "../../stores/ui";
import { localDate, now, uid } from "../../utils/time";
export function Coach({ data }: { data: AppData }) {
  const [edit, setEdit] = useState<string | null>(null);
  const session = data.coachSessions.find((s) => s.id === edit);
  return (
    <>
      <PageHeader
        eyebrow="REVIEW & COACH"
        title="指導と振り返り"
        description="方針を残し、日々の記録を次の相談へつなげる。"
        actions={
          <Link className="button" to="/report">
            週間進捗報告 →
          </Link>
        }
      />
      <div className="two-columns">
        <section>
          <div className="section-heading">
            <h2>指導記録</h2>
            <button className="secondary" onClick={() => setEdit("new")}>
              指導を追加
            </button>
          </div>
          {edit && (
            <form
              className="card"
              key={edit}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action(async () => {
                  await db.coachSessions.put(
                    coachSchema.parse({
                      id: session?.id ?? uid(),
                      date: f.get("date"),
                      title: f.get("title"),
                      notes: f.get("notes"),
                      nextSessionAt: f.get("next")
                        ? new Date(String(f.get("next"))).toISOString()
                        : undefined,
                    }),
                  );
                  setEdit(null);
                }, "指導記録を保存しました");
              }}
            >
              <Field label="指導日">
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={session?.date ?? localDate()}
                />
              </Field>
              <Field label="タイトル">
                <input name="title" defaultValue={session?.title ?? ""} />
              </Field>
              <Field label="指導メモ">
                <textarea name="notes" defaultValue={session?.notes ?? ""} />
              </Field>
              <Field label="次回指導日時">
                <input
                  type="datetime-local"
                  name="next"
                  defaultValue={
                    session?.nextSessionAt
                      ? localDate(session.nextSessionAt) +
                        "T" +
                        new Date(session.nextSessionAt)
                          .toTimeString()
                          .slice(0, 5)
                      : ""
                  }
                />
              </Field>
              <div className="actions">
                <button>保存</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEdit(null)}
                >
                  閉じる
                </button>
              </div>
            </form>
          )}
          {[...data.coachSessions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((c) => (
              <article className="card" key={c.id}>
                <div className="row">
                  <span className="eyebrow">{c.date}</span>
                  <button className="text-button" onClick={() => setEdit(c.id)}>
                    編集
                  </button>
                </div>
                <h3>{c.title || "指導記録"}</h3>
                <p className="prewrap">{c.notes}</p>
                {c.nextSessionAt && (
                  <p>次回：{new Date(c.nextSessionAt).toLocaleString()}</p>
                )}
                <Link
                  to={
                    "/report?start=" +
                    c.date +
                    "&end=" +
                    (c.nextSessionAt ? localDate(c.nextSessionAt) : localDate())
                  }
                >
                  この期間の進捗報告を作成 →
                </Link>
                <h4>指導方針</h4>
                {data.coachDirectives
                  .filter((d) => d.coachSessionId === c.id)
                  .map((d) => (
                    <div className="directive" key={d.id}>
                      <strong>
                        {subjectNames[d.subject]} ·{" "}
                        {d.priority === "high"
                          ? "優先"
                          : d.priority === "low"
                            ? "補助"
                            : "標準"}
                      </strong>
                      <p>{d.text}</p>
                      <small>
                        {d.activeFrom} 〜 {d.activeUntil ?? "継続"}
                      </small>
                    </div>
                  ))}
                <details>
                  <summary>方針を追加</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const f = new FormData(form);
                      void action(async () => {
                        await db.coachDirectives.add(
                          directiveSchema.parse({
                            id: uid(),
                            coachSessionId: c.id,
                            subject: f.get("subject"),
                            text: f.get("text"),
                            priority: f.get("priority"),
                            activeFrom: f.get("from"),
                            activeUntil: f.get("until") || undefined,
                            courseId: f.get("course") || undefined,
                          }),
                        );
                        form.reset();
                      }, "方針を保存しました");
                    }}
                  >
                    <Field label="教科">
                      <select name="subject">
                        {Object.entries(subjectNames).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="方針">
                      <textarea name="text" required />
                    </Field>
                    <Field label="優先度">
                      <select name="priority">
                        <option value="normal">標準</option>
                        <option value="high">優先</option>
                        <option value="low">補助</option>
                      </select>
                    </Field>
                    <Field label="適用開始">
                      <input
                        name="from"
                        type="date"
                        required
                        defaultValue={c.date}
                      />
                    </Field>
                    <Field label="適用終了（任意）">
                      <input name="until" type="date" />
                    </Field>
                    <Field label="関連教材">
                      <select name="course">
                        <option value="">なし</option>
                        {data.courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button>方針を保存</button>
                  </form>
                </details>
              </article>
            ))}
        </section>
        <section>
          <h2>次回聞きたいこと</h2>
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              void action(async () => {
                await db.coachQuestions.add(
                  questionSchema.parse({
                    id: uid(),
                    createdAt: now(),
                    text: f.get("text"),
                    subject: f.get("subject") || undefined,
                    relatedItemId: f.get("item") || undefined,
                    resolved: false,
                  }),
                );
                form.reset();
              }, "質問を保存しました");
            }}
          >
            <Field label="質問・相談">
              <textarea
                name="text"
                required
                placeholder="学習中に浮かんだ疑問を、そのまま。"
              />
            </Field>
            <Field label="教科（任意）">
              <select name="subject">
                <option value="">全般</option>
                {Object.entries(subjectNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="関連項目">
              <select name="item">
                <option value="">なし</option>
                {data.studyItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {data.courses.find((c) => c.id === i.courseId)?.name} /{" "}
                    {i.title}
                  </option>
                ))}
              </select>
            </Field>
            <button>質問を保存</button>
          </form>
          {data.coachQuestions.map((q) => (
            <label
              className={"card question " + (q.resolved ? "resolved" : "")}
              key={q.id}
            >
              <input
                type="checkbox"
                checked={q.resolved}
                onChange={(e) =>
                  void action(() =>
                    db.coachQuestions.update(q.id, {
                      resolved: e.target.checked,
                    }),
                  )
                }
              />
              <div>
                <small>
                  {q.subject ? subjectNames[q.subject] : "全般"} ·{" "}
                  {q.resolved ? "解決済み" : "未解決"}
                </small>
                <p>{q.text}</p>
              </div>
            </label>
          ))}
        </section>
      </div>
    </>
  );
}
