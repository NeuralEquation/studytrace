import { z } from "zod";
export const subjects = [
  "mathematics",
  "chemistry",
  "physics",
  "english",
  "information",
  "japanese",
  "civics",
  "other",
] as const;
export const modes = [
  "reproduction",
  "speed",
  "deep_recall",
  "video",
  "past_exam",
  "memorization",
  "reading",
  "practice",
] as const;
export const subjectNames: Record<Subject, string> = {
  mathematics: "数学",
  chemistry: "化学",
  physics: "物理",
  english: "英語",
  information: "情報",
  japanese: "国語",
  civics: "公共・政治経済",
  other: "その他",
};
export const modeNames: Record<StudyMode, string> = {
  reproduction: "解法の再現",
  speed: "正確性と速度",
  deep_recall: "白紙再現",
  video: "映像授業",
  past_exam: "過去問",
  memorization: "暗記・継続",
  reading: "読書・参考書",
  practice: "演習",
};
export const bottleneckNames = {
  problem_understanding: "問題理解",
  strategy: "方針",
  theorem_recall: "定理の想起",
  modeling: "立式・モデル化",
  case_split: "場合分け",
  calculation: "計算",
  final_processing: "最後の処理",
  forgotten_solution: "解法を忘れた",
  setup: "状況・系の設定",
  reasoning: "法則・論理",
  other: "その他",
};
export const resultNames = {
  perfect: "完全独力で完答",
  independent_with_stuck: "独力だが途中で詰まった",
  hint: "ヒント後に完答",
  solution_understood: "解答を見て理解",
  failed: "解答を見ても不十分",
};
const id = z.string().min(1);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00");
    return (
      !isNaN(d.getTime()) &&
      d.getFullYear() === +v.slice(0, 4) &&
      d.getMonth() + 1 === +v.slice(5, 7) &&
      d.getDate() === +v.slice(8, 10)
    );
  }, "日付が無効です");
const stamp = z.string().datetime({ offset: true });
const nonneg = z.number().finite().nonnegative();
const score5 = z.number().int().min(1).max(5);
export const safeUrl = z
  .string()
  .url()
  .refine(
    (v) => ["http:", "https:"].includes(new URL(v).protocol),
    "HTTP(S) URLを入力してください",
  );
export const courseSchema = z.object({
  id,
  catalogId: z.string().optional(),
  teacher: z.string().optional(),
  name: z.string().min(1),
  subject: z.enum(subjects),
  defaultMode: z.enum(modes),
  targetDate: date.optional(),
  planStartDate: date.optional(),
  externalUrl: safeUrl.optional(),
  archived: z.boolean().default(false),
  createdAt: stamp,
});
export const unitSchema = z.object({
  id,
  chapter: z.string().optional(),
  catalogKey: z.string().optional(),
  courseId: id,
  name: z.string().min(1),
  order: nonneg,
  archived: z.boolean().default(false),
});
export const itemSchema = z.object({
  id,
  catalogKey: z.string().optional(),
  sourcePath: z.string().optional(),
  courseId: id,
  unitId: id,
  title: z.string().min(1),
  number: z.number().int().positive().optional(),
  type: z.enum([
    "problem",
    "video",
    "exam",
    "vocabulary",
    "reading",
    "programming",
    "other",
  ]),
  studyMode: z.enum(modes),
  externalUrl: safeUrl.optional(),
  relatedItemId: id.optional(),
  initialStatus: z
    .enum(["UNSEEN", "ATTEMPTED", "UNDERSTOOD", "REPRODUCIBLE"])
    .default("UNSEEN"),
  archived: z.boolean().default(false),
  order: nonneg,
});
export const sessionSchema = z.object({
  id,
  deletedAt: stamp.optional(),
  updatedAt: stamp.optional(),
  itemId: id.optional(),
  courseId: id,
  mode: z.enum(modes),
  startedAt: stamp,
  endedAt: stamp.optional(),
  durationSeconds: nonneg,
  source: z.enum(["timer", "manual"]),
  note: z.string().optional(),
  includeInCoachReport: z.boolean().default(false),
});
const base = {
  id,
  deletedAt: stamp.optional(),
  updatedAt: stamp.optional(),
  itemId: id,
  sessionId: id.optional(),
  createdAt: stamp,
  durationSeconds: nonneg.optional(),
  confidence: score5.optional(),
  notes: z.string().default(""),
  includeInCoachReport: z.boolean().default(false),
};
export const recallLabels = [
  "状況図を再現できた",
  "既知量・未知量を整理できた",
  "系を適切に選べた",
  "正方向等を設定できた",
  "最初の一手を説明できた",
  "適用する物理法則を説明できた",
  "式の物理的意味を説明できた",
  "解法の流れを最後まで説明できた",
] as const;
export const attemptSchema = z.discriminatedUnion("mode", [
  z.object({
    ...base,
    mode: z.literal("reproduction"),
    result: z.enum([
      "perfect",
      "independent_with_stuck",
      "hint",
      "solution_understood",
      "failed",
    ]),
    reproducibility: score5,
  }),
  z.object({
    ...base,
    mode: z.literal("speed"),
    result: z.enum(["correct", "partial", "incorrect"]),
    accuracy: z.number().min(0).max(100),
  }),
  z.object({
    ...base,
    mode: z.literal("deep_recall"),
    checks: z.array(z.boolean()).length(8),
  }),
  z.object({
    ...base,
    mode: z.literal("video"),
    watched: z.boolean(),
    completion: z.number().min(0).max(100),
    understanding: score5,
    question: z.string(),
  }),
  z.object({
    ...base,
    mode: z.literal("past_exam"),
    university: z.string(),
    year: z.number().int().min(1900).max(2200),
    subject: z.string(),
    score: nonneg,
    maxScore: z.number().positive(),
    sections: z.array(
      z.object({
        name: z.string().min(1),
        score: nonneg,
        maxScore: z.number().positive(),
      }),
    ),
    mistakeReasons: z.string(),
    reviewCompleted: z.boolean(),
  }),
  z.object({
    ...base,
    mode: z.literal("memorization"),
    range: z.string(),
    completion: z.number().min(0).max(100),
  }),
  z.object({
    ...base,
    mode: z.literal("reading"),
    section: z.string(),
    progress: z.number().min(0).max(100),
  }),
  z.object({
    ...base,
    mode: z.literal("practice"),
    completion: z.number().min(0).max(100),
    result: z.enum(["completed", "partial", "failed"]),
    difficulty: score5,
  }),
]);
export const bottleneckSchema = z.object({
  id,
  attemptId: id,
  elapsedSeconds: nonneg.optional(),
  type: z.enum(
    Object.keys(bottleneckNames) as [
      keyof typeof bottleneckNames,
      ...(keyof typeof bottleneckNames)[],
    ],
  ),
  subtype: z.string().optional(),
  note: z.string().optional(),
  createdAt: stamp,
});
const target = z
  .object({ min: nonneg, max: nonneg.optional() })
  .refine(
    (v) => v.max === undefined || v.max >= v.min,
    "上限は下限以上にしてください",
  );
