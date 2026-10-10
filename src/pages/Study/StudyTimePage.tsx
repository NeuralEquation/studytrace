import { useState } from "react";
import type { AppData } from "../../types/model";
import { DailyStudyTime } from "../Today/DailyStudyTime";
import { ManualStudy } from "../Today/ManualStudy";
import {
  dailyEntries,
  reportedStudyTimes,
} from "../../features/study/dailyTime";
import { humanTime, localDate } from "../../utils/time";
export function StudyTimePage({ data }: { data: AppData }) {
  const [manual, setManual] = useState(false);
  const today = localDate();
  const dates = [
    ...new Set([
      ...dailyEntries(data).map((d) => d.date),
      ...data.studySessions
        .filter((s) => s.endedAt && !s.deletedAt)
        .map((s) => localDate(s.startedAt)),
    ]),
  ]
    .sort()
    .reverse();
  return (
    <div id="record-time" role="tabpanel" aria-label="勉強時間">
      <section className="card">
        <h2>
          今日の合計：{humanTime(reportedStudyTimes(data, today, today).total)}
        </h2>
        <p>
          日別の手入力合計を優先します。未入力の日だけ個別記録を合計し、両方は加算しません。0時間の保存も有効です。
        </p>
      </section>
      <DailyStudyTime data={data} />
      <section className="card">
        <h2>教科・教材を指定して記録</h2>
        <button className="secondary" onClick={() => setManual(!manual)}>
          手動時間記録を{manual ? "閉じる" : "追加"}
        </button>
        <p>保存後の修正・削除・復元は「学習履歴」タブで行えます。</p>
      </section>
      {manual && <ManualStudy data={data} onDone={() => setManual(false)} />}
      <section className="card">
        <h2>日別の集計</h2>
        <p>
          教科別内訳は個別記録に基づくため、手入力合計と一致しない場合があります。
        </p>
        <div className="time-summary-list">
          {dates.map((date) => {
            const t = reportedStudyTimes(data, date, date);
            return (
              <details key={date}>
                <summary>
                  {date} · {humanTime(t.total)} ·{" "}
                  {t.manual.length ? "手入力合計" : "個別記録の合計"}
                </summary>
                {Object.entries(t.byCourse).map(([id, seconds]) => (
                  <p key={id}>
                    {data.courses.find((c) => c.id === id)?.name ?? id}：
                    {humanTime(seconds)}
                  </p>
                ))}
              </details>
            );
          })}
          {!dates.length && <p>記録を保存すると日別集計が表示されます。</p>}
        </div>
      </section>
    </div>
  );
}
