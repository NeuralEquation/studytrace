"use strict";

const status = document.querySelector("#status");
const button = document.querySelector("#install");
const help = document.querySelector("#help");
let promptEvent = null;
let installed = false;
let prompting = false;
const info = {
  page: location.href,
  browser: navigator.userAgent,
  secure: window.isSecureContext,
  standalone: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
  installEvent: false,
  appId: null,
  worker: null,
  updateWaiting: false,
  error: null,
};

function draw() {
  document.querySelector("#diagnostics").textContent = JSON.stringify(info, null, 2);
  button.hidden = installed;
  button.disabled = prompting;
  button.textContent = promptEvent ? "インストールする" : "インストール方法を表示";
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  promptEvent = event;
  info.installEvent = true;
  status.textContent = "インストールの準備ができました。下のボタンを押してください。";
  draw();
});

window.addEventListener("appinstalled", () => {
  installed = true;
  promptEvent = null;
  info.installed = true;
  status.textContent = "インストールが完了しました。ホーム画面から開けます。";
  draw();
});

button.addEventListener("click", async () => {
  if (!promptEvent) {
    help.hidden = false;
    status.textContent = "ブラウザのメニューから追加する手順を下に表示しました。";
    return;
  }
  const event = promptEvent;
  promptEvent = null;
  prompting = true;
  draw();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    info.choice = choice.outcome;
    if (!installed) {
      status.textContent = choice.outcome === "dismissed"
        ? "インストールをキャンセルしました。ブラウザのメニューからも追加できます。"
        : "追加を受け付けました。完了後、ホーム画面から開いてください。";
    }
  } catch (error) {
    info.error = String(error);
    status.textContent = "ブラウザのメニューからインストールしてください。";
    help.hidden = false;
  } finally {
    prompting = false;
    draw();
  }
});

document.querySelector("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    document.querySelector("#copy").textContent = "コピーしました";
  } catch {
    document.querySelector("#copy").textContent = "上の確認情報を選択してコピーしてください";
  }
});

async function prepare() {
  try {
    if (!window.isSecureContext || !navigator.serviceWorker) {
      throw new Error("HTTPSの公開サイトを通常のブラウザで開いてください");
    }
    const response = await fetch("./studytrace.webmanifest", { cache: "no-store" });
    if (!response.ok) throw new Error("インストール設定を読み込めません");
    const manifest = await response.json();
    // The ID is relative to the origin; launch URL and scope are relative to the manifest.
    info.appId = new URL(manifest.id, location.origin + "/").href;
    info.startUrl = new URL(manifest.start_url, response.url).href;
    const registration = await navigator.serviceWorker.register("./sw.js", {
      scope: "./",
      updateViaCache: "none",
    });
    const waitingMessage = "更新待ちです。学習を保存してすべてのStudyTraceのタブ・アプリを閉じ、このページを開き直してください。";
    function trackWorker() {
      info.worker = registration.active?.scriptURL || registration.installing?.scriptURL;
      info.scope = registration.scope;
      info.updateWaiting = Boolean(registration.waiting);
      if (info.updateWaiting && !installed && !promptEvent && !prompting) {
        status.textContent = waitingMessage;
      }
      draw();
    }
    function trackInstalling() {
      registration.installing?.addEventListener("statechange", trackWorker);
      trackWorker();
    }
    registration.addEventListener("updatefound", trackInstalling);
    trackInstalling();
    await registration.update();
    trackWorker();
    // Never force activation or reload another tab while a study session is open.
    if (!installed && !promptEvent) {
      status.textContent = info.updateWaiting
        ? waitingMessage
        : info.standalone
          ? "アプリのウィンドウで開いています。追加する場合は通常のブラウザでこのページを開いてください。"
          : "ブラウザのメニューから追加できます。下のボタンで手順を確認してください。";
    }
  } catch (error) {
    info.error = String(error);
    if (!installed && !promptEvent) {
      status.textContent = "準備を完了できませんでした。通信を確認して開き直してください。追加方法は下のボタンで確認できます。";
    }
  }
  draw();
}

draw();
void prepare();
