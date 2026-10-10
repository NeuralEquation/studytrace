import { useEffect, useRef, useState } from "react";
import {
  loadManualDraft,
  storeManualDraft,
} from "../../features/study/manualDraft";
import type { Attempt, StudySession, StudyItem } from "../../types/model";
import { Field } from "../../components/ui";
import { ModeForm } from "./ModeForm";
import { addManualRecord, editRecord } from "../../features/study/records";
import { newAttempt } from "../../features/study/session";
import { action } from "../../stores/ui";
import { localDate, uid, japanStamp, japanTime } from "../../utils/time";

export function RecordEditor({
  attempt,
  session,
  createItem,
  onDone,
  onSaved,
  onSaveNext,
  initialDate,
}: {
  attempt?: Attempt;
  session?: StudySession;
  createItem?: StudyItem;
  onDone: () => void;
  onSaved?: (date: string) => void;
  onSaveNext?: (date: string) => void;
  initialDate?: string;
}) {
  const [original] = useState({ attempt, session });
  const [freshValue] = useState(() =>
    createItem ? newAttempt(createItem, uid()) : attempt,
  );
  const draftKey = createItem
    ? "new:" + createItem.id
    : "edit:" + (attempt?.id ?? session?.id);
  const revision = JSON.stringify(createItem ?? original);
  const [restored] = useState(() =>
    loadManualDraft(draftKey, revision, freshValue),
  );
  const [value, setValue] = useState(restored?.value ?? freshValue);
  const base = new Date(
    session?.startedAt ??
      new Date(
        new Date(value!.createdAt).getTime() -
          (value?.durationSeconds ?? 0) * 1000,
      ),
  );
  const [date, setDate] = useState(
    restored?.date ?? initialDate ?? localDate(base),
  );
  const [time, setTime] = useState(
    restored?.time ??
      japanTime(base.toISOString()) + ":" + base.toISOString().slice(17, 19),
  );
  const duration = session?.durationSeconds ?? attempt?.durationSeconds ?? 0;
  const [minutes, setMinutes] = useState(
    restored?.minutes ?? Math.floor(duration / 60),
  );
  const [seconds, setSeconds] = useState(restored?.seconds ?? duration % 60);
  const [note, setNote] = useState(
    restored?.note ?? attempt?.notes ?? session?.note ?? "",
  );
  const [pin, setPin] = useState(
    restored?.pin ??
      attempt?.includeInCoachReport ??
      session?.includeInCoachReport ??
      false,
  );
  const [busy, setBusy] = useState(false);
  const snapshot = JSON.stringify({
    revision,
    value,
    date,
    time,
    minutes,
    seconds,
    note,
    pin,
  });
  const initial = useRef(snapshot);
  const completed = useRef(false);
  const [draftStatus, setDraftStatus] = useState(
    restored ? "下書きを復元しました。記録にはまだ加算されていません。" : "",
  );
  useEffect(() => {
    if (completed.current || (!restored && snapshot === initial.current))
      return;
    const saved = storeManualDraft(draftKey, JSON.parse(snapshot));
    setDraftStatus(
      saved
        ? "下書きを保持しています。前へ・次へ移動しても復元できます。記録への反映は保存後です。"
        : "下書きを保存できません。この画面で記録を保存してから移動してください。",
    );
  }, [snapshot, draftKey, restored]);
  return (
    <form
      className="card record-editor"
      onSubmit={(e) => {
        e.preventDefault();
        const next =
          (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
          "next";
        setBusy(true);
        void action(async () => {
          if (createItem && value)
            await addManualRecord(
              createItem,
              value,
              japanStamp(date, time),
              minutes * 60 + seconds,
              note,
              pin,
            );
          else
            await editRecord(original, {
              attempt: value,
              startedAt: japanStamp(date, time),
              durationSeconds: minutes * 60 + seconds,
              note,
              includeInCoachReport: pin,
            });
          completed.current = true;
          storeManualDraft(draftKey);
          if (next && onSaveNext) onSaveNext(date);
          else if (onSaved) onSaved(date);
          else onDone();
        }, "記録を保存しました。保存済みの報告文は必要に応じて再生成してください。").finally(
          () => setBusy(false),
        );
      }}
    >
      <h3>{createItem ? "学習日・結果を記録" : "学習時間・結果を編集"}</h3>
      <p className="muted" role="status">
        {draftStatus ||
          "入力途中の内容は、このブラウザに下書きとして保持します。"}
      </p>
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
        <textarea
          aria-label="学習メモ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
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
        {createItem && onSaveNext && (
          <button type="submit" value="next" disabled={busy}>
            記録して次へ
          </button>
        )}
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            if (
              draftStatus &&
              !confirm(
                "入力途中の下書きを破棄しますか？保存済みの学習記録は変更しません。",
              )
            )
              return;
            completed.current = true;
            storeManualDraft(draftKey);
            onDone();
          }}
        >
          下書きを破棄
        </button>
      </div>
    </form>
  );
}
