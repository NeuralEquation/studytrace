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
