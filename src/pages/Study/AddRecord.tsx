import { useState } from "react";
import type { AppData } from "../../types/model";
import { Field } from "../../components/ui";
import { RecordEditor } from "./RecordEditor";

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
  const [courseId, setCourse] = useState(
    data.studyItems.find((i) => i.id === itemId)?.courseId ??
      courses[0]?.id ??
      "",
  );
  const [selected, setSelected] = useState(itemId ?? "");
  const [search, setSearch] = useState("");
  const items = data.studyItems.filter(
    (i) =>
      i.courseId === courseId &&
      !i.archived &&
      !data.units.find((u) => u.id === i.unitId)?.archived,
  );
  const item = items.find((i) => i.id === selected);
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
                setSelected("");
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
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
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
        <RecordEditor key={item.id} createItem={item} onDone={onDone} />
      ) : (
        <button className="secondary" onClick={onDone}>
          閉じる
        </button>
      )}
    </section>
  );
}
