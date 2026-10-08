import { useState } from "react";
import type { AppData } from "../../types/model";
import { PageHeader, Field } from "../../components/ui";
import {
  importBackup,
  makeBackup,
  download,
  csv,
  importCourse,
  backupSchema,
} from "../../features/backup/backup";
import { action } from "../../stores/ui";
import { localDate } from "../../utils/time";
import { Link } from "react-router-dom";
export function Settings({ data }: { data: AppData }) {
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [json, setJson] = useState("");
  const [pending, setPending] = useState<unknown>();
  const [persisted, setPersisted] = useState<string>("");
  return (
    <>
      <PageHeader
        eyebrow="YOUR DATA, YOUR CONTROL"
        title="設定とバックアップ"
        description="記録はこのブラウザに保存されます。定期的なバックアップで、学びを守りましょう。"
      />
      <section className="card">
        <h2>以前のデータを引き継ぐ</h2>
        <p>
          同じブラウザ・同じ保存場所（URL）で更新した場合は、保存済みデータをそのまま読み込みます。HTMLの場所、ブラウザ、URLを変える場合は、旧画面でJSONを書き出し、新画面で読み込んでください。
        </p>
        <p>
          講座の授業名を直すときは「講座・授業 → 対象講座 →
          授業一覧の取り込み・既存記録の引き継ぎ」を使います。旧番号の記録を推測で別授業へ移すことはありません。
        </p>
      </section>
      {data.settings.some((s) => s.key.startsWith("before-catalog:")) && (
        <details className="card">
          <summary>取り込み前バックアップ</summary>
          <p>
            講座ごとに初回変更前と直近変更前を保持します。JSONを書き出し、下の読み込み欄から復元できます。
          </p>
          {data.settings
            .filter((s) => s.key.startsWith("before-catalog:"))
            .reverse()
            .map((s) => (
              <div className="catalog-row" key={s.key}>
                <span>
                  {s.key.includes(":baseline:")
                    ? "初回変更前 · "
                    : s.key.includes(":latest:")
                      ? "直近変更前 · "
                      : ""}
                  {new Date(
                    (s.value as { exportedAt: string }).exportedAt,
                  ).toLocaleString()}
                </span>
                <button
                  className="secondary"
                  onClick={() =>
                    download(
                      "StudyTrace-before-catalog-" +
                        s.key.slice(15).replaceAll(":", "-") +
                        ".json",
                      JSON.stringify(s.value, null, 2),
                    )
                  }
                >
                  この時点のJSONを書き出す
                </button>
              </div>
            ))}
        </details>
      )}
      <div className="two-columns">
        <section className="card">
          <h2>データを保存する</h2>
          <p>全教材・全記録・週間報告の下書きをJSONにまとめます。</p>
          <div className="stack">
            <button
              onClick={() =>
                void action(
                  async () =>
                    download(
                      "StudyTrace-" + localDate() + ".json",
                      JSON.stringify(await makeBackup(), null, 2),
                    ),
                  "バックアップを書き出しました",
                )
              }
            >
              JSONバックアップを書き出す
            </button>
            <button
              className="secondary"
              onClick={() =>
                download(
                  "StudyTrace-records-" + localDate() + ".csv",
                  csv(data),
                  "text/csv;charset=utf-8",
                )
              }
            >
              CSVを書き出す
            </button>
            <button
              className="secondary"
              onClick={() =>
                void action(async () => {
                  const ok = await navigator.storage?.persist?.();
                  setPersisted(
                    ok
                      ? "永続ストレージが許可されました。"
                      : "このブラウザは永続保存を許可していません。JSONバックアップをご利用ください。",
                  );
                })
              }
            >
              永続ストレージをリクエスト
            </button>
          </div>
          <p role="status">{persisted}</p>
          <p className="muted">
            CSVにはSessionとAttemptを収録します。完全な復元にはJSONを使用してください。
          </p>
        </section>
        <section className="card">
          <h2>バックアップを読み込む</h2>
          <Field label="取り込み方法">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="merge">
                Merge · 同一内容は統合、競合時は中止
              </option>
              <option value="replace">Replace · 全データを置換</option>
            </select>
          </Field>
          <Field label="JSONバックアップ">
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void action(async () => {
                  if (file.size > 50 * 1024 * 1024)
                    throw new Error("50MB以下のJSONを選択してください");
                  const parsed = backupSchema.parse(
                    JSON.parse(await file.text()),
                  );
                  setPending(parsed);
                }, "検証に成功しました。内容を確認して取り込んでください。");
                e.target.value = "";
              }}
            />
          </Field>
          {pending !== undefined && (
            <div className="callout">
              <p>
                Zod検証済み。
                {mode === "replace"
                  ? "現在の全データを置き換えます。"
                  : "同じIDで内容が異なる場合は変更せず中止します。"}
              </p>
              <button
                onClick={() => {
                  if (
                    mode === "replace" &&
                    !confirm(
                      "現在の全データが置き換わります。先にバックアップを書き出しましたか？",
                    )
                  )
                    return;
                  void action(async () => {
                    await importBackup(pending, mode);
                    setPending(undefined);
                  }, "バックアップを取り込みました");
                }}
              >
                取り込みを実行
              </button>
            </div>
          )}
        </section>
        <section className="card">
          <h2>教材をJSONから登録</h2>
          <p>講座名・単元・StudyItemのメタデータを取り込みます。</p>
          <Field label="教材JSONファイル">
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void action(async () => setJson(await file.text()));
                e.target.value = "";
              }}
            />
          </Field>
          <Field label="教材JSON">
            <textarea
              className="code-input"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder={
                '{"name":"教材名","subject":"information","units":[{"name":"単元名","items":[{"title":"講義名","type":"video","studyMode":"video"}]}]}'
              }
            />
          </Field>
          <button
            disabled={!json}
            onClick={() =>
              void action(async () => {
                await importCourse(JSON.parse(json));
                setJson("");
              }, "教材を登録しました")
            }
          >
            教材を取り込む
          </button>
        </section>
        <section className="card">
          <h2>授業カタログ</h2>
          <p>
            登録サイトで使われている9講座・1,211授業をUSBの授業フォルダと照合しました。情報は現在の受講ページの73授業・5章を登録できます。
          </p>
          <p>講座一覧で新規登録、各講座で既存項目との対応づけができます。</p>
          <Link className="button secondary" to="/courses">
            講座・授業を開く
          </Link>
        </section>
      </div>
      <section className="card">
        <h2>保存とオフラインについて</h2>
        <p>
          同じブラウザ・同じURLで利用してください。ポートやホストが変わると別の保存領域になります。プライベートブラウズやブラウザのデータ消去では記録が失われる場合があります。
        </p>
        <p>
          一度オンラインで開くとアプリ本体をキャッシュします。外部教材は元サイトで開きます。サービスワーカーの更新は、学習を終了した後に再読み込みしてください。
        </p>
        <small>
          StudyTrace v0.1 · DB schema v2 · 外部API・認証・サーバー不要
        </small>
      </section>
    </>
  );
}
