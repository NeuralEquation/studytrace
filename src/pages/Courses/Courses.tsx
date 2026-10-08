import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Plus, BookOpen } from "lucide-react";
import type { AppData, StudyItem, Unit } from "../../types/model";
import { subjectNames, modeNames } from "../../types/model";
import {
  PageHeader,
  Progress,
  Empty,
  ExternalLink,
  Stat,
} from "../../components/ui";
import { CourseEditor, ItemEditor, UnitEditor } from "./CourseEditor";
import {
  courseProgress,
  itemComplete,
  mathStatus,
  videoPace,
} from "../../domain/study";
import { catalog } from "../../features/courses/catalog";
import { CatalogPanel } from "./CatalogPanel";
import { db } from "../../db/database";
import { action } from "../../stores/ui";
import {
  deleteUnusedUnit,
  unitDeletionInfo,
} from "../../features/courses/deleteUnit";
export function Courses({ data }: { data: AppData }) {
  const { id } = useParams();
  const [showCatalog, setShowCatalog] = useState(false);
  const [subject, setSubject] = useState("");
  const [expand, setExpand] = useState(false);
  const [editing, setEditing] = useState(false);
  const [unitEdit, setUnitEdit] = useState<Unit | "new" | null>(null);
  const [itemEdit, setItemEdit] = useState<{
    unitId: string;
    item?: StudyItem;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<string | null>(null);
  const course = data.courses.find((c) => c.id === id);
  if (id && !course)
    return (
      <Empty to="/courses">
        教材が見つかりません。設定からバックアップを確認してください。
      </Empty>
    );
  const visible = data.studyItems.filter(
    (i) => i.courseId === id && (showArchived || !i.archived),
  );
  const activeItems = visible.filter(
    (i) => !data.units.find((u) => u.id === i.unitId)?.archived,
  );
  const p = courseProgress(activeItems, data.attempts);
  const videoProgress = courseProgress(
    activeItems.filter((i) => i.studyMode === "video"),
    data.attempts,
  );
  const practiceProgress = courseProgress(
    activeItems.filter((i) => i.studyMode === "practice"),
    data.attempts,
  );
  return (
    <>
      <PageHeader
        eyebrow="YOUR LEARNING LIBRARY"
        title={course?.name ?? "講座・授業"}
        description={
          course
            ? "章と節から授業を選び、学習時間と結果を記録。"
            : "学習する講座を選んでください。"
        }
        actions={
          <button onClick={() => setEditing(!editing)}>
            <Plus size={16} />
            {course ? "教材を編集" : "教材を追加"}
          </button>
        }
      />
      {!course && (
        <div className="toolbar">
          <button onClick={() => setShowCatalog(!showCatalog)}>
            登録サイトの講座を追加
          </button>
          <input
            aria-label="講座を検索"
            placeholder="講座名を検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="教科で絞り込む"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">すべての教科</option>
            {Object.entries(subjectNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}
      {(showCatalog || !!course) && (
        <CatalogPanel data={data} course={course} />
      )}
      {editing && (
        <CourseEditor course={course} onDone={() => setEditing(false)} />
      )}
      <div className="toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          非表示の教材・単元・項目も表示
        </label>
        {course && (
          <>
            <Link to="/courses">← 教材一覧</Link>
            <ExternalLink url={course.externalUrl} />
            <button
              className="text-button"
              onClick={() =>
                void action(
                  () =>
                    db.courses.update(course.id, {
                      archived: !course.archived,
                    }),
                  "教材の表示状態を更新しました",
                )
              }
            >
              {course.archived ? "教材を復元" : "教材をアーカイブ"}
            </button>
          </>
        )}
      </div>
      {!course ? (
        <div className="course-grid">
          {data.courses
            .filter(
              (c) =>
                (showArchived || !c.archived) &&
                (!subject || c.subject === subject) &&
                c.name.includes(search),
            )
            .sort((a, b) => {
              const ai = catalog.findIndex((c) => c.id === a.catalogId);
              const bi = catalog.findIndex((c) => c.id === b.catalogId);
              return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
            })
            .map((c) => {
              const p = courseProgress(
                data.studyItems.filter(
                  (i) =>
                    i.courseId === c.id &&
                    !data.units.find((u) => u.id === i.unitId)?.archived,
                ),
                data.attempts,
              );
              return (
                <Link
                  className={`card course-card ${c.subject}`}
                  to={"/courses/" + c.id}
                  key={c.id}
                >
                  <div className={"course-cover " + c.subject}>
                    <span>
                      {c.name.match(/【(.+?)】/)?.[1] ??
                        subjectNames[c.subject]}
                    </span>
                    <BookOpen size={46} strokeWidth={1.2} />
                    <small>{c.teacher || "学習ノート"}</small>
                  </div>
                  <div className="course-card-body">
                    <div className="row">
                      <span className={"subject-tag " + c.subject}>
                        {subjectNames[c.subject]}
                      </span>
                      <BookOpen size={19} />
                    </div>
                    <h2>{c.name}</h2>
                    <p>
                      {modeNames[c.defaultMode]}
                      {c.archived ? " · アーカイブ" : ""}
                    </p>
                    <div className="row">
                      <strong>
                        {p.attempted}{" "}
                        <span className="muted">/ {p.total || "未登録"}</span>
                      </strong>
                      <ArrowRight size={18} />
                    </div>
                    <Progress value={p.attempted} max={p.total} />
                    <small>取り組み済み · 完了 {p.completed}授業</small>
                  </div>
                </Link>
              );
            })}
          {!data.courses.length && (
            <Empty>「教材を追加」から始めましょう。</Empty>
          )}
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <Stat label="取り組み済み" value={`${p.attempted} / ${p.total}`} />
            <Stat label="完了" value={p.completed} />
            {course.subject === "mathematics" ? (
              <>
                <Stat label="再現可能（安定を含む）" value={p.reproducible} />
                <Stat label="安定" value={p.stable} />
              </>
            ) : (
              <Stat label="未着手" value={p.remaining} />
            )}
          </div>
          {course.subject === "information" && (
            <div className="stats-grid">
              <Stat
                label="映像講義の完了"
                value={`${videoProgress.completed} / ${videoProgress.total}`}
              />
              <Stat
                label="関連演習の完了"
                value={`${practiceProgress.completed} / ${practiceProgress.total}`}
                sub="Programmingを含む"
              />
            </div>
          )}
          {visible.some((i) => i.studyMode === "video") && (
            <p className="callout">
              {videoPace(
                visible.filter((i) => i.studyMode === "video").length,
                visible.filter(
                  (i) =>
                    i.studyMode === "video" && itemComplete(i, data.attempts),
                ).length,
                course.planStartDate,
                course.targetDate,
              )}
            </p>
          )}
          <div className="toolbar">
            <input
              aria-label="授業を検索"
              placeholder="授業名・章・節を検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="secondary" onClick={() => setUnitEdit("new")}>
              <Plus size={16} />
              節を追加
            </button>
          </div>
          {unitEdit && (
            <UnitEditor
              key={unitEdit === "new" ? "new" : unitEdit.id}
              courseId={course.id}
              unit={unitEdit === "new" ? undefined : unitEdit}
              onDone={() => setUnitEdit(null)}
            />
          )}
          <div className="toolbar">
            <button className="secondary" onClick={() => setExpand(!expand)}>
              {expand ? "すべて折りたたむ" : "すべて開く"}
            </button>
          </div>
          <div className="unit-list">
            {[
              ...new Set(
                data.units
                  .filter(
                    (u) =>
                      u.courseId === id &&
                      (showArchived || !u.archived) &&
                      (!search ||
                        visible.some(
                          (i) =>
                            i.unitId === u.id &&
                            [i.title, u.name, u.chapter]
                              .join(" ")
                              .includes(search),
                        )),
                  )
                  .sort((a, b) => a.order - b.order)
                  .map((u) => u.chapter || "その他・既存の登録"),
              ),
            ].map((chapter) => (
              <details
                className="chapter-group"
                key={chapter + expand + !!search}
                open={expand || !!search || undefined}
              >
                <summary>
                  {chapter}
                  <span>
                    {
                      data.units.filter(
                        (u) =>
                          u.courseId === id &&
                          (u.chapter || "その他・既存の登録") === chapter &&
                          (showArchived || !u.archived),
                      ).length
                    }
                    節
                  </span>
                </summary>
                {data.units
                  .filter(
                    (u) =>
                      u.courseId === id &&
                      (u.chapter || "その他・既存の登録") === chapter &&
                      (showArchived || !u.archived) &&
                      (!search ||
                        visible.some(
                          (i) =>
                            i.unitId === u.id &&
                            [i.title, u.name, u.chapter]
                              .join(" ")
                              .includes(search),
                        )),
                  )
                  .sort((a, b) => a.order - b.order)
                  .map((u) => (
                    <details
                      className="card unit-card"
                      key={u.id + expand + !!search}
                      open={expand || !!search || undefined}
                    >
                      <summary>
                        <span>
                          {u.name}
                          {u.archived ? "（非表示）" : ""}
                        </span>
                        <small>
                          {visible.filter((i) => i.unitId === u.id).length}授業
                        </small>
                      </summary>
                      <div className="row">
                        <small>節の管理</small>
                        <div className="actions">
                          <button
                            className="text-button"
                            onClick={() => setUnitEdit(u)}
                          >
                            編集
                          </button>
                          <button
                            className="text-button"
                            onClick={() =>
                              void action(() =>
                                db.units.update(u.id, {
                                  archived: !u.archived,
                                }),
                              )
                            }
                          >
                            {u.archived ? "復元" : "非表示"}
                          </button>
                          <button
                            className="text-button"
                            aria-label={u.name + "を削除"}
                            onClick={() => setDeletingUnit(u.id)}
                          >
                            削除
                          </button>
                          <button
                            className="secondary"
                            onClick={() => setItemEdit({ unitId: u.id })}
                          >
                            授業を追加
                          </button>
                        </div>
                      </div>
                      {deletingUnit === u.id && (
                        <section
                          className="warning"
                          aria-label="単元の削除確認"
                        >
                          <h3>「{u.name}」を削除</h3>
                          {unitDeletionInfo(data, u.id).canDelete ? (
                            <>
                              <p>
                                この単元と、その中の
                                {unitDeletionInfo(data, u.id).itemCount}
                                項目を完全に削除します。元に戻すにはJSONバックアップが必要です。
                              </p>
                              <div className="actions">
                                <button
                                  onClick={() =>
                                    void action(async () => {
                                      await deleteUnusedUnit(u.id);
                                      setDeletingUnit(null);
                                      if (itemEdit?.unitId === u.id)
                                        setItemEdit(null);
                                      if (
                                        unitEdit !== "new" &&
                                        unitEdit?.id === u.id
                                      )
                                        setUnitEdit(null);
                                    }, "単元と項目を削除しました")
                                  }
                                >
                                  単元と項目を完全に削除
                                </button>
                              </div>
                            </>
                          ) : (
                            <p>
                              学習記録・Sprint目標・相談事項・他の項目からの関連付けがあるため、完全削除できません。「非表示」なら記録を残して一覧から外せます。
                            </p>
                          )}
                          <div className="actions">
                            <button
                              className="secondary"
                              onClick={() =>
                                void action(async () => {
                                  await db.units.update(u.id, {
                                    archived: true,
                                  });
                                  setDeletingUnit(null);
                                }, "単元を非表示にしました。表示チェックから復元できます。")
                              }
                            >
                              記録を残して非表示
                            </button>
                            <button
                              className="secondary"
                              onClick={() => setDeletingUnit(null)}
                            >
                              キャンセル
                            </button>
                          </div>
                        </section>
                      )}
                      {itemEdit?.unitId === u.id && (
                        <ItemEditor
                          key={itemEdit.item?.id ?? "new"}
                          course={course}
                          unitId={u.id}
                          item={itemEdit.item}
                          data={data}
                          onDone={() => setItemEdit(null)}
                        />
                      )}
                      <div className="items-list">
                        {visible
                          .filter(
                            (i) =>
                              i.unitId === u.id &&
                              [i.title, u.name, u.chapter]
                                .join(" ")
                                .includes(search),
                          )
                          .sort((a, b) => a.order - b.order)
                          .map((i) => (
                            <div className="item-row" key={i.id}>
                              <span
                                className={
                                  "status-dot " +
                                  (itemComplete(i, data.attempts)
                                    ? "done"
                                    : data.attempts.some(
                                          (a) => a.itemId === i.id,
                                        ) || i.initialStatus !== "UNSEEN"
                                      ? "started"
                                      : "")
                                }
                              />
                              <Link to={"/study/" + i.id}>
                                <strong>{i.title}</strong>
                                <small>
                                  {modeNames[i.studyMode]} ·{" "}
                                  {i.studyMode === "reproduction"
                                    ? {
                                        UNSEEN: "未着手",
                                        ATTEMPTED: "取り組み済み",
                                        UNDERSTOOD: "理解済み",
                                        REPRODUCIBLE: "再現可能",
                                        STABLE: "安定",
                                      }[mathStatus(i, data.attempts)]
                                    : itemComplete(i, data.attempts)
                                      ? "完了"
                                      : "学習する"}
                                  {i.relatedItemId
                                    ? " · 関連: " +
                                      data.studyItems.find(
                                        (x) => x.id === i.relatedItemId,
                                      )?.title
                                    : ""}
                                  {i.archived ? " · アーカイブ" : ""}
                                </small>
                              </Link>
                              <button
                                className="text-button"
                                aria-label={i.title + "を編集"}
                                onClick={() =>
                                  setItemEdit({ unitId: u.id, item: i })
                                }
                              >
                                編集
                              </button>
                              <button
                                className="text-button"
                                aria-label={
                                  i.title +
                                  (i.archived ? "を復元" : "をアーカイブ")
                                }
                                onClick={() =>
                                  void action(() =>
                                    db.studyItems.update(i.id, {
                                      archived: !i.archived,
                                    }),
                                  )
                                }
                              >
                                {i.archived ? "復元" : "非表示"}
                              </button>
                              <Link
                                className="icon-button"
                                aria-label={i.title + "を開始"}
                                to={"/study/" + i.id}
                              >
                                <ArrowRight size={18} />
                              </Link>
                            </div>
                          ))}
                      </div>
                    </details>
                  ))}
              </details>
            ))}
          </div>
          {!data.units.some((u) => u.courseId === id) && (
            <Empty>
              「授業一覧を取り込む」か「節を追加」から登録してください。
            </Empty>
          )}
        </>
      )}
    </>
  );
}
