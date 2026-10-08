import { useState } from "react";
import type { AppData, StudyMode } from "../../types/model";
import { modeNames, modes, sessionSchema } from "../../types/model";
import { db } from "../../db/database";
import { Field } from "../../components/ui";
import { action } from "../../stores/ui";
import { localDate, uid } from "../../utils/time";
export function ManualStudy({
  data,
  onDone,
}: {
  data: AppData;
  onDone: () => void;
}) {
  const [courseId, setCourse] = useState(
    data.courses.find((c) => !c.archived)?.id ?? "",
  );
  const [mode, setMode] = useState<StudyMode>(
    data.courses.find((c) => c.id === courseId)?.defaultMode ?? "reading",
  );
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState("18:00");
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [pin, setPin] = useState(false);
  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void action(async () => {
          const startedAt = new Date(date + "T" + time).toISOString();
          await db.studySessions.add(
            sessionSchema.parse({
              id: uid(),
              courseId,
              mode,
              startedAt,
              endedAt: new Date(
                new Date(startedAt).getTime() + minutes * 60000,
              ).toISOString(),
              durationSeconds: minutes * 60,
              source: "manual",
              note,
              includeInCoachReport: pin,
            }),
          );
          onDone();
        }, "手動の学習時間を保存しました");
      }}
    >
      <h2>学習時間を手入力</h2>
      <Field label="教材・教科">
        <select
          required
          value={courseId}
          onChange={(e) => {
            setCourse(e.target.value);
            setMode(
              data.courses.find((c) => c.id === e.target.value)!.defaultMode,
            );
          }}
        >
          {data.courses
            .filter((c) => !c.archived)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="学習モード">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as StudyMode)}
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {modeNames[m]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="日付">
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
          value={time}
          onInput={(e) => setTime(e.currentTarget.value)}
          onChange={(e) => setTime(e.target.value)}
        />
      </Field>
      <Field label="学習時間（分）">
        <input
          required
          type="number"
          min={1}
          max={1440}
          value={minutes}
          onChange={(e) => setMinutes(+e.target.value)}
        />
      </Field>
      <Field label="内容・メモ">
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
        <button disabled={!courseId}>保存</button>
        <button className="secondary" type="button" onClick={onDone}>
          閉じる
        </button>
      </div>
    </form>
  );
}
