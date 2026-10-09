import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { AppData } from "../../types/model";
import { subjectNames, bottleneckNames } from "../../types/model";
import { PageHeader, Stat, Progress, Field } from "../../components/ui";
import {
  courseProgress,
  attemptsInPeriod,
  recallScore,
} from "../../domain/study";
import { localDate, dateRange, humanTime } from "../../utils/time";
import { Link } from "react-router-dom";
import { reportedStudyTimes } from "../../features/study/dailyTime";
export function Analytics({ data }: { data: AppData }) {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const [start, setStart] = useState(localDate(d));
  const [end, setEnd] = useState(localDate());
  const times = reportedStudyTimes(data, start, end);
  const aa = attemptsInPeriod(data, start, end);
  const bottlenecks = data.bottlenecks.filter((b) =>
    aa.some((a) => a.id === b.attemptId),
  );
  const chart = dateRange(start, end).map((date) => ({
    日: date.slice(5),
    分: Math.round((times.byDay[date] ?? 0) / 60),
  }));
  const physics = aa.filter((a) => a.mode === "deep_recall");
  const math = aa.filter((a) => a.mode === "reproduction");
  return (
    <>
      <PageHeader
        eyebrow="YOUR LEARNING TRACE"
        title="学習の変化"
        description="時間、正確さ、再現性。それぞれの教科に合った振り返りを。"
      />
      <div className="toolbar">
        <Field label="開始日">
          <input
            type="date"
            value={start}
            onInput={(e) => setStart(e.currentTarget.value)}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="終了日">
          <input
            type="date"
            value={end}
            onInput={(e) => setEnd(e.currentTarget.value)}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      <div className="stats-grid">
        <Stat label="学習時間" value={humanTime(times.total)} />
        <Stat label="演習回数" value={aa.length} />
        <Stat label="記録した詰まり" value={bottlenecks.length} />
        <Stat label="学習日数" value={Object.keys(times.byDay).length} />
      </div>
      <div className="two-columns">
        <section className="card">
          <h2>日ごとの学習時間</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="日" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="分" fill="#477e6b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">
            日別の手入力合計を優先します。未入力の日は個別記録の時間を使います。日付をまたぐ個別記録は開始日に計上します。
          </p>
        </section>
        <section className="card">
          <h2>教科別の記録時間</h2>
          <p className="muted">
            個別記録の内訳です。日別合計は教科に配分しないため、合計と一致しない場合があります。
          </p>
          {Object.entries(subjectNames).map(([s, label]) => {
            const seconds = data.courses
              .filter((c) => c.subject === s)
              .reduce((n, c) => n + (times.byCourse[c.id] ?? 0), 0);
            return (
              <div className="breakdown" key={s}>
                <div className="row">
                  <span>{label}</span>
                  <strong>{humanTime(seconds)}</strong>
                </div>
                <Progress
                  value={seconds}
                  max={Object.values(times.byCourse).reduce((n, s) => n + s, 0)}
                />
              </div>
            );
          })}
        </section>
        <section className="card">
          <h2>数学 · 解法再現度</h2>
          {[1, 2, 3, 4, 5].map((n) => (
            <div className="breakdown" key={n}>
              <div className="row">
                <span>再現度 {n}</span>
                <strong>
                  {math.filter((a) => a.reproducibility === n).length}回
                </strong>
              </div>
              <Progress
                value={math.filter((a) => a.reproducibility === n).length}
                max={math.length}
              />
            </div>
          ))}
        </section>
        <section className="card">
          <h2>物理 · 白紙再現</h2>
          {(
            [
              "setupRecall",
              "reasoningRecall",
              "solutionRecall",
              "overallRecall",
            ] as const
          ).map((key, i) => {
            const value = physics.length
              ? physics.reduce((n, a) => n + recallScore(a.checks)[key], 0) /
                physics.length
              : 0;
            return (
              <div className="breakdown" key={key}>
                <div className="row">
                  <span>
                    {["問題設定", "解法の説明", "最後までの再現", "総合"][i]}
                  </span>
                  <strong>{Math.round(value)}%</strong>
                </div>
                <Progress value={value} />
              </div>
            );
          })}
        </section>
        <section className="card">
          <h2>主なBottleneck</h2>
          {Object.entries(bottleneckNames).map(([key, label]) => {
            const count = bottlenecks.filter((b) => b.type === key).length;
            return count > 0 ? (
              <div className="row breakdown" key={key}>
                <span>{label}</span>
                <strong>{count}回</strong>
              </div>
            ) : null;
          })}
          {!bottlenecks.length && (
            <p className="muted">
              演習中に「詰まった」を記録すると表示されます。
            </p>
          )}
        </section>
        <section className="card">
          <h2>化学 · 問題ごとの時間推移</h2>
          <p className="muted">
            正答時の最速比較と履歴グラフを、各問題で確認できます。
          </p>
          {data.studyItems
            .filter(
              (i) =>
                i.studyMode === "speed" && aa.some((a) => a.itemId === i.id),
            )
            .map((i) => (
              <Link className="list-link" key={i.id} to={"/study/" + i.id}>
                {data.units.find((u) => u.id === i.unitId)?.name} / {i.title} →
              </Link>
            ))}
        </section>
      </div>
      <section className="card">
        <h2>教材の現在の進捗</h2>
        {data.courses
          .filter((c) => !c.archived)
          .map((c) => {
            const p = courseProgress(
              data.studyItems.filter((i) => i.courseId === c.id),
              data.attempts,
            );
            return (
              <div className="breakdown" key={c.id}>
                <div className="row">
                  <Link to={"/courses/" + c.id}>{c.name}</Link>
                  <span>
                    {p.attempted}/{p.total} 取り組み済み · 完了 {p.completed}
                  </span>
                </div>
                <Progress value={p.attempted} max={p.total} />
              </div>
            );
          })}
      </section>
    </>
  );
}
