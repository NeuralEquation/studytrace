import { z } from "zod";
import { attemptSchema } from "../../types/model";
import type { Attempt } from "../../types/model";

const schema = z.object({
  revision: z.string(),
  value: attemptSchema.optional(),
  date: z.string(),
  time: z.string(),
  minutes: z.number().finite(),
  seconds: z.number().finite(),
  note: z.string(),
  pin: z.boolean(),
});
export type ManualDraft = z.infer<typeof schema>;
const prefix = "studytrace:manual-draft:v1:";
export function loadManualDraft(
  key: string,
  revision: string,
  value?: Attempt,
) {
  try {
    const parsed = schema.safeParse(
      JSON.parse(localStorage.getItem(prefix + key) ?? "null"),
    );
    if (!parsed.success || parsed.data.revision !== revision) return;
    const draft = parsed.data;
    if (
      !!draft.value !== !!value ||
      (value &&
        (draft.value?.itemId !== value.itemId ||
          draft.value?.mode !== value.mode))
    )
      return;
    return draft;
  } catch {
    /* Damaged or disabled storage must not block entry. */
  }
}
export function storeManualDraft(key: string, draft?: ManualDraft): boolean {
  try {
    if (draft) localStorage.setItem(prefix + key, JSON.stringify(draft));
    else localStorage.removeItem(prefix + key);
    return true;
  } catch {
    return false;
  }
}
