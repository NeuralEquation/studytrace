import { useState } from "react";
import type { Attempt, StudySession } from "../../types/model";
import { Field } from "../../components/ui";
import { ModeForm } from "./ModeForm";
import { editRecord } from "../../features/study/records";
import { action } from "../../stores/ui";
import { localDate } from "../../utils/time";

export function RecordEditor({
  attempt,
  session,
  onDone,
}: {
  attempt?: Attempt;
  session?: StudySession;
  onDone: () => void;
}) {
  const [original] = useState({ attempt, session });
  const [value, setValue] = useState(attempt);
  const base = new Date(
    session?.startedAt ??
      new Date(
        new Date(attempt!.createdAt).getTime() -
          (attempt!.durationSeconds ?? 0) * 1000,
      ),
  );
  const [date, setDate] = useState(localDate(base));
  const [time, setTime] = useState(base.toTimeString().slice(0, 8));
  const duration = session?.durationSeconds ?? attempt?.durationSeconds ?? 0;
  const [minutes, setMinutes] = useState(Math.floor(duration / 60));
  const [seconds, setSeconds] = useState(duration % 60);
  const [note, setNote] = useState(attempt?.notes ?? session?.note ?? "");
  const [pin, setPin] = useState(
    attempt?.includeInCoachReport ?? session?.includeInCoachReport ?? false,
  );
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card record-editor"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void action(async () => {
          await editRecord(original, {
            attempt: value,
            startedAt: new Date(date + "T" + time).toISOString(),
            durationSeconds: minutes * 60 + seconds,
            note,
            includeInCoachReport: pin,
          });
          onDone();
        }, "記録を更新しました。保存済みの報告文は必要に応じて再生成してください。").finally(
          () => setBusy(false),
        );
      }}
    >
      <h3>学習時間・結果を編集</h3>
      <div className="form-grid">
        <Field label="学習日">
          <input
            required
            type="date"
            value={date}
            onInput={(e) => setDate(e.currentTarget.value)}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="開始時刻">
          <input
            required
            type="time"
            step="1"
            value={time}
            onInput={(e) => setTime(e.currentTarget.value)}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
        <Field label="学習時間（分）">
          <input
            required
            type="number"
            min="0"
            step="1"
            value={minutes}
            onChange={(e) => setMinutes(+e.target.value)}
          />
        </Field>
        <Field label="学習時間（秒）">
          <input
            required
            type="number"
            min="0"
            max="59"
            step="1"
            value={seconds}
            onChange={(e) => setSeconds(+e.target.value)}
          />
        </Field>
      </div>
      {value && <ModeForm value={value} onChange={setValue} />}
      <Field label="学習メモ">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={pin}
          onChange={(e) => setPin(e.target.checked)}
        />
        指導で報告
      </label>
      <div className="actions">
        <button disabled={busy}>変更を保存</button>
        <button type="button" className="secondary" onClick={onDone}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
