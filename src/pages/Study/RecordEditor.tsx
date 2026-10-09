import { useState } from "react";
import type { Attempt, StudySession, StudyItem } from "../../types/model";
import { Field } from "../../components/ui";
import { ModeForm } from "./ModeForm";
import { addManualRecord, editRecord } from "../../features/study/records";
import { newAttempt } from "../../features/study/session";
import { action } from "../../stores/ui";
import { localDate, uid } from "../../utils/time";

export function RecordEditor({
  attempt,
  session,
  createItem,
  onDone,
}: {
  attempt?: Attempt;
  session?: StudySession;
  createItem?: StudyItem;
  onDone: () => void;
}) {
  const [original] = useState({ attempt, session });
  const [value, setValue] = useState(() =>
    createItem ? newAttempt(createItem, uid()) : attempt,
  );
  const base = new Date(
    session?.startedAt ??
      new Date(
        new Date(value!.createdAt).getTime() -
          (value?.durationSeconds ?? 0) * 1000,
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
          if (createItem && value)
            await addManualRecord(
              createItem,
              value,
              new Date(date + "T" + time).toISOString(),
              minutes * 60 + seconds,
              note,
              pin,
            );
          else
            await editRecord(original, {
              attempt: value,
              startedAt: new Date(date + "T" + time).toISOString(),
              durationSeconds: minutes * 60 + seconds,
              note,
              includeInCoachReport: pin,
            });
          onDone();
        }, "記録を保存しました。保存済みの報告文は必要に応じて再生成してください。").finally(
          () => setBusy(false),
        );
      }}
    >
      <h3>{createItem ? "学習日・結果を記録" : "学習時間・結果を編集"}</h3>
      {createItem && (
        <p>
          前日以前の日付でも保存できます。時間は任意です。未計測なら0のままで、1日の合計は「報告用の日別勉強時間」に入力してください。
        </p>
      )}
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
        <button disabled={busy}>
          {createItem ? "記録を追加" : "変更を保存"}
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
