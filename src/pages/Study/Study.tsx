import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Play, Square, Flag, AlertCircle } from "lucide-react";
import type {
  AppData,
  Attempt,
  StudyItem,
  StudySession,
  Bottleneck,
} from "../../types/model";
import { attemptSchema, bottleneckNames, modeNames } from "../../types/model";
import { PageHeader, Empty, ExternalLink, Field } from "../../components/ui";
import {
  startTimedStudy as startStudy,
  stopStudy,
  finishStudy,
  newAttempt,
} from "../../features/study/session";
import { personalBest, chronological } from "../../domain/study";
import { db } from "../../db/database";
import { action, useUI } from "../../stores/ui";
import { clock, now, uid, elapsed } from "../../utils/time";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Records } from "./Records";
import { ModeForm } from "./ModeForm";
import { timerAllowed } from "../../features/study/timerPolicy";
import { RecordEditor } from "./RecordEditor";
export function Study({
  data,
  rawData = data,
}: {
  data: AppData;
  rawData?: AppData;
}) {
  const { id } = useParams();
  const [entryVersion, setEntryVersion] = useState(0);
  const item = data.studyItems.find((i) => i.id === id);
  if (!item)
    return (
      <Empty to="/courses">
        学習項目が見つかりません。教材一覧から選び直してください。
      </Empty>
    );
  const session = data.studySessions.find(
    (s) =>
      s.itemId === id &&
      (!s.endedAt || !data.attempts.some((a) => a.sessionId === s.id)),
  );
  const history = data.attempts
    .filter((a) => a.itemId === id)
    .sort(chronological);
  const pb = personalBest(history);
  const last = history.at(-1);
  const timing = timerAllowed(data, item);
  return (
    <>
      <PageHeader
        eyebrow={modeNames[item.studyMode]}
        title={item.title}
        description={`${data.courses.find((c) => c.id === item.courseId)?.name} / ${data.units.find((u) => u.id === item.unitId)?.chapter ? data.units.find((u) => u.id === item.unitId)?.chapter + " / " : ""}${data.units.find((u) => u.id === item.unitId)?.name}`}
        actions={
          <ExternalLink
            url={
              item.externalUrl ??
              data.courses.find((c) => c.id === item.courseId)?.externalUrl
            }
          />
        }
      />
      <Link to={"/courses/" + item.courseId}>← 教材へ</Link>
      {session ? (
        <ActiveStudy
          key={session.id}
          item={item}
          session={session}
          data={data}
          timing={timing}
        />
      ) : !timing ? (
        <section>
          <p className="muted">
            この授業の時間計測は休止中です。学習日と結果を記録してください。
          </p>
          <RecordEditor
            key={item.id + ":" + entryVersion}
            createItem={item}
            onDone={() => setEntryVersion((n) => n + 1)}
          />
        </section>
      ) : (
        <section className="card start-card">
          {item.studyMode === "speed" && (
            <div className="pb-summary">
              <div>
                Current best
                <strong>{pb.best === undefined ? "—" : clock(pb.best)}</strong>
              </div>
              <div>
                Last attempt
                <strong>
                  {last?.durationSeconds === undefined
                    ? "—"
                    : clock(last.durationSeconds)}
                </strong>
              </div>
            </div>
          )}
          <h2>
            {item.studyMode === "deep_recall"
              ? "白紙から、設定と解法を説明する。"
              : "準備ができたら、始めましょう。"}
          </h2>
          <p>開始時刻は自動保存されます。画面を閉じても再開できます。</p>
          <button
            className="large-button"
            onClick={() => void action(() => startStudy(item))}
          >
            <Play size={20} />
            {item.studyMode === "deep_recall" ? "START DEEP STUDY" : "START"}
          </button>
        </section>
      )}
      {item.studyMode === "speed" &&
        history.filter((a) => a.durationSeconds !== undefined).length > 1 && (
          <section className="card">
            <h2>所要時間の推移</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={history
                  .filter((a) => a.durationSeconds !== undefined)
                  .map((a, i) => ({
                    回: i + 1,
                    秒: a.durationSeconds ?? 0,
                  }))}
              >
                <XAxis dataKey="回" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="秒"
                  stroke="#285bb5"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
        )}
      <Records data={rawData} itemId={item.id} />
    </>
  );
}
function ActiveStudy({
  item,
  session,
  data,
  timing,
}: {
  item: StudyItem;
  session: StudySession;
  data: AppData;
  timing: boolean;
}) {
  const navigate = useNavigate();
  const [tick, setTick] = useState(Date.now());
  const [value, setValue] = useState<Attempt>(() => {
    const parsed = attemptSchema.safeParse(
      data.settings.find((s) => s.key === "runner:" + session.id)?.value,
    );
    return parsed.success ? parsed.data : newAttempt(item, session.id);
  });
  const [busy, setBusy] = useState(false);
  const [showB, setShowB] = useState(false);
  const [type, setType] = useState<Bottleneck["type"]>("strategy");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    if (!timing) {
      if (!session.endedAt)
        void action(
          () => stopStudy(session.id),
          "休止対象の以前の計測を終了しました。結果を保存してください。",
        );
      return;
    }
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [timing, session.id, session.endedAt]);
  const seconds = session.endedAt
    ? session.durationSeconds
    : elapsed(session.startedAt, tick);
  function change(a: Attempt) {
    setValue(a);
    setSaved(false);
    void action(async () => {
      await db.settings.put({ key: "runner:" + session.id, value: a });
      setSaved(true);
    });
  }
  async function save() {
    setBusy(true);
    await action(async () => {
      await finishStudy(value);
      if (value.mode === "speed") {
        const completed = {
          ...value,
          durationSeconds: seconds,
          createdAt: now(),
        };
        const pb = personalBest(data.attempts, completed);
        useUI
          .getState()
          .notify(
            pb.isNewBest
              ? `NEW BEST！ ${clock(seconds)}${pb.improvement !== undefined ? ` / ${clock(pb.improvement)}短縮（${pb.percent!.toFixed(1)}%）` : ""}`
              : "学習を保存しました",
          );
      } else
        useUI
          .getState()
          .notify("学習を保存しました。今日の積み重ねに反映しました。");
      navigate("/");
    });
    setBusy(false);
  }
  return (
    <div className="runner-layout">
      <div>
        <section
          className={
            "card timer-card " +
            (item.studyMode === "deep_recall" ? "quiet-timer" : "")
          }
        >
          <div>
            <span className="eyebrow">
              {session.endedAt ? "STOPPED · 結果を記録" : "STUDY IN PROGRESS"}
            </span>
            <div
              className={"timer " + (item.studyMode === "speed" ? "large" : "")}
            >
              {clock(seconds)}
            </div>
          </div>
          {!session.endedAt && (
            <button
              className="secondary"
              onClick={() => void action(() => stopStudy(session.id))}
            >
              <Square size={16} />
              STOP
            </button>
          )}
          {session.endedAt && (
            <Field
              label="実際の学習時間（秒）"
              hint="閉じていた時間を除く場合は修正できます。"
            >
              <input
                type="number"
                min={0}
                value={session.durationSeconds}
                onChange={(e) =>
                  void action(() =>
                    db.studySessions.update(session.id, {
                      durationSeconds: Math.max(0, +e.target.value),
                    }),
                  )
                }
              />
            </Field>
          )}
        </section>
        <form
          className="card mode-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <ModeForm value={value} onChange={change} />
          <Field label="学習メモ">
            <textarea
              placeholder="できたこと、次回気をつけること…"
              value={value.notes}
              onChange={(e) => change({ ...value, notes: e.target.value })}
            />
          </Field>
          <div className="row">
            <label className="check">
              <input
                type="checkbox"
                checked={value.includeInCoachReport}
                onChange={(e) =>
                  change({ ...value, includeInCoachReport: e.target.checked })
                }
              />
              <Flag size={15} />
              指導で報告
            </label>
            <small role="status">
              {saved ? "入力内容を保存済み" : "保存中…"}
            </small>
          </div>
          <button className="large-button full" disabled={busy}>
            {session.endedAt
              ? "結果を保存してTodayへ"
              : "終了・結果を保存してTodayへ"}
          </button>
        </form>
      </div>
      <aside>
        <section className="card bottleneck-card">
          <span className="eyebrow">TRACE THE DIFFICULTY</span>
          <h2>詰まりを、残しておく。</h2>
          <p>解き終わる前でも、その瞬間の気づきを記録できます。</p>
          <button className="secondary full" onClick={() => setShowB(!showB)}>
            <AlertCircle size={17} />
            詰まった
          </button>
          {showB && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await db.bottlenecks.add({
                    id: uid(),
                    attemptId: session.id,
                    elapsedSeconds: seconds,
                    type,
                    note,
                    createdAt: now(),
                  });
                  setNote("");
                  setShowB(false);
                }, "詰まりを保存しました");
              }}
            >
              <Field label="詰まりの種類">
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as Bottleneck["type"])
                  }
                >
                  {Object.entries(bottleneckNames).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="そのときのメモ">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <button>詰まりを記録</button>
            </form>
          )}
          {data.bottlenecks
            .filter((b) => b.attemptId === session.id)
            .map((b) => (
              <div className="bottleneck-entry" key={b.id}>
                <small>
                  {clock(b.elapsedSeconds ?? 0)} · {bottleneckNames[b.type]}
                </small>
                <p>{b.note}</p>
              </div>
            ))}
        </section>
        <p className="quiet-note">
          記録は自動保存。
          <br />
          次の「できた」につなげよう。
        </p>
      </aside>
    </div>
  );
}
