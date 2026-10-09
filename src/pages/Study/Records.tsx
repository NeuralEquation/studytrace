import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AppData, Attempt, StudySession } from "../../types/model";
import { modeNames } from "../../types/model";
import { PageHeader, Empty } from "../../components/ui";
import { clock, localDate } from "../../utils/time";
import { RecordEditor } from "./RecordEditor";
import { setRecordDeleted } from "../../features/study/records";
import { startTimedStudy as startStudy } from "../../features/study/session";
import { timerAllowed } from "../../features/study/timerPolicy";
import { AddRecord } from "./AddRecord";
import { DailyStudyTime } from "../Today/DailyStudyTime";
import { action } from "../../stores/ui";
import { attemptDescription } from "../../features/study/description";

export function Records({ data, itemId }: { data: AppData; itemId?: string }) {
  const [trash, setTrash] = useState(false);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string>();
  const [confirm, setConfirm] = useState<string>();
  const navigate = useNavigate();
  const rows: { id: string; attempt?: Attempt; session?: StudySession }[] =
    data.attempts.map((a) => ({
      id: a.id,
      attempt: a,
      session: data.studySessions.find((s) => s.id === a.sessionId),
    }));
  rows.push(
    ...data.studySessions
      .filter((s) => !data.attempts.some((a) => a.sessionId === s.id))
      .map((s) => ({ id: s.id, session: s })),
  );
  const visible = rows
    .filter(
      (r) =>
        !date ||
        localDate(r.session?.startedAt ?? r.attempt!.createdAt) === date,
    )
    .filter(
      (r) =>
        (!itemId || (r.attempt?.itemId ?? r.session?.itemId) === itemId) &&
        !!(r.attempt?.deletedAt || r.session?.deletedAt) === trash,
    )
    .filter((r) =>
      [
        data.studyItems.find(
          (i) => i.id === (r.attempt?.itemId ?? r.session?.itemId),
        )?.title,
        data.courses.find((c) => c.id === r.session?.courseId)?.name,
        r.attempt?.notes,
        r.session?.note,
      ]
        .join(" ")
        .includes(search),
    )
    .sort((a, b) =>
      (b.session?.startedAt ?? b.attempt!.createdAt).localeCompare(
        a.session?.startedAt ?? a.attempt!.createdAt,
      ),
    );
  return (
    <section className={itemId ? "record-section" : ""}>
      {itemId ? (
        <h2>学習記録</h2>
      ) : (
        <PageHeader
          title="学習記録"
          eyebrow="RECORDS"
          description="今日・前日以前の記録を追加し、日付・時間・結果を編集できます。"
        />
      )}
      {!itemId && <DailyStudyTime data={data} />}
      <button className="secondary" onClick={() => setAdding(!adding)}>
        過去日・今日の記録を追加
      </button>
      {adding && (
        <AddRecord
          data={data}
          itemId={itemId}
          onDone={() => setAdding(false)}
        />
      )}
      <div className="toolbar">
        <label>
          記録の日付
          <input
            aria-label="記録の日付"
            type="date"
            value={date}
            onInput={(e) => setDate(e.currentTarget.value)}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {date && (
          <button className="secondary" onClick={() => setDate("")}>
            全日付を表示
          </button>
        )}
        <input
          aria-label="記録を検索"
          placeholder="授業名・メモを検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={trash}
            onChange={(e) => {
              setTrash(e.target.checked);
              setEditing(undefined);
              setConfirm(undefined);
            }}
          />
          削除済みを表示
        </label>
      </div>
      {visible.length === 0 && (
        <Empty>
          {trash ? "削除済みの記録はありません。" : "学習記録はありません。"}
        </Empty>
      )}
      {visible.map(({ id, attempt: a, session: s }) => {
        const item = data.studyItems.find(
          (i) => i.id === (a?.itemId ?? s?.itemId),
        );
        const pending = s && (!s.endedAt || (s.itemId && !a));
        return (
          <article key={id} className="card record-card">
            <div className="record-summary">
              <div>
                <small>
                  {new Date(s?.startedAt ?? a!.createdAt).toLocaleString()} ·{" "}
                  {modeNames[a?.mode ?? s!.mode]}
                </small>
                {item && (
                  <small className="record-location">
                    {data.courses.find((c) => c.id === item.courseId)?.name} /{" "}
                    {data.units.find((u) => u.id === item.unitId)?.chapter} /{" "}
                    {data.units.find((u) => u.id === item.unitId)?.name}
                  </small>
                )}
                <h3>
                  {item ? (
                    <Link to={"/study/" + item.id}>{item.title}</Link>
                  ) : (
                    data.courses.find((c) => c.id === s?.courseId)?.name
                  )}
                </h3>
                <p>
                  {a
                    ? attemptDescription(a)
                    : pending
                      ? "計測・結果入力中"
                      : "時間の手入力"}{" "}
                  ·{" "}
                  <strong>
                    {a && a.durationSeconds === undefined && !s?.durationSeconds
                      ? "未計測"
                      : clock(s?.durationSeconds ?? a?.durationSeconds ?? 0)}
                  </strong>
                </p>
                {(a?.notes ?? s?.note) && (
                  <p className="prewrap">{a?.notes ?? s?.note}</p>
                )}
              </div>
              <div className="actions">
                {trash ? (
                  <button
                    className="secondary"
                    onClick={() =>
                      void action(
                        () => setRecordDeleted(a?.id, s?.id, false),
                        "記録を復元しました",
                      )
                    }
                  >
                    復元
                  </button>
                ) : (
                  <>
                    {pending && item ? (
                      <Link
                        className="button secondary"
                        to={"/study/" + item.id}
                      >
                        再開
                      </Link>
                    ) : (
                      <button
                        className="secondary"
                        onClick={() =>
                          setEditing(editing === id ? undefined : id)
                        }
                      >
                        時間・結果を編集
                      </button>
                    )}
                    {item && !pending && timerAllowed(data, item) && (
                      <button
                        className="secondary"
                        onClick={() =>
                          void action(async () => {
                            await startStudy(item);
                            navigate("/study/" + item.id);
                          }, "前回の記録を残して、新しく計測します")
                        }
                      >
                        再計測
                      </button>
                    )}
                    {(!s || s.endedAt) && (
                      <button
                        className="text-button danger"
                        onClick={() => setConfirm(id)}
                      >
                        削除
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {confirm === id && (
              <div className="warning">
                <p>
                  この学習時間と結果を削除し、進捗・集計から除外します。「削除済みを表示」から復元できます。
                </p>
                <div className="actions">
                  <button
                    onClick={() =>
                      void action(async () => {
                        await setRecordDeleted(a?.id, s?.id, true);
                        setConfirm(undefined);
                        setEditing(undefined);
                      }, "記録を削除しました。保存済みの報告文は自動では変わりません。")
                    }
                  >
                    この記録を削除
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setConfirm(undefined)}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
            {editing === id && !trash && (
              <RecordEditor
                attempt={a}
                session={s}
                onDone={() => setEditing(undefined)}
              />
            )}
          </article>
        );
      })}
    </section>
  );
}
