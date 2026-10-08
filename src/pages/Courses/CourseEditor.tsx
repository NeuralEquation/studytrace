import { useState } from "react";
import type { Course, StudyItem, Unit, AppData } from "../../types/model";
import {
  courseSchema,
  itemSchema,
  unitSchema,
  subjectNames,
  modeNames,
  subjects,
  modes,
} from "../../types/model";
import { db } from "../../db/database";
import { Field } from "../../components/ui";
import { action } from "../../stores/ui";
import { now, uid } from "../../utils/time";
export function CourseEditor({
  course,
  onDone,
}: {
  course?: Course;
  onDone: () => void;
}) {
  const [value, set] = useState<Course>(
    course ?? {
      id: uid(),
      name: "",
      subject: "mathematics",
      defaultMode: "reproduction",
      createdAt: now(),
      archived: false,
    },
  );
  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void action(async () => {
          await db.courses.put(courseSchema.parse(value));
          onDone();
        }, "教材を保存しました");
      }}
    >
      <h2>{course ? "教材を編集" : "教材を追加"}</h2>
      <Field label="教材名">
        <input
          required
          value={value.name}
          onChange={(e) => set({ ...value, name: e.target.value })}
        />
      </Field>
      <Field label="教科">
        <select
          value={value.subject}
          onChange={(e) =>
            set({ ...value, subject: e.target.value as Course["subject"] })
          }
        >
          {subjects.map((s) => (
            <option key={s} value={s}>
              {subjectNames[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="標準の学習モード">
        <select
          value={value.defaultMode}
          onChange={(e) =>
            set({
              ...value,
              defaultMode: e.target.value as Course["defaultMode"],
            })
          }
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {modeNames[m]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="外部URL">
        <input
          type="url"
          value={value.externalUrl ?? ""}
          onChange={(e) =>
            set({ ...value, externalUrl: e.target.value || undefined })
          }
        />
      </Field>
      <Field label="学習開始日">
        <input
          type="date"
          value={value.planStartDate ?? ""}
          onInput={(e) =>
            set({ ...value, planStartDate: e.currentTarget.value || undefined })
          }
          onChange={(e) =>
            set({ ...value, planStartDate: e.target.value || undefined })
          }
        />
      </Field>
      <Field label="目標日">
        <input
          type="date"
          value={value.targetDate ?? ""}
          onInput={(e) =>
            set({ ...value, targetDate: e.currentTarget.value || undefined })
          }
          onChange={(e) =>
            set({ ...value, targetDate: e.target.value || undefined })
          }
        />
      </Field>
      <div className="actions">
        <button>保存</button>
        <button type="button" className="secondary" onClick={onDone}>
          閉じる
        </button>
      </div>
    </form>
  );
}
export function UnitEditor({
  courseId,
  unit,
  onDone,
}: {
  courseId: string;
  unit?: Unit;
  onDone: () => void;
}) {
  const [name, setName] = useState(unit?.name ?? "");
  const [chapter, setChapter] = useState(unit?.chapter ?? "");
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        void action(async () => {
          await db.units.put(
            unitSchema.parse(
              unit
                ? { ...unit, name, chapter: chapter || undefined }
                : {
                    id: uid(),
                    courseId,
                    chapter: chapter || undefined,
                    name,
                    order: await db.units
                      .where("courseId")
                      .equals(courseId)
                      .count(),
                    archived: false,
                  },
            ),
          );
          onDone();
        }, "単元を保存しました");
      }}
    >
      <Field label="章名（任意）">
        <input value={chapter} onChange={(e) => setChapter(e.target.value)} />
      </Field>
      <Field label="節名">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <button>保存</button>
      <button type="button" className="secondary" onClick={onDone}>
        閉じる
      </button>
    </form>
  );
}
export function ItemEditor({
  course,
  unitId,
  item,
  data,
  onDone,
}: {
  course: Course;
  unitId: string;
  item?: StudyItem;
  data: AppData;
  onDone: () => void;
}) {
  const [value, set] = useState<StudyItem>(
    item ?? {
      id: uid(),
      courseId: course.id,
      unitId,
      title: "",
      studyMode: course.defaultMode,
      type:
        course.defaultMode === "video"
          ? "video"
          : course.defaultMode === "reading"
            ? "reading"
            : course.defaultMode === "memorization"
              ? "vocabulary"
              : course.defaultMode === "past_exam"
                ? "exam"
                : "problem",
      order: data.studyItems.filter((i) => i.unitId === unitId).length,
      initialStatus: "UNSEEN",
      archived: false,
    },
  );
  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void action(async () => {
          const parsed = itemSchema.parse(value);
          if (
            item &&
            item.studyMode !== parsed.studyMode &&
            ((await db.attempts.where("itemId").equals(item.id).count()) ||
              (await db.studySessions.where("itemId").equals(item.id).count()))
          )
            throw new Error(
              "記録済み項目の学習モードは変更できません。新しい項目を追加してください。",
            );
          await db.studyItems.put(parsed);
          onDone();
        }, "授業を保存しました");
      }}
    >
      <h3>{item ? "授業を編集" : "授業を追加"}</h3>
      <Field label="授業名">
        <input
          required
          value={value.title}
          onChange={(e) => set({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="所属する節">
        <select
          value={value.unitId}
          onChange={(e) => set({ ...value, unitId: e.target.value })}
        >
          {data.units
            .filter((u) => u.courseId === course.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.chapter ? u.chapter + " / " : ""}
                {u.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="番号（任意）">
        <input
          type="number"
          min={1}
          value={value.number ?? ""}
          onChange={(e) =>
            set({
              ...value,
              number: e.target.value ? +e.target.value : undefined,
            })
          }
        />
      </Field>
      <Field label="種別">
        <select
          value={value.type}
          onChange={(e) =>
            set({ ...value, type: e.target.value as StudyItem["type"] })
          }
        >
          {[
            "problem",
            "video",
            "exam",
            "vocabulary",
            "reading",
            "programming",
            "other",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="学習モード">
        <select
          value={value.studyMode}
          onChange={(e) =>
            set({
              ...value,
              studyMode: e.target.value as StudyItem["studyMode"],
            })
          }
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {modeNames[m]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="外部URL">
        <input
          type="url"
          value={value.externalUrl ?? ""}
          onChange={(e) =>
            set({ ...value, externalUrl: e.target.value || undefined })
          }
        />
      </Field>
      <Field label="関連講義・項目">
        <select
          value={value.relatedItemId ?? ""}
          onChange={(e) =>
            set({ ...value, relatedItemId: e.target.value || undefined })
          }
        >
          <option value="">なし</option>
          {data.studyItems
            .filter((i) => i.courseId === course.id && i.id !== value.id)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
        </select>
      </Field>
      <Field label="初期進捗">
        <select
          value={value.initialStatus}
          onChange={(e) =>
            set({
              ...value,
              initialStatus: e.target.value as StudyItem["initialStatus"],
            })
          }
        >
          {["UNSEEN", "ATTEMPTED", "UNDERSTOOD", "REPRODUCIBLE"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <div className="actions">
        <button>保存</button>
        <button type="button" className="secondary" onClick={onDone}>
          閉じる
        </button>
      </div>
    </form>
  );
}
