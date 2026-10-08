import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { useUI } from "./stores/ui";
import "./styles.css";
registerSW({
  onNeedRefresh() {
    useUI
      .getState()
      .notify(
        "アプリの更新があります。学習を終了後、すべてのStudyTraceタブを閉じて開き直してください。",
      );
  },
  onRegisterError(error: unknown) {
    console.warn("Offline registration", error);
  },
});
window.addEventListener("unhandledrejection", (event) =>
  useUI
    .getState()
    .notify(
      event.reason instanceof Error
        ? event.reason.message
        : "保存処理に失敗しました。再読み込み前に入力内容を控えてください。",
      true,
    ),
);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
