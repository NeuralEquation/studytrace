import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  BookPlus,
  FolderPlus,
  Pencil,
  Settings2,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
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
import { useViewState } from "../../features/navigation/useViewState";
export function Courses({ data }: { data: AppData }) {
  const { id } = useParams();
  const [showCatalog, setShowCatalog] = useState(false);
  const viewKey = "library:" + (id ?? "all") + ":";
  const [subject, setSubject] = useViewState(viewKey + "subject", "");
  const [chapters, setChapters] = useViewState<Record<string, boolean>>(
    viewKey + "chapters",
    {},
  );
  const [units, setUnits] = useViewState<Record<string, boolean>>(
    viewKey + "units",
    {},
  );
  const [managing, setManaging] = useViewState(viewKey + "managing", false);
  const [editing, setEditing] = useState(false);
  const [unitEdit, setUnitEdit] = useState<Unit | "new" | null>(null);
  const [itemEdit, setItemEdit] = useState<{
    unitId: string;
    item?: StudyItem;
  } | null>(null);
  const [search, setSearch] = useViewState(viewKey + "search", "");
  const [showArchived, setShowArchived] = useViewState(
    viewKey + "archived",
    false,
  );
  const [deletingUnit, setDeletingUnit] = useState<string | null>(null);
  const course = data.courses.find((c) => c.id === id);
  function setAll(open: boolean) {
    const rows = data.units.filter((u) => u.courseId === id);
    setChapters(
      Object.fromEntries(
        rows.map((u) => [u.chapter || "その他・既存の登録", open]),
      ),
    );
    setUnits(Object.fromEntries(rows.map((u) => [u.id, open])));
  }
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
          course ? (
            <button
              className="secondary"
              aria-pressed={managing}
              onClick={() => setManaging(!managing)}
            >
              <Settings2 size={17} />
              {managing ? "管理を終了" : "教材を管理"}
            </button>
          ) : (
            <button onClick={() => setEditing(!editing)}>
              <BookPlus size={18} />
              教材を追加
            </button>
          )
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
      {(showCatalog || (!!course && managing)) && (
        <CatalogPanel data={data} course={course} />
      )}
      {editing && (!course || managing) && (
        <CourseEditor course={course} onDone={() => setEditing(false)} />
      )}
      <div className="toolbar library-breadcrumb">
        {(!course || managing) && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              非表示の教材・単元・項目も表示
            </label>
          </>
        )}
        {course && (
          <>
            <Link to="/courses">← 教材一覧</Link>
            <ExternalLink url={course.externalUrl} />
            {managing && (
              <>
                <button
                  className="secondary"
                  onClick={() => setEditing(!editing)}
                >
                  <Pencil size={16} />
                  教材情報を編集
                </button>
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
          <div className="stats-grid library-progress">
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
          <div className="library-toolbar">
            <input
              aria-label="授業を検索"
              placeholder="授業名・章・節を検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {managing && (
              <button className="secondary" onClick={() => setUnitEdit("new")}>
                <FolderPlus size={17} />
                節を追加
              </button>
            )}
            <div className="library-expand-actions" aria-label="章と節の開閉">
              <button className="text-button" onClick={() => setAll(true)}>
                <ChevronsUpDown size={16} />
                すべて開く
              </button>
              <button className="text-button" onClick={() => setAll(false)}>
                すべて折りたたむ
              </button>
            </div>
          </div>
          {managing && unitEdit && (
            <UnitEditor
              key={unitEdit === "new" ? "new" : unitEdit.id}
              courseId={course.id}
              unit={unitEdit === "new" ? undefined : unitEdit}
              onDone={() => setUnitEdit(null)}
            />
          )}
          <p className="library-hint">
            章・節を開いて授業を選択できます。開閉状態と検索条件は自動で保持します。
          </p>
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
                key={chapter}
                open={!!search || chapters[chapter] === true}
                onToggle={(e) => {
                  const open = e.currentTarget.open;
                  if (!search)
                    setChapters((current) =>
                      current[chapter] === open
                        ? current
                        : { ...current, [chapter]: open },
                    );
                }}
              >
                <summary>
                  <ChevronRight className="disclosure-chevron" size={18} />
                  <span className="disclosure-title">{chapter}</span>
                  <span className="disclosure-meta">
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
                      key={u.id}
                      open={!!search || units[u.id] === true}
                      onToggle={(e) => {
                        const open = e.currentTarget.open;
                        if (!search)
                          setUnits((current) =>
                            current[u.id] === open
                              ? current
                              : { ...current, [u.id]: open },
                          );
                      }}
                    >
                      <summary>
                        <ChevronRight
                          className="disclosure-chevron"
                          size={17}
                        />
                        <span className="disclosure-title">
                          {u.name}
                          {u.archived ? "（非表示）" : ""}
                        </span>
                        <small className="disclosure-meta">
                          {
                            visible.filter(
                              (i) =>
                                i.unitId === u.id &&
                                itemComplete(i, data.attempts),
                            ).length
                          }{" "}
                          / {visible.filter((i) => i.unitId === u.id).length}{" "}
                          完了
                        </small>
                      </summary>
                      {managing && (
                        <div className="row unit-management">
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
                      )}
                      {managing && deletingUnit === u.id && (
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
                      {managing && itemEdit?.unitId === u.id && (
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
                              {managing && (
                                <>
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
                                </>
                              )}
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