export const goalSchema = z.object({
  id,
  sprintId: id,
  courseId: id,
  kind: z.enum([
    "daily_count",
    "weekly_count",
    "course_progress",
    "specific_task",
  ]),
  title: z.string().min(1),
  target: nonneg,
  weekdays: target.optional(),
  weekends: target.optional(),
  itemId: id.optional(),
  completed: z.boolean().default(false),
});
export const sprintSchema = z
  .object({
    id,
    title: z.string().min(1),
    startDate: date,
    endDate: date,
    coachSessionId: id.optional(),
  })
  .refine((v) => v.endDate >= v.startDate, "終了日は開始日以降にしてください");
export const coachSchema = z.object({
  id,
  date: date,
  title: z.string(),
  notes: z.string(),
  nextSessionAt: stamp.optional(),
});
export const directiveSchema = z.object({
  id,
  coachSessionId: id,
  subject: z.enum(subjects),
  text: z.string().min(1),
  priority: z.enum(["high", "normal", "low"]),
  activeFrom: date,
  activeUntil: date.optional(),
  courseId: id.optional(),
});
export const questionSchema = z.object({
  id,
  createdAt: stamp,
  text: z.string().min(1),
  subject: z.enum(subjects).optional(),
  relatedItemId: id.optional(),
  resolved: z.boolean(),
});
export const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});
export const draftSchema = z.object({
  id,
  startDate: date,
  endDate: date,
  text: z.string(),
  generatedAt: stamp,
  updatedAt: stamp,
  edited: z.boolean(),
  detail: z.enum(["compact", "detailed"]),
  daily: z.boolean(),
});
export type Subject = (typeof subjects)[number];
export type StudyMode = (typeof modes)[number];
export type Course = z.infer<typeof courseSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type StudyItem = z.infer<typeof itemSchema>;
export type StudySession = z.infer<typeof sessionSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type Bottleneck = z.infer<typeof bottleneckSchema>;
export type Sprint = z.infer<typeof sprintSchema>;
export type SprintGoal = z.infer<typeof goalSchema>;
export type CoachSession = z.infer<typeof coachSchema>;
export type CoachDirective = z.infer<typeof directiveSchema>;
export type CoachQuestion = z.infer<typeof questionSchema>;
export type ReportDraft = z.infer<typeof draftSchema>;
export type ModeAttempt<M extends StudyMode> = Extract<Attempt, { mode: M }>;
export type AppData = {
  courses: Course[];
  units: Unit[];
  studyItems: StudyItem[];
  studySessions: StudySession[];
  attempts: Attempt[];
  bottlenecks: Bottleneck[];
  sprints: Sprint[];
  sprintGoals: SprintGoal[];
  coachSessions: CoachSession[];
  coachDirectives: CoachDirective[];
  coachQuestions: CoachQuestion[];
  settings: z.infer<typeof settingSchema>[];
  progressReportDrafts: ReportDraft[];
};
export const emptyData = (): AppData => ({
  courses: [],
  units: [],
  studyItems: [],
  studySessions: [],
  attempts: [],
  bottlenecks: [],
  sprints: [],
  sprintGoals: [],
  coachSessions: [],
  coachDirectives: [],
  coachQuestions: [],
  settings: [],
  progressReportDrafts: [],
});
