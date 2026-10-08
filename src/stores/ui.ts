import { create } from "zustand";
type UI = {
  message: string;
  error: boolean;
  notify: (message: string, error?: boolean) => void;
};
export const useUI = create<UI>((set) => ({
  message: "",
  error: false,
  notify: (message, error = false) => set({ message, error }),
}));
export async function action(work: () => Promise<unknown>, success?: string) {
  try {
    await work();
    if (success) useUI.getState().notify(success);
  } catch (e) {
    useUI
      .getState()
      .notify(
        e instanceof Error
          ? e.message
          : "保存できませんでした。バックアップをご確認ください。",
        true,
      );
  }
}
