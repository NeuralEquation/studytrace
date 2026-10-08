import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Play,
  Plus,
  Leaf,
  CalendarDays,
  Timer,
} from "lucide-react";
import type { AppData } from "../../types/model";
import { subjectNames, modeNames } from "../../types/model";
import { PageHeader, Progress, Empty } from "../../components/ui";
import {
  studyTimes,
  sprintProgress,
  dailyTarget,
  attemptsInPeriod,
  itemComplete,
} from "../../domain/study";
import { localDate, humanTime } from "../../utils/time";
import { ManualStudy } from "./ManualStudy";
export function Today({ data }: { data: AppData }) {
  const [manual, setManual] = useState(false);
  const today = localDate();
  const times = studyTimes(data.studySessions, today, today);
  const aa = attemptsInPeriod(data, today, today);
  const sprint = data.sprints
    .filter((s) => s.startDate <= today && s.endDate >= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const active = data.studySessions.filter(
    (s) =>
      s.source === "timer" &&
      (!s.endedAt || !data.attempts.some((a) => a.sessionId === s.id)),
  );
  const next = data.coachSessions
    .filter((s) => s.nextSessionAt && new Date(s.nextSessionAt) > new Date())
    .sort((a, b) => a.nextSessionAt!.localeCompare(b.nextSessionAt!))[0];
  const courses = data.courses.filter((c) => !c.archived);
  const directives = data.coachDirectives.filter(
    (d) => d.activeFrom <= today && (!d.activeUntil || d.activeUntil >= today),
  );
  return (
    <>
      <PageHeader
        eyebrow={new Date()
          .toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
          .toUpperCase()}
        title="今日の学習"
        description="一つずつ、できることを確かなものに。"
        actions={
          <button className="secondary" onClick={() => setManual(!manual)}>
            <Plus size={17} />
            学習時間を手入力
          </button>
        }
      />
      {manual && <ManualStudy data={data} onDone={() => setManual(false)} />}
      <div className="today-layout">
        <div className="today-main">
          <section className="sprint-banner">
            <div>
              <span className="eyebrow">CURRENT SPRINT</span>
              <h2>{sprint?.title ?? "今週の学習を計画しよう"}</h2>
              <p>
                {sprint
                  ? `${sprint.startDate.replaceAll("-", ".")} — ${sprint.endDate.replaceAll("-", ".")}`
                  : "講師の方針から、毎日の小さな目標へ。"}
              </p>
            </div>
            <Link className="light-link" to="/sprint">
              {sprint ? "目標を見る" : "Sprintを作成"} <ArrowRight size={18} />
            </Link>
            <div className="sprint-art" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </section>
          {active.map((s) => (
            <Link
              className="resume-banner"
              to={s.itemId ? "/study/" + s.itemId : "/settings"}
              key={s.id}
            >
              <Timer size={18} />
              {data.studyItems.find((i) => i.id === s.itemId)?.title ??
                "未完了の学習"}
              を再開 <ArrowRight size={16} />
            </Link>
          ))}
          <div className="section-heading">
            <h2>今日、取り組むこと</h2>
            <span className="muted">{courses.length} 教材</span>
          </div>
          <div className="task-grid">
            {courses
              .filter((c) => !["japanese", "civics"].includes(c.subject))
              .map((c) => {
                const items = data.studyItems.filter(
                  (i) =>
                    i.courseId === c.id &&
                    !i.archived &&
                    !data.units.find((u) => u.id === i.unitId)?.archived,
                );
                const goal = data.sprintGoals.find(
                  (g) => g.sprintId === sprint?.id && g.courseId === c.id,
                );
                const sp =
                  goal && sprint
                    ? sprintProgress(
                        goal,
                        data,
                        sprint.startDate,
                        sprint.endDate,
                        today,
                      )
                    : undefined;
                const target =
                  goal?.kind === "daily_count"
                    ? dailyTarget(goal, today)
                    : undefined;
                const count = new Set(
                  aa
                    .filter((a) => items.some((i) => i.id === a.itemId))
                    .map((a) => a.itemId),
                ).size;
                const item =
                  items.find(
                    (i) =>
                      i.initialStatus === "UNSEEN" &&
                      !data.attempts.some((a) => a.itemId === i.id),
                  ) ??
                  items.find((i) => !itemComplete(i, data.attempts)) ??
                  items[0];
                const practice = items.find(
                  (i) =>
                    i.studyMode === "practice" &&
                    !itemComplete(i, data.attempts),
                );
                return (
                  <article className={"card task-card " + c.subject} key={c.id}>
                    <div className="row">
                      <span className={"subject-tag " + c.subject}>
                        {subjectNames[c.subject]}
                      </span>
                      <small>{modeNames[c.defaultMode]}</small>
                    </div>
                    <h3>{c.name}</h3>
                    <div className="task-target">
                      <strong>
                        {goal?.kind === "daily_count" ? sp?.actual : count}
                      </strong>
                      <span>
                        {goal?.kind === "daily_count"
                          ? `/ ${target?.min ?? goal.target}${target?.max && target.max !== target.min ? "〜" + target.max : ""} 題`
                          : "項目を記録"}
                      </span>
                    </div>
                    <Progress
                      value={sp?.actual ?? count}
                      max={sp?.target ?? Math.max(1, items.length)}
                    />
                    <p className="next-item">
                      {item
                        ? `${data.units.find((u) => u.id === item.unitId)?.name ?? ""} / ${item.title}`
                        : "章・節・授業を登録して始めましょう"}
                    </p>
                    <Link
                      className="button secondary full"
                      to={item ? "/study/" + item.id : "/courses/" + c.id}
                    >
                      {item ? (
                        <>
                          <Play size={14} />
                          {c.defaultMode === "deep_recall"
                            ? "Deep Study"
                            : c.defaultMode === "video"
                              ? "映像を学習"
                              : "次の授業へ"}
                        </>
                      ) : (
                        <>
                          教材を登録 <Plus size={14} />
                        </>
                      )}
                    </Link>
                    {practice && c.subject === "information" && (
                      <Link
                        className="practice-link"
                        to={"/study/" + practice.id}
                      >
                        関連演習：{practice.title} →
                      </Link>
                    )}
                  </article>
                );
              })}
          </div>
          {!courses.length && (
            <Empty to="/courses">
              教材を登録すると、ここから学習を始められます。
            </Empty>
          )}
          <section className="card commute">
            <div>
              <span className="eyebrow">
                <Leaf size={15} /> COMMUTE & HABIT
              </span>
              <h2>すきま時間も、積み重ねに。</h2>
            </div>
            <div className="commute-links">
              {courses
                .filter((c) => ["japanese", "civics"].includes(c.subject))
                .map((c) => {
                  const item = data.studyItems.find(
                    (i) =>
                      i.courseId === c.id &&
                      !i.archived &&
                      !data.units.find((u) => u.id === i.unitId)?.archived,
                  );
                  return (
                    <Link
                      key={c.id}
                      to={item ? "/study/" + item.id : "/courses/" + c.id}
                    >
                      {c.name}
                      <ArrowRight size={16} />
                    </Link>
                  );
                })}
            </div>
          </section>
        </div>
        <aside className="today-aside">
          <section className="card time-card">
            <span className="eyebrow">TODAY'S STUDY TIME</span>
            <div className="time-total">{humanTime(times.total)}</div>
            <p>今日の積み重ね</p>
            <div className="time-bars">
              {Object.entries(subjectNames).map(([subject, name]) => {
                const seconds = data.courses
                  .filter((c) => c.subject === subject)
                  .reduce((n, c) => n + (times.byCourse[c.id] ?? 0), 0);
                return seconds > 0 ? (
                  <div key={subject}>
                    <div className="row">
                      <span>
                        <i className={"dot " + subject} />
                        {name}
                      </span>
                      <strong>{humanTime(seconds)}</strong>
                    </div>
                    <Progress value={seconds} max={times.total} />
                  </div>
                ) : null;
              })}
              {!times.total && (
                <p className="muted">
                  学習を終えると、教科別の時間がここに表示されます。
                </p>
              )}
            </div>
            <Link to="/analytics">
              学習の記録を見る <ArrowRight size={15} />
            </Link>
          </section>
          <section className="card coach-card">
            <span className="eyebrow">NEXT COACH SESSION</span>
            <CalendarDays size={26} />
            <h2>
              {next?.nextSessionAt
                ? new Date(next.nextSessionAt).toLocaleString("ja-JP", {
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "次回指導を登録"}
            </h2>
            <p>日々の記録を、次の指導へ。</p>
            <Link className="button secondary full" to="/report">
              今週の進捗を見る <ArrowRight size={15} />
            </Link>
          </section>
          {directives.length > 0 && (
            <section className="card">
              <span className="eyebrow">COACH DIRECTIVE</span>
              {directives.slice(0, 4).map((d) => (
                <p key={d.id}>
                  <strong>{subjectNames[d.subject]}</strong>
                  <br />
                  {d.text}
                </p>
              ))}
              <Link to="/coach">すべての方針 →</Link>
            </section>
          )}
          <div className="quiet-note">
            時間だけでなく、
            <br />
            「できるようになったこと」を。
          </div>
        </aside>
      </div>
    </>
  );
}
