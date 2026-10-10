import { useState } from "react";
import type { AppData } from "../../types/model";
import { Field } from "../../components/ui";
import { RecordEditor } from "./RecordEditor";
import { courseStudyItems } from "../../features/study/itemNavigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useViewState } from "../../features/navigation/useViewState";

export function AddRecord({
  data,
  itemId,
  onDone,
}: {
  data: AppData;
  itemId?: string;
  onDone: () => void;
}) {
  const courses = data.courses.filter((c) => !c.archived);
  const viewKey = "record-entry:" + (itemId ?? "all") + ":";
  const [storedCourse, setCourse] = useViewState(
    viewKey + "course",
    data.studyItems.find((i) => i.id === itemId)?.courseId ??
      courses[0]?.id ??
      "",
  );
  const courseId = courses.some((c) => c.id === storedCourse)
    ? storedCourse
    : (courses[0]?.id ?? "");
  const [selected, setSelected] = useViewState(viewKey + "item", itemId ?? "");
  const [search, setSearch] = useViewState(viewKey + "search", "");
  const [version, setVersion] = useState(0);
  const [date, setDate] = useState<string>();
  const [saved, setSaved] = useState(false);
  const items = courseStudyItems(data, courseId);
  const item = items.find((i) => i.id === selected);
  const index = items.findIndex((i) => i.id === selected);
  const next = index >= 0 ? items[index + 1] : undefined;
  function select(id: string) {
    setSelected(id);
    setSaved(false);
  }
  return (
    <section className="card">
      {!itemId && (
        <>
          <h2>過去日・今日の学習記録を追加</h2>
          <Field label="記録する講座">
            <select
              value={courseId}
              onChange={(e) => {
                setCourse(e.target.value);
                select("");
                setSearch("");
              }}
            >
              {courses.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="授業を絞り込む">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="授業名・章・節"
            />
          </Field>
          <Field label="記録する授業">
            <select value={selected} onChange={(e) => select(e.target.value)}>
              <option value="">授業を選択</option>
              {items
                .filter(
                  (i) =>
                    i.id === selected ||
                    [
                      i.title,
                      data.units.find((u) => u.id === i.unitId)?.chapter,
                      data.units.find((u) => u.id === i.unitId)?.name,
                    ]
                      .join(" ")
                      .includes(search),
                )
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {data.units.find((u) => u.id === i.unitId)?.chapter} /{" "}
                    {data.units.find((u) => u.id === i.unitId)?.name} /{" "}
                    {i.title}
                  </option>
                ))}
            </select>
          </Field>
        </>
      )}
      {item ? (
        <>
          {saved && (
            <p role="status" className="record-saved-note">
              記録しました。選択した授業を保持しています。続けて次の記録を追加できます。
            </p>
          )}
          {!itemId && (
            <div className="actions add-record-navigation">
              <button
                className="secondary"
                disabled={index <= 0}
                onClick={() => select(items[index - 1].id)}
              >
                <ChevronLeft size={16} />
                前へ
              </button>
              <span>
                {index + 1} / {items.length}
              </span>
              <button
                className="secondary"
                disabled={!next}
                onClick={() => next && select(next.id)}
              >
                次へ
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <RecordEditor
            key={item.id + ":" + version}
            createItem={item}
            initialDate={date}
            onDone={onDone}
            onSaved={(day) => {
              setDate(day);
              setSaved(true);
              setVersion((n) => n + 1);
            }}
            onSaveNext={
              !itemId && next
                ? (day) => {
                    setDate(day);
                    select(next.id);
                  }
                : undefined
            }
          />
        </>
      ) : (
        <button className="secondary" onClick={onDone}>
          閉じる
        </button>
      )}
    </section>
  );
}
