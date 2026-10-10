# JSTテストのUTC互換性修正（2026-10-10）

- 対象コミット：`8e35c025e00c0267d6e95fbbc0a76dcb5a4eed5d`。Actions run [38021410649](https://github.com/NeuralEquation/studytrace/actions/runs/38021410649) のbuildはテスト2件で失敗し、deployは未実行。ローカルでも`TZ=UTC`で111成功・2失敗を再現した。
- 原因はdomain/reportの旧テストがOSローカル時刻で日時を生成していたこと。`japanStamp()`で10/7 23:50〜10/8 00:20 JSTを明示。本番のJST集計と既存の期待値（合計2400秒、再現可能1/1題、演習1回）は変更していない。
- 同じテスト内で、開始日の数学1800秒・完全独力1題・日別30分と、翌日への時間・演習の二重計上がないことを追加確認。全テスト数は113件のまま。
- PowerShellでは`$env:TZ = 'UTC'; npm test`と`$env:TZ = 'Asia/Tokyo'; npm test`を別プロセスで実行。両方とも5ファイル・113成功・0失敗（計画関連29件を含む）。
- `npm run build`、`npm run build:html`、`npm run verify:pwa`すべて成功。単一HTMLの内容差分なし。既存の500KB超チャンク注意は継続。
- ActionsのbuildジョブにもUTC・Asia/Tokyoの全テストと単一HTMLビルドを追加。両テスト・Web/HTMLビルド・PWA検証を通過してからPagesへ進む。
- 本番ソース・IndexedDB・既存記録・Sprint・化学ノルマ・PWA ID・依存関係/lockfileに変更なし。

## 依存関係の監査

2026-10-10に公式npmレジストリで読み取り監査を実行。`npm audit`は終了コード1で3件（moderate 1・critical 2）、`npm audit --omit=dev`は終了コード0で0件。

| パッケージ | 導入版 | 監査の重大度 | 依存経路 |
| --- | --- | --- | --- |
| `vitest` | 3.2.7 | critical（配下の影響を含む） | devDependency |
| `@vitest/mocker` | 3.2.7 | moderate | vitest配下 |
| `tinypool` | 1.1.1 | critical | vitest配下 |

- [Vitest / mockerのファイル読取](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)：開発サーバーのモック登録経路でファイル許可範囲の検証が不足。公開した該当WebSocketへ接続できること等が前提。このリポジトリはNode環境の`vitest run`を使用し、製品コードからモック用プラグインを使っていない。
- [Tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)・[run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)：別の経路でprototype pollutionが成立すると、Nodeワーカーで任意コード実行につながる問題。開発環境・CI側のリスクは残る。
- 本番依存の監査0件、依存経路、製品ソースに該当importがないことから、今回検出した3パッケージは公開PWA/単一HTMLの実行依存には含まれないと判断。開発依存の危険性が解消されたという意味ではない。
- auditはVitest 5.0.3へのメジャー更新を提案。互換性確認が必要な別作業として記録し、今回はパッケージを更新せず、`npm audit fix --force`も実行していない。

以下は当時の検証履歴です。直前の113成功報告はWindowsのローカル環境だけで、UTCでの成功やPagesデプロイ完了を示すものではありません。

---

# 学習計画・休日・優先順位・記録UI（2026-10-10）

## 基準と調査結果

- `git fetch origin main` を実行し、HEADとorigin/mainがともに `d8658cddddde80aa56e0d0429ad946736f96473c` であることを確認。既存の添付ファイルと過去の検証成果を保持。
- 改修前：dailyTargetは曜日のみ、SprintGoalは単一courseId、Todayはfindで最初の目標だけ取得、国語・公共政経は固定分離、Coach優先度は並び順へ未反映。DailyStudyTimeがToday・Records・WeeklyReportに重複していた。
- 既存の日別時間はsettings、個別時間はStudySession、結果はAttempt。日別手入力が個別時間を置き換える既存仕様を維持。

## 実装

- 既存ID・目標値を変更せず、任意のscope（講座・単元・項目の和集合）を追加。旧scopeなしは従来のcourseIdのまま。
- 数学2〜3/5〜6、化学2/7〜8、物理4分野それぞれ週1〜2のプリセット。差分確認→編集フォームへの適用→保存の明示操作が必要。化学の問題との対応は自動推測せず、対象選択を必須化。
- 最低値で達成判定、上限は推奨。未設定と0を区別。日別は同日同項目を重複除外。週間は週内の異なる項目数、月〜日をSprint期間で切る。旧週間目標はSprint全期間のまま。
- 内閣府の公式CSVを2026-10-10に取得し、1955〜2027年の1,067件を同梱。振替休日・国民の休日を含み、実行時通信なし。CSV出典： https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv 。更新用スクリプトも追加。
- 日付・手入力時刻・集計は日本時間。Todayは未達の日別→他の未達目標→達成済み→未設定。同分類ではCoach→利用者の科目順→教材順→未達数→締切→IDの順。
- Recordsに勉強時間/学習履歴タブ。Todayは簡易合計・再開リンク、WeeklyReportは期間集計・リンクのみ。既存の授業終了時保存、編集、検索、削除・復元を保持。
- 新しいscopeが参照する単元の削除と、参照中の重複授業の統合を防止。

## 自動検証

- `npm test`：113成功、0失敗（既存84＋計画・休日・互換性・UI・参照保護29）。
- 指定された休日7日すべて、JSTの00:00境界、数学/化学プリセット、化学3+2+2=7、重複Attempt、選択範囲の重複、週間範囲、未設定/0、全目標表示、Coach/利用者順、締切、過去記録の編集・削除・復元を検証。
- `npx vitest run --config verification/preserve-backup.config.ts`：1成功、0失敗。実際の添付最新版505項目および対応修正済み1631項目を、fake-indexeddb内だけでImport/Export。全テーブルの全行・ID・設定・Sprintを照合し、元ファイルのSHA-256不変を確認。ブラウザの実ユーザーデータには接触していない。
- `npm run build`、`npm run build:html`、`npm run verify:pwa`：成功。単一HTMLは約1.43MB、外部scripts/styles不要。PWA ID、scope、起動URL、アイコン、オフラインシェル、安全な更新待機を確認。
- ビルドには既存構成由来の500KB超チャンク注意が残る。失敗ではない。distの旧ファイルは削除していない。

## 実ブラウザ検証

- 独立したヘッドレスChromeの新規contextを使用。実ユーザーのブラウザ・IndexedDBを操作せず、合成データだけを使用。
- ローカルHTTPでPWAビルドと単一HTML版を確認。各1280×900と390×900、ブラウザtimezoneはAmerica/Los_Angelesに設定し、JST基準の2026-10-10を確認。
- 化学の合算目標が1カードだけで5/7・残り2・推奨8、国語のノルマが通常の上位枠に表示、時間入力フォームがToday/Reportにないことを確認。
- プリセット選択時はまだ数値未変更→差分確認後に7/8へ変更→3講座を選んで保存。科目順の上下変更→保存→Today反映→再読み込み保持を確認。
- 明示的な0時間保存、前日の4時間10分追加、履歴タブへの切替、記録日変更に伴うノルマ再集計、削除・復元、週間報告生成を確認。
- PWAはService Worker準備後にネットワークをオフライン化し、再読み込みと報告再生成を確認。
- 両幅で水平はみ出しなし、pageerrorなし。390pxのTodayは1列。PC/スマートフォン画像を目視確認。
- 検証スクリプト：verification/planning-browser.mjs。結果：verification/planning-browser/pwa-results.json、html-results.json。画像も同フォルダ。

## 互換性・残る制約

- IndexedDB名StudyTrace・バージョン2・PWA識別子を維持。DB移行/初期化なし。保存済み目標の自動変更なし。ExportはschemaVersion 4、Importは1〜4対応。新形式は更新後のアプリで復元する。
- 保存済み日別時間、個別時間、学習済み状態、Sprint、Coach、報告下書きを保持。手入力5時間と個別3時間は合計5時間、0の明示保存も優先する既存テストを継続。
- 祝日公式データの収録は2027年まで。2028年以降は未確認表示となり、公式公開後の更新が必要。
- Android実機でのタッチ・インストール確認は未実施。実ブラウザの390px表示検証とは区別する。
- 今回のコードはローカルで完成。GitHubへのpush・公開サイトへのデプロイは未実施。
- 利用者が設定する項目：対象Sprint、数学・化学・物理各分野の集計対象、プリセットの明示適用、任意の科目・教材順。

以下は過去の検証履歴です。

---

# 日別時間・過去日の記録・計測制限（2026-10-09）

- GitHub mainのPWA識別修正 `dfa092e` をfast-forwardで取り込み、その設定を維持。
- 日別合計はsettingsに保存し、個別Sessionと重複加算せず、報告・Today・日別グラフに使用。0分も明示値として保持。JSONバックアップ往復・同時更新拒否・日付/値検証を確認。
- 全8モードの過去日手入力・日付変更・バックアップ復元、未計測のまま保存をテスト。新規フォームの描画も全8モードで確認。
- 計測の有効対象は化学の実践問題・発展問題118授業。全カタログで分類をテスト。既存の対象外タイマーは停止し、未完の結果とタイマー本体コードを保持。
- USBの無機化学81授業・4章を再照合し欠損0。無機化学の自動追加は一度だけ実行し、既存の講座ID・旧番号・記録を保持。合成データで重複防止と既存講座の再利用を検証。
- HTTP 5198の専用合成データで、10/8の2時間30分が報告に反映、数学の過去日記録追加→10/7へ変更→日付検索、数学のSTART非表示、無機実践問題のSTART/STOP/保存、日別合計1時間5分の再読み込み保持を確認。
- 390px幅で日別入力・授業選択・過去日フォームに横はみ出しなし。実ユーザーの既存記録の操作・実機モバイル検証は未実施。

# 公開状況（2026-10-08）

https://neuralequation.github.io/studytrace/ で公開済み。`NeuralEquation/studytrace` のmainへpushし、GitHub Actions run 37771557385で67テスト・ビルド・Pagesデプロイが成功しました。公開URLで初期設定画面の表示を確認しました。以下の「未公開」「公開URL未確認」は公開前の検証履歴です。

# 授業一覧・記録管理の修正確認（2026-10-08）

## 今回の確認

- 自動テスト67件成功。全8モードの記録編集・旧バックアップ読込・編集後のJSON復元、同時編集の拒否、無効な得点編集時の一括取り消し、削除/復元による集計除外、既存IDを維持した授業対応づけを含みます。
- TypeScript、Web/PWAビルド、単体HTMLビルド成功。
- 指定サイトに登録された9講座1,211授業の名称・章・節・順番と、USB内の対応ファイル存在を照合。`verification/source-catalog-audit.json` が名称の監査結果です。
- Chromeの既存受講ページ `/mypage/lecture/118970` から、情報の藤原進之介先生73授業・5章を確認。公開カタログでの確認と、受講ページでの確認を区別しています。
- 整数・東大理系数学の指定フォルダは教材まとめ/板書まとめPDFのみで、個別授業ファイル名はありません。数学解法カード・国語は同名フォルダがありません。これら4講座の授業は未登録です。

## HTTPブラウザーで確認

実ユーザーの学習記録には触れず、専用ポート5195/5196の合成データで操作しました。

1. 10講座を初回登録し、カード一覧・第1章/数学基礎の折りたたみ・実授業名・検索を確認。
2. タイマーで記録を保存し、時間を12分34秒、結果をヒント後完答/再現度3に変更。さらに学習日を10/7、開始を18:00へ変更し、保存結果18:12:34を確認。
3. 記録を削除してTodayの0分を確認。削除済み一覧から復元し、12:34と訂正結果の保持を確認。
4. 再計測を開始・保存し、再読み込み後に以前の記録と新記録の2件が残ることを確認。
5. 単体 `StudyTrace.html` をHTTPで開き、ファイル選択からschemaVersion 2の旧データを読込。旧「問題53」を検証用に第1章の「例題1」へ明示的に対応づけ、残りの授業を追加。10分・完全独力・再現度5の旧記録を維持。
6. ブラウザーのJSON書き出しを実行。ダウンロードしたschemaVersion 3のJSONを読み取り、元のItem ID、Attempt、Sessionが保たれ、143授業であることを検証。
7. デスクトップ1280px、単体HTMLの390px幅で横はみ出しなし。モバイルの時間・結果編集フォームを視認。`courses-redesign-desktop.jpg` と `records-mobile-v2.jpg` を保存。

実際の日常利用データの移行は、使用中のブラウザー/保存場所が未確認のため実行していません。物理スマートフォンやiPadでの操作は未確認です。以下は初版の検証履歴で、以前の表示・テスト件数を含みます。

---

# StudyTrace v0.1 検証記録

## 単元削除の追加確認

単元ごとの削除確認を追加。未学習かつ参照のない単元と子項目だけを、同一トランザクションで完全削除します。学習記録・初期進捗・他の項目や目標等からの参照がある場合は非表示を案内します。削除と別タブでの学習開始が競合しても孤立したSessionを作らないよう、開始時にもDB内の項目を再確認します。

自動テスト53件成功（単元と子項目の削除、記録・参照・初期進捗の保護、削除済み項目の開始拒否、同時開始との競合を追加）。Web版と単体HTML版を再ビルドしました。HTTPでHTML版を開き、「理論」25項目の確認表示とキャンセル後の単元保持を確認しました。実際の利用データを完全削除するブラウザー操作は行っていません。

## 単体HTML版の追加確認

`StudyTrace.html`（約1.03MB）を追加。JavaScript・CSS・ロゴを内包し、外部moduleの読み込みとService Worker登録を除いた単体版です。`npm run build:html` による型チェックと生成に成功。外部script・stylesheetがないこと、classic scriptが1つで構文が有効なことを検査しました。

AGENTS.mdに従い、画面確認はHTTPの5190番で実施しました。単体HTMLから初回設定を完了し、9教材とSprintを登録、再読み込み後もTodayが表示されることを確認済みです。`file://` での直接起動確認は行っていません。スクリーンショットは `verification/standalone-html.jpg`。

確認日：2026-10-08（日本時間）。新規・空の作業フォルダに実装しました。既存ファイルの削除は行っていません。

## 実装した範囲

- Phase 1：React / TypeScript / HashRouter / IndexedDB、教材・単元・項目の追加／編集／アーカイブ／復元、初回設定。
- Phase 2：Today、科目別学習時間、手入力、日別・週間・累積進捗・具体的タスクのSprint。
- Phase 3：数学の再現性、化学の正確性とPB、物理の白紙再現チェック。
- Phase 4：映像、過去問、暗記、読書、関連演習の専用フォーム。
- Phase 5：教材進捗、分析、指導記録・方針・相談事項、期間指定の週間報告。
- Phase 6：JSON／CSV、検証付きImport、下書きとタイマーの復元、レスポンシブ、静的配信・PWA。

## 自動検証

`npm test`：49件成功（domain 16、report 15、database 18）。

- 数学：単独の完答ではSTABLEにならない、48時間以上空いた直近2回の完答でSTABLE、失敗後の後退、初期「理解済み」と再現可能の区別。
- 化学：完全正答のみPB、同一問題だけの比較、同タイム・0秒・将来の履歴を除外。522秒→478秒は44秒、約8.43%改善。
- 物理：設定・説明・全体のRecall、速度を中心にしない週間集約。
- 期間：ローカル曜日、深夜をまたぐSession、未完了除外、手入力、未学習日を含む日平均。
- 報告：番号圧縮、最終結果／重複を除いた問題数、初回PBと更新の分離、Pin優先、空教科省略、未解決質問、元データ非破壊。
- 保存：DBを閉じて開き直すタイマー復元、STOP後の経過固定、二重開始防止、v1→v2移行、無効Import／競合Mergeの全件中止、同一バックアップの再Merge。
- 全8モード：Session・Attempt・演習下書きをJSON化してReplace復元し、全テーブルが一致。

`npm run build`：TypeScriptチェック・Vite本番ビルド・Service Worker生成成功。実行時に外部API・認証・サーバーDBは不要です。

## ブラウザで操作確認できた範囲

Codex内蔵Chromium、HTTPの開発用ポート5174で、すべて合成の検証データを使用しました。日常利用用5180番の保存領域とは別です。

- 初回設定から9教材を登録。数学の初期進捗は0。
- Today→数学→START→演習中の詰まり・メモ・報告Pin→再読み込み→入力復元→結果保存→Today更新。
- 化学の同一問題を522秒、478秒の2回記録し、NEW BEST・44秒・8.4%を表示。問題数は1題。
- 物理の8チェックを保存しRecall 100%。
- 英作文・情報の映像視聴を保存。情報の映像に関連づけたプログラミング演習を登録・保存。
- 10/7の手入力30分を保存し、指定期間の週間合計に加算。
- 10/7〜10/14の週間報告を生成。教科別内容・Pin・質問・手入力を確認。
- 提出文の編集後にページを再読み込みし、期間と編集文が残ることを確認。
- TodayをPC・390×844・768×1024で表示。文書幅が画面幅を超えないことを確認。スクリーンショットは `verification/`。

## 静的配信・オフライン

本番ビルドを `http://127.0.0.1:5181/studytrace/#/courses` で配信。HTML、manifest、Service WorkerのHTTP 200と、画面表示を確認しました。その検証用HTTPサーバーだけを停止した後、同URLを再読み込みしてアプリの初回画面が再表示されました。

これはサブディレクトリ配信とオフラインでのアプリ起動確認です。GitHub本番へのデプロイ、物理端末でのPWAインストール、オフラインでの全フォーム操作を確認したものではありません。

## 残っている確認・制約

- 再生成の標準確認ダイアログを開いた時点で、検証ブラウザー側がダイアログの取得・閉鎖に失敗し、以降のクリックが反映されなくなりました。再生成の確認はアプリ内表示に変更済みですが、変更後の承認／取り消しとクリップボードの実操作は未確認です。
- ファイル選択を伴うJSON Import／ダウンロード、過去問・暗記・読書の画面操作、CoachとSprint編集の全操作はブラウザーでの最終確認が残っています。保存と復元は上記自動テストで確認済みです。
- 実機のiPhone／Android／iPad Safari、長期間使用、大容量履歴、GitHub Actions実行と公開URLは未確認です。
- 実行中にPCがスリープした時間も開始時刻との差に含まれます。STOP後の秒数修正を利用できます。
- 記録はブラウザ・URLの組み合わせごとです。5180番を日常利用の固定URLとし、JSONバックアップを併用してください。

GitHubリポジトリの作成・push・公開は行っていません。配信用ワークフローと手順は同梱しています。
# 2026-10-08 GitHub Pages / mobile PWA preparation

- `npm test`: 67 tests passed; production and standalone HTML builds passed.
- Added 192/512 PNG launcher icons, maskable icon, Apple touch icon, manifest ID, and PNG precaching.
- Mobile CSS now accounts for safe-area insets and uses 16px form fields.
- HTTP preview at port 5197: 390px course cards visually checked; all seven main routes at 320px stayed within viewport width.
- Stopped the preview server, confirmed no listening socket, then reloaded the course page and navigated all seven routes successfully using the PWA cache. Synthetic two-course data remained present.
- Physical Android/iOS installation, touch and device-specific safe-area behavior remain unverified.
- Verification screenshots and local source-audit outputs remain local under ignored `verification/`.

# 2026-10-08 PWA installation identity fix

- Reproduced the original manifest `id: "./"` resolving to the origin root in Chromium 151. This can collide with another installed PWA on the same GitHub Pages host. The essay repository had fixed the same ID issue and added a fresh installation entry.
- Changed the stable application ID to `/studytrace/`, moved the manifest URL to `studytrace.webmanifest`, and set the launch URL to `index.html?launch=pwa` within the existing scope and storage origin.
- Added `install.html` and `install.js`. Both are excluded from precaching; installer navigations bypass the app-shell fallback. A missing install prompt shows manual instructions, without claiming the app is installed. Waiting updates are observed without sending `SKIP_WAITING` or reloading study tabs.
- `npm test`: all 67 tests passed. `npm run build` and `npm run verify:pwa` passed. The PWA build check now runs before deployment in GitHub Actions.
- Browser verification used a fresh persistent Chromium profile and a local HTTP server under `/studytrace/`: the corrected ID, shared manifest on both pages, launch URL, and empty Chrome installability-error list were verified. Controlled navigation reached the installer; manual instructions, prompt dismissal, and installation-completion event handling worked at a 390px mobile viewport.
- Verified offline cold launch with the PWA query URL; an IndexedDB settings record, another app's cache, and its `/essay/` Service Worker registration survived installer use. A changed worker stayed waiting while an existing study tab remained open.
- Install prompt choices and completion events were simulated for interaction checks. Installation onto a physical Android/iOS device and launch from the OS home screen remain unverified.
