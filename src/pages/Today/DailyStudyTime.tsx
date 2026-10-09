import { useState } from "react";
import type { AppData } from "../../types/model";
import { Field } from "../../components/ui";
import {
  dailyEntries,
  dailyTimePrefix,
  saveDailyTime,
} from "../../features/study/dailyTime";
import { localDate, humanTime } from "../../utils/time";
import { action } from "../../stores/ui";

export function DailyStudyTime({ data }: { data: AppData }) {
  const [date, setDate] = useState(localDate());
  const [version, setVersion] = useState(0);
  return (
    <section className="card daily-study-time">
      <h2>報告用の日別勉強時間</h2>
      <p>
        その日の勉強時間の合計を入力します。前日以前も追加・修正できます。報告ではこの合計を優先し、個別の計測時間は加算しません。
      </p>
      <Field label="勉強時間の日付">
        <input
          type="date"
          required
          value={date}
          onInput={(e) => setDate(e.currentTarget.value)}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      {date && (
        <DailyTimeEditor key={date + ":" + version} date={date} data={data} />
      )}
      <details>
        <summary>保存済みの日別時間（編集する日を選択）</summary>
        <div className="daily-time-history">
          {dailyEntries(data).map((d) => (
            <button
              type="button"
              className="secondary"
              key={d.date}
              onClick={() => {
                setDate(d.date);
                setVersion((v) => v + 1);
              }}
            >
              {d.date} · {humanTime(d.seconds)}
            </button>
          ))}
        </div>
        {!dailyEntries(data).length && <p>まだ日別時間を保存していません。</p>}
      </details>
    </section>
  );
}
function DailyTimeEditor({ date, data }: { date: string; data: AppData }) {
  const entry = dailyEntries(data).find((d) => d.date === date);
  const [original, setOriginal] = useState(
    () => data.settings.find((s) => s.key === dailyTimePrefix + date)?.value,
  );
  const [hours, setHours] = useState(
    entry ? String(Math.floor(entry.seconds / 3600)) : "",
  );
  const [minutes, setMinutes] = useState(
    entry ? String((entry.seconds % 3600) / 60) : "",
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void action(async () => {
          setOriginal(
            await saveDailyTime(
              date,
              Number(hours || 0) * 3600 + Number(minutes || 0) * 60,
              note,
              original,
            ),
          );
        }, "日別の勉強時間を保存しました。報告文は再生成すると反映されます。").finally(
          () => setBusy(false),
        );
      }}
    >
      <div className="form-grid">
        <Field label="合計（時間）">
          <input
            type="number"
            min="0"
            max="24"
            step="1"
            placeholder="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </Field>
        <Field label="合計（分）">
          <input
            type="number"
            min="0"
            max="59"
            step="1"
            placeholder="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
      </div>
      <Field label="日別メモ（任意）">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <button disabled={busy || (hours === "" && minutes === "")}>
        日別時間を保存
      </button>
    </form>
  );
}
