import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, RefreshCw } from "lucide-react";
import type { AppData, ReportDraft } from "../../types/model";
import { subjectNames } from "../../types/model";
import { PageHeader, Field, Stat } from "../../components/ui";
import { buildWeeklyProgressReport } from "../../domain/report/formatters";
import { db } from "../../db/database";
import { action } from "../../stores/ui";
import { localDate, now } from "../../utils/time";
export function WeeklyReport({ data }: { data: AppData }) {
  const [params, setParams] = useSearchParams();
  const today = localDate();
  const sprint = data.sprints
    .filter((s) => s.startDate <= today && s.endDate >= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const coach = [...data.coachSessions]
    .filter((c) => c.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const [start, setStart] = useState(
    params.get("start") ?? sprint?.startDate ?? coach?.date ?? localDate(d),
  );
  const [end, setEnd] = useState(
    params.get("end") ??
      sprint?.endDate ??
      (coach?.nextSessionAt ? localDate(coach.nextSessionAt) : today),
  );
  const id = start + "_" + end;
  const draft = data.progressReportDrafts.find(
    (d) => d.startDate === start && d.endDate === end,
  );
  function changePeriod(from: string, to: string) {
    setStart(from);
    setEnd(to);
    setParams({ start: from, end: to }, { replace: true });
  }
  return (
    <>
      <PageHeader
        eyebrow="WEEKLY PROGRESS REPORT"
        title="週間進捗報告"
        description="1週間の変化を、伝わる文章に。確認して、編集して、そのままコピー。"
      />
      <div className="card report-period">
        <Field label="保存した報告">
          <select
            value={draft?.id ?? ""}
            onChange={(e) => {
              const saved = data.progressReportDrafts.find(
                (d) => d.id === e.target.value,
              );
              if (saved) changePeriod(saved.startDate, saved.endDate);
            }}
          >
            <option value="">期間を指定</option>
            {data.progressReportDrafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.startDate} 〜 {d.endDate}
              </option>
            ))}
          </select>
        </Field>
        <Field label="開始日">
          <input
            type="date"
            required
            value={start}
            onInput={(e) => changePeriod(e.currentTarget.value, end)}
            onChange={(e) => changePeriod(e.target.value, end)}
          />
        </Field>
        <span>〜</span>
        <Field label="終了日">
          <input
            type="date"
            required
            value={end}
            onInput={(e) => changePeriod(start, e.currentTarget.value)}
            onChange={(e) => changePeriod(start, e.target.value)}
          />
        </Field>
        <p>両端の日付を含みます</p>
      </div>
      {start && end && start <= end ? (
        <ReportBody
          key={id}
          data={data}
          start={start}
          end={end}
          existing={draft}
        />
      ) : (
        <p role="alert">開始日と終了日を確認してください。</p>
      )}
    </>
  );
}
function ReportBody({
  data,
  start,
  end,
  existing,
}: {
  data: AppData;
  start: string;
  end: string;
  existing?: ReportDraft;
}) {
  const [text, setText] = useState(existing?.text ?? "");
  const [detail, setDetail] = useState<"compact" | "detailed">(
    existing?.detail ?? "compact",
  );
  const [daily, setDaily] = useState(existing?.daily ?? true);
  const [edited, setEdited] = useState(existing?.edited ?? false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [status, setStatus] = useState(existing ? "保存済み" : "");
  const result = buildWeeklyProgressReport(data, { start, end, detail, daily });
  const id = existing?.id ?? start + "_" + end;
  function save(value: string, isEdited: boolean) {
    setText(value);
    setEdited(isEdited);
    setStatus("保存中…");
    void action(async () => {
      await db.progressReportDrafts.put({
        id,
        startDate: start,
        endDate: end,
        text: value,
        generatedAt: isEdited ? (existing?.generatedAt ?? now()) : now(),
        updatedAt: now(),
        edited: isEdited,
        detail,
        daily,
      });
      setStatus("保存済み");
    });
  }
  return (
    <>
      <div className="stats-grid">
        {result.summary.map((s) => (
          <Stat
            key={s.subject}
            label={subjectNames[s.subject]}
            value={`${s.count} 項目`}
          />
        ))}
      </div>
      {result.warnings.length > 0 && (
        <aside className="warning">
          <strong>提出前に確認</strong>
          {result.warnings.map((w) => (
            <p key={w}>⚠ {w}</p>
          ))}
        </aside>
      )}
      <section className="card">
        <div className="toolbar">
          <Field label="詳しさ">
            <select
              value={detail}
              onChange={(e) => setDetail(e.target.value as typeof detail)}
            >
              <option value="compact">Compact · 簡潔</option>
              <option value="detailed">Detailed · 詳細</option>
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={daily}
              onChange={(e) => setDaily(e.target.checked)}
            />
            日別の学習時間も含める
          </label>
          <button
            onClick={() => {
              if (edited) setConfirmRegenerate(true);
              else save(result.text, false);
            }}
          >
            <RefreshCw size={16} />
            {text ? "記録から再生成" : "提出文を生成"}
          </button>
        </div>
        {confirmRegenerate && (
          <div className="warning" role="alert">
            <p>現在の編集内容が置き換わります。記録から再生成しますか？</p>
            <div className="row">
              <button
                onClick={() => {
                  save(result.text, false);
                  setConfirmRegenerate(false);
                }}
              >
                編集を置き換えて再生成
              </button>
              <button
                className="secondary"
                onClick={() => setConfirmRegenerate(false)}
              >
                編集を保持
              </button>
            </div>
          </div>
        )}
        <Field
          label="提出用テキスト"
          hint="ここでの編集は、元の演習記録や学習時間を変更しません。"
        >
          <textarea
            className="report-text"
            value={text}
            placeholder="「提出文を生成」で、この期間の記録をまとめます。"
            onChange={(e) => save(e.target.value, true)}
          />
        </Field>
        <div className="row">
          <small role="status">{status}</small>
          <button
            disabled={!text}
            onClick={() =>
              void action(async () => {
                await navigator.clipboard.writeText(text);
              }, "コピーしました")
            }
          >
            <Copy size={16} />
            コピー
          </button>
        </div>
      </section>
    </>
  );
}
