import { Link } from "react-router-dom";
import { ArrowRight, Play, Timer } from "lucide-react";
import type { AppData } from "../../types/model";
import { subjectNames } from "../../types/model";
import { PageHeader, Progress, Empty } from "../../components/ui";
import { attemptsInPeriod, goalItems, itemComplete } from "../../domain/study";
import { goalState, todayTasks } from "../../domain/planning";
import type { TodayTask } from "../../domain/planning";
import { studyDay, holidayCoverage } from "../../domain/calendar";
import { localDate, humanTime } from "../../utils/time";
import { reportedStudyTimes } from "../../features/study/dailyTime";
import { RememberedDetails } from "../../components/RememberedDetails";
export function Today({ data }: { data: AppData }) {
  const today = localDate(),
    day = studyDay(today),
    tasks = todayTasks(data, today);
  const active = data.studySessions.filter(
    (s) =>
      s.source === "timer" &&
      !s.deletedAt &&
      (!s.endedAt ||
        !data.attempts.some((a) => a.sessionId === s.id && !a.deletedAt)),
  );
  const directives = data.coachDirectives
    .filter(
      (d) =>
        d.activeFrom <= today && (!d.activeUntil || d.activeUntil >= today),
    )
    .sort(
      (a, b) =>
        ({ high: 0, normal: 1, low: 2 })[a.priority] -
          { high: 0, normal: 1, low: 2 }[b.priority] ||
        a.id.localeCompare(b.id),
    );
  const next = data.coachSessions
    .filter((s) => s.nextSessionAt && new Date(s.nextSessionAt) > new Date())
    .sort((a, b) => a.nextSessionAt!.localeCompare(b.nextSessionAt!))[0];
  function taskCard(t: TodayTask) {
    const g = t.goal,
      state = g ? goalState(g, data, today) : undefined;
    const items = (
      g
        ? goalItems(g, data)
        : data.studyItems.filter((i) =>
            t.courses.some((c) => c.id === i.courseId),
          )
    ).filter(
      (i) =>
        !i.archived && !data.units.find((u) => u.id === i.unitId)?.archived,
    );
    const item =
      items.find(
        (i) =>
          i.initialStatus === "UNSEEN" &&
          !data.attempts.some((a) => a.itemId === i.id && !a.deletedAt),
      ) ??
      items.find((i) => !itemComplete(i, data.attempts)) ??
      items[0];
    const count = new Set(
      attemptsInPeriod(data, today, today)
        .filter((a) => items.some((i) => i.id === a.itemId))
        .map((a) => a.itemId),
    ).size;
    const label =
      g?.kind === "daily_count"
        ? "今日"
        : g?.kind === "weekly_count"
          ? g.weeklyPeriod === "calendar"
            ? "今週"
            : "Sprint期間内"
          : g?.kind === "course_progress"
            ? "累積完了"
            : "進捗";
    return (
      <article
        className={"card task-card " + (t.courses[0]?.subject ?? "other")}
        key={t.id}
      >
        <div className="row">
          <span className={"subject-tag " + (t.courses[0]?.subject ?? "other")}>
            {[...new Set(t.courses.map((c) => subjectNames[c.subject]))].join(
              "・",
            )}
          </span>
          <small>{g ? label : "ノルマ未設定"}</small>
        </div>
        <h3>{g?.title ?? t.courses[0]?.name}</h3>
        <div className="task-target">
          <strong>{state?.actual ?? count}</strong>
          <span>
            {state?.configured
              ? ` / ${state.target} ${g?.kind === "specific_task" ? "件" : "題"}`
              : " 項目を記録"}
          </span>
        </div>
        {state?.configured && (
          <>
            <Progress value={state.actual} max={state.target} />
            <p>
              {state.achieved
                ? "最低ノルマ達成"
                : `最低ノルマまであと${state.remaining}題`}
              {state.max !== undefined ? ` · 推奨上限${state.max}題` : ""}
            </p>
          </>
        )}
        {state && !state.configured && (
          <p>
            目標未設定 · <Link to="/sprint">ノルマを設定</Link>
          </p>
        )}
        <p className="next-item">
          {item
            ? `${data.units.find((u) => u.id === item.unitId)?.chapter ?? ""} / ${data.units.find((u) => u.id === item.unitId)?.name ?? ""} / ${item.title}`
            : "対象の授業・問題を登録してください"}
        </p>
        <Link
          className="button secondary full"
          to={
            item ? "/study/" + item.id : "/courses/" + (t.courses[0]?.id ?? "")
          }
        >
          <Play size={14} />
          {item ? "次の授業・問題へ" : "教材を確認"}
        </Link>
        {g && (
          <div className="task-course-links">
            {t.courses.map((c) => (
              <Link key={c.id} to={"/courses/" + c.id}>
                {c.name} →
              </Link>
            ))}
          </div>
        )}
      </article>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow={
          today + " · " + (day.holiday ?? (day.weekend ? "土日" : "平日"))
        }
        title="今日の学習"
        description={
          day.restDay
            ? "土日・祝日のノルマを適用しています。"
            : "平日のノルマを適用しています。"
        }
        actions={
          <>
            {active[0] && (
              <Link
                className="button secondary"
                to={
                  active[0].itemId
                    ? "/study/" + active[0].itemId
                    : "/records?tab=history"
                }
              >
                途中の学習を再開（{active.length}件）
              </Link>
            )}
            <Link className="button secondary" to="/sprint">
              計画・優先順位を編集
            </Link>
          </>
        }
      />
      {!day.known && (
        <p className="warning">
          祝日データは{holidayCoverage.firstYear}〜{holidayCoverage.lastYear}
          年を収録しています。この年の祝日は未確認です。
        </p>
      )}
      {!tasks.length && (
        <Empty to="/courses">教材を登録して学習を始めましょう。</Empty>
      )}
      {[
        "今日の優先タスク",
        "今週・期間内の目標",
        "達成済み",
        "その他の教材",
      ].map((title, n) => {
        const rows = tasks.filter((t) => t.category === n);
        if (!rows.length) return null;
        const content = <div className="task-grid">{rows.map(taskCard)}</div>;
        return n >= 2 ? (
          <RememberedDetails
            className="task-group"
            key={title}
            viewKey={"today:group:" + n}
            defaultOpen={n === 3}
          >
            <summary>
              {title}（{rows.length}）
            </summary>
            {content}
          </RememberedDetails>
        ) : (
          <section key={title}>
            <div className="section-heading">
              <h2>{title}</h2>
              <span className="muted">{rows.length}件</span>
            </div>
            {content}
          </section>
        );
      })}
      {active.length > 0 && (
        <section aria-label="未完了の学習">
          <h2>途中の学習を再開</h2>
          {active.map((s) => (
            <Link
              className="resume-banner"
              key={s.id}
              to={s.itemId ? "/study/" + s.itemId : "/records"}
            >
              <Timer size={18} />
              {data.studyItems.find((i) => i.id === s.itemId)?.title ??
                "未完了の学習"}
              を再開
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
      )}
      {(next || directives.length > 0) && (
        <section className="card">
          <h2>Coachからの大切なこと</h2>
          {next?.nextSessionAt && (
            <p>
              次回指導：
              {new Date(next.nextSessionAt).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
              })}
            </p>
          )}
          {directives.map((d) => (
            <p key={d.id}>
              <strong>
                {subjectNames[d.subject]} ·{" "}
                {d.priority === "high"
                  ? "優先"
                  : d.priority === "low"
                    ? "補助"
                    : "標準"}
              </strong>{" "}
              {d.text}
            </p>
          ))}
          <Link to="/coach">指導方針を見る →</Link> ·{" "}
          <Link to="/report">進捗報告 →</Link>
        </section>
      )}
      <footer className="card compact-time">
        <span>
          今日の勉強時間：
          <strong>
            {humanTime(reportedStudyTimes(data, today, today).total)}
          </strong>
        </span>
        <Link to="/records?tab=time">記録・編集 →</Link>
      </footer>
    </>
  );
}
