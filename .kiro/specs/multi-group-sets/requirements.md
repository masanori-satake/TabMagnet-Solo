# Requirements Document

## Introduction

本ドキュメントは、TabMagnet-Solo における「マルチグループセット（multi-group-sets）」機能の要件を定義する。

現在、TabMagnet-Solo はタブグループの名前と対象URLパターン（複数）を「グループ」として単一のフラットなリストで管理し、リスト先頭の「Magnet All」で全グループを一括実行する。本機能は、この単一のグループ集合を「グループセット」として複数保持できるよう拡張し、グループセットごとに開閉・編集・移動・実行・削除を行えるようにする。

既存利用者のデータは新しいデータ形式へ破壊することなく移行（Migrate）し、過去バージョンでエクスポートされたファイルのインポート、および chrome.storage.local と chrome.storage.sync の両方の移行に対応する。

## Glossary

- **TabMagnet-Solo (TM)**: 本Chrome拡張機能全体。プライバシーを最優先し、ローカル完結型で動作する。
- **Group**: タブグループ名・URLパターン（1件以上50件以下）・カラーの組。従来の「ターゲット（Target）」に相当する。1つのGroupは1つのTabMagnetタブグループ（🧲プレフィックス付き）に対応する。
- **Group-Set**: 1つ以上のGroupをまとめた集合。各Group-Setは名前・カラー・展開状態・Groupのリストを持つ。従来の単一の「グループの集合（Magnet Allが一括実行していた範囲）」を複数に拡張したもの。
- **Side Panel**: 拡張機能のメインUI。`chrome.sidePanel` API で表示されるパネル。
- **Magnet (実行)**: 指定されたGroupのURLパターンにマッチするタブを現在のウィンドウに集約し、TabMagnetグループとしてグループ化する操作。
- **Magnet All (セット実行)**: 指定されたGroup-Setに含まれる全GroupのMagnetを順次一括実行する操作。従来の「Magnet All」と同等の処理をGroup-Set単位で行う。
- **Color**: Chrome tabGroups API が定義する9色（grey, blue, red, yellow, green, pink, purple, cyan, orange）のいずれか、またはCOLOR_COMPATIBILITY_MAPで定義された互換色。
- **Local Storage**: `chrome.storage.local`。拡張機能がインストールされた端末内のローカルストレージ領域。
- **Sync Storage**: `chrome.storage.sync`。同一アカウント・同一ブラウザ間で同期されるストレージ領域。
- **Old Format**: 移行前の従来データ形式。`targets`（`{name, pattern, color}` の配列）と `settings` を保持する構造。
- **New Format**: 移行後の新データ形式。`groupSets`（`{name, color, expanded, groups}` の配列）と `settings` を保持する構造。
- **Migration**: Old Format から New Format へのデータ構造変換処理。
- **Validation**: インポート・同期・UI入力時のデータ構造・型・上限値の検証処理。
- **M3 Design**: Material Design 3。Googleのオープンソースデザインシステム。本プロジェクトではCSS変数でM3トークンをネイティブに再現する。

## Requirements

### Requirement 1: グループセットのデータモデル

**User Story:** 利用者として、複数のグループセットを作成・管理できるようにしたい。それは、目的や場面に応じてグループを整理し、切り替えて使えるようにするためである。

#### Acceptance Criteria

1. THE TabMagnet-Solo SHALL `chrome.storage.local` に `groupSets` キーで Group-Set の配列を保存する。各 Group-Set は `name`（文字列）、`color`（Color）、`expanded`（真偽値）、`groups`（Group の配列）の4プロパティを持つ。
2. THE TabMagnet-Solo SHALL `groupSets` 配列の要素数を1以上20以下に制限する。
3. THE TabMagnet-Solo SHALL 各 Group-Set の `groups` 配列の要素数を0以上100以下に制限する。
4. WHEN 新規インストール時、THE TabMagnet-Solo SHALL 1つのGroup-Set（名前「(名称未設定)」、en: 「(Untitled)」、カラー「grey」、展開状態「true」、空の `groups` 配列）を持つ `groupSets` を生成して保存する。
5. WHEN `groupSets` が空配列または未定義で読み込まれた場合、THE TabMagnet-Solo SHALL 受入基準4と同一のデフォルトGroup-Setを生成する。
6. WHILE `settings` は New Format でも Old Format と同一のプロパティ構成を維持する。

### Requirement 2: グループセット行のUI表示

**User Story:** 利用者として、サイドパネルのメインリストに各グループセットが区別して表示されてほしい。それは、複数のグループセットを一目で識別し、目的のセットを選択できるようにするためである。

#### Acceptance Criteria

1. THE Side Panel SHALL メインリストの各Group-Setについて1行の「Group-Set行」をGroup-Setの順序通りに上から下へ表示する。
2. THE Side Panel SHALL 各Group-Set行を左から右へ「開閉ボタン」「カラードット」「Group-Set名」…「編集ボタン」「実行ボタン」の順に構成する。
3. THE Side Panel SHALL 「開閉ボタン」を従来のドラッグハンドル領域（48px幅）に配置し、ドラッグによる並べ替え機能をGroup-Set行から削除する。
4. THE Side Panel SHALL カラードットにGroup-Setの `color` プロパティの色を反映する。
5. THE Side Panel SHALL 従来の「Magnet All」固定表示をGroup-Set名の表示に置き換える。
6. THE Side Panel SHALL Group-Set名のテキストが領域幅を超える場合、末尾を省略記号で切り詰めて表示する。

### Requirement 3: グループセットの展開・縮小

**User Story:** 利用者として、グループセットに含まれるグループを表示・非表示に切り替えたい。それは、多数のグループセットがある時に表示をすっきりさせ、必要なセットの内容だけを確認できるようにするためである。

#### Acceptance Criteria

1. WHEN サイドパネルを開いた時、THE Side Panel SHALL 全てのGroup-Setを展開状態（含まれるGroupを表示）で表示する。
2. WHEN 利用者が展開状態のGroup-Set行の開閉ボタンを押した時、THE Side Panel SHALL 該当Group-Setを縮小状態（含まれるGroupを非表示）に切り替える。
3. WHEN 利用者が縮小状態のGroup-Set行の開閉ボタンを押した時、THE Side Panel SHALL 該当Group-Setを展開状態に切り替える。
4. WHEN Group-Setの展開状態が切り替わった時、THE TabMagnet-Solo SHALL 該当Group-Setの `expanded` プロパティを新しい状態で `chrome.storage.local` に保存する。
5. WHILE Group-Setが展開状態の場合、THE Side Panel SHALL 該当Group-Setに含まれる各Groupの行をGroup-Set行の直下に順次表示する。
6. WHILE Group-Setが縮小状態の場合、THE Side Panel SHALL 該Group-Setに含まれるGroupの行を非表示にする。
7. THE Side Panel SHALL 開閉ボタンのアイコンを展開状態と縮小状態で視覚的に区別する。

### Requirement 4: グループセットの編集メニューダイアログ

**User Story:** 利用者として、グループセット行の編集ボタンから様々な操作を選択したい。それは、グループの追加、グループセットの編集、セットの並べ替えを1箇所から行えるようにするためである。

#### Acceptance Criteria

1. THE Side Panel SHALL 各Group-Set行に編集ボタン（鉛筆アイコンのM3シンボル）をGroup-Set名の右側、実行ボタンの左側に配置する。
2. WHEN 利用者が編集ボタンを押した時、THE Side Panel SHALL 選択肢ダイアログを表示する。
3. THE Side Panel SHALL 選択肢ダイアログに「新規グループの追加」「表示中タブから新規グループを追加」「グループセットを編集」「上に移動」「下に移動」の5つの選択肢を表示する。
4. WHEN 利用者が「新規グループの追加」を選択した時、THE Side Panel SHALL 従来の「+新規グループ」ボタン押下時と同等のGroup新規作成モーダルを表示する。新規Groupは該当Group-Setの `groups` 配列末尾に追加される。
5. WHEN 利用者が「表示中タブから新規グループを追加」を選択した時、THE Side Panel SHALL 従来の「+表示中タブのグループ」ボタン押下時と同等の挙動（現在アクティブなタブのドメインからGroupを自動生成し、Group新規作成モーダルに反映）を実行する。生成されたGroupは該当Group-Setの `groups` 配列末尾に追加される。
6. WHEN 利用者が「グループセットを編集」を選択した時、THE Side Panel SHALL グループセット編集ダイアログを表示する。
7. THE Side Panel SHALL 選択肢ダイアログをモーダルとしてM3 Designに準拠したスタイルで表示する。

### Requirement 5: グループセットの編集ダイアログ

**User Story:** 利用者として、グループセットの名前と色を編集したい。それは、グループセットを見分けやすくし、目的に応じた名前と色を付けられるようにするためである。

#### Acceptance Criteria

1. THE Side Panel SHALL グループセット編集ダイアログにGroup-Set名入力欄とカラー選択UIを表示する。
2. THE Side Panel SHALL カラー選択UIにGroup編集ダイアログと同一の9色（ブラウザに応じた並び順）の選択肢を表示する。
3. WHEN グループセット編集ダイアログが開かれた時、THE Side Panel SHALL 現在のGroup-Setの `name` と `color` を各入力欄に初期値として設定する。
4. THE Side Panel SHALL グループセット編集ダイアログの最下部に左から「削除」「キャンセル」「保存」の3ボタンをGroup編集ダイアログと同一の配置で表示する。
5. WHEN 利用者が「保存」ボタンを押した時、THE TabMagnet-Solo SHALL 入力されたGroup-Set名とカラーを該当Group-Setに適用し、`chrome.storage.local` に保存してダイアログを閉じる。
6. WHEN 利用者が「キャンセル」ボタンを押した時、THE TabMagnet-Solo SHALL 変更を適用せずにダイアログを閉じる。
7. WHEN 利用者が「保存」ボタンを押した時、THE TabMagnet-Solo SHALL Group-Set名が空文字または空白のみの場合、保存を中断してフィードバックメッセージを表示する。

### Requirement 6: グループセットの削除

**User Story:** 利用者として、不要になったグループセットを削除したい。それは、整理された状態を保ち、使わないセットを取り除けるようにするためである。

#### Acceptance Criteria

1. WHILE `groupSets` 配列の要素数が2以上の場合、THE Side Panel SHALL グループセット編集ダイアログの「削除」ボタンを有効状態で表示する。
2. WHILE `groupSets` 配列の要素数が1の場合、THE Side Panel SHALL グループセット編集ダイアログの「削除」ボタンを無効状態で表示する。
3. WHILE 「削除」ボタンが無効状態の場合、THE Side Panel SHALL ボタンを押しても反応しない。
4. WHEN 利用者が有効状態の「削除」ボタンを押した時、THE Side Panel SHALL 削除確認ダイアログを表示する。
5. WHEN 利用者が削除確認ダイアログで削除を確定した時、THE TabMagnet-Solo SHALL 該当Group-Setおよび該Group-Setに含まれる全Groupを `groupSets` 配列から削除し、`chrome.storage.local` に保存する。
6. WHEN 利用者が削除確認ダイアログでキャンセルした時、THE TabMagnet-Solo SHALL 削除を実行せず確認ダイアログを閉じる。

### Requirement 7: グループセットの移動

**User Story:** 利用者として、グループセットの表示順序を変更したい。それは、よく使うセットを上位に配置し、作業しやすい並び順を作れるようにするためである。

#### Acceptance Criteria

1. WHILE `groupSets` 配列の要素数が2以上の場合、THE Side Panel SHALL 選択肢ダイアログの「上に移動」「下に移動」を有効状態で表示する。
2. WHILE `groupSets` 配列の要素数が1の場合、THE Side Panel SHALL 選択肢ダイアログの「上に移動」「下に移動」を無効状態で表示する。
3. WHILE 該当Group-Setが `groupSets` 配列の先頭（index 0）の場合、THE Side Panel SHALL 「上に移動」を無効状態で表示する。
4. WHILE 該当Group-Setが `groupSets` 配列の最後尾の場合、THE Side Panel SHALL 「下に移動」を無効状態で表示する。
5. WHEN 利用者が有効状態の「上に移動」を選択した時、THE TabMagnet-Solo SHALL 該当Group-Setを配列内で1つ前の位置に移動し、`chrome.storage.local` に保存してメインリストを再描画する。
6. WHEN 利用者が有効状態の「下に移動」を選択した時、THE TabMagnet-Solo SHALL 該当Group-Setを配列内で1つ後の位置に移動し、`chrome.storage.local` に保存してメインリストを再描画する。
7. THE Side Panel SHALL 「上に移動」「下に移動」が無効状態の場合、選択しても反応しない。

### Requirement 8: グループセットの実行（Magnet All）

**User Story:** 利用者として、グループセットの実行ボタンを押して含まれる全グループを一括実行したい。それは、セット単位でタブを整理し、場面に応じた一括集約を行えるようにするためである。

#### Acceptance Criteria

1. THE Side Panel SHALL 各Group-Set行の右端に実行ボタンを右寄せで配置する。
2. WHEN 該当Group-Setの `groups` 配列が空の場合、THE Side Panel SHALL 該当Group-Setの実行ボタンを無効状態で表示する。
3. WHEN 利用者が有効状態の実行ボタンを押した時、THE TabMagnet-Solo SHALL 該当Group-Setに含まれる全GroupのMagnetを順次実行する。
4. WHEN Group-SetのMagnet All実行が完了した時、THE TabMagnet-Solo SHALL `keepTMOrder` 設定が有効な場合、該当Group-SetのGroup順序に従ってTabMagnetグループを再整列する。
5. IF Group-Setの実行中にエラーが発生した場合、THEN THE TabMagnet-Solo SHALL エラーメッセージをToastで表示する。

### Requirement 9: フッターの変更

**User Story:** 利用者として、フッターから新しいグループセットを追加したい。それは、グループセットを増やす際の入り口を明確にするためである。

#### Acceptance Criteria

1. THE Side Panel SHALL 従来のフッターの「+新規グループ」「+表示中タブのグループ」の2ボタンを「+新規グループセット」の1ボタンに置き換える。
2. WHEN 利用者が「+新規グループセット」ボタンを押した時、THE TabMagnet-Solo SHALL 新規Group-Set（名前「(名称未設定)」/en: 「(Untitled)」、カラー「grey」、展開状態「true」、空の `groups` 配列）を `groupSets` 配列末尾に追加し、`chrome.storage.local` に保存する。
3. WHILE `groupSets` 配列の要素数が上限（20）に達している場合、THE Side Panel SHALL 「+新規グループセット」ボタンを無効状態で表示する。

### Requirement 10: グループセット内のグループ管理

**User Story:** 利用者として、各グループセット内でグループの追加・編集・削除・実行を行いたい。それは、セット単位でグループを整理し、個別に操作できるようにするためである。

#### Acceptance Criteria

1. WHILE Group-Setが展開状態の場合、THE Side Panel SHALL 含まれる各Groupの行をGroup編集ダイアログの表示機能を用いて操作可能にする。Group行のレイアウトは従来通り「ドラッグハンドル」「カラードット」「Group名」「実行ボタン」とする。
2. WHEN 利用者がGroup行をクリックした時、THE Side Panel SHALL 該当GroupのGroup編集ダイアログを表示する。
3. WHEN 利用者がGroup行の実行ボタンを押した時、THE TabMagnet-Solo SHALL 該当GroupのMagnetを実行する。
4. WHEN 利用者がGroup編集ダイアログでGroupを保存した時、THE TabMagnet-Solo SHALL 該当Groupが属するGroup-Setの `groups` 配列に変更を反映し、`chrome.storage.local` に保存する。
5. WHEN 利用者がGroup編集ダイアログでGroupを削除した時、THE TabMagnet-Solo SHALL 該当Groupを属するGroup-Setの `groups` 配列から削除し、`chrome.storage.local` に保存する。
6. WHEN 利用者がGroup-Set内でGroupのドラッグによる並べ替えを行った時、THE TabMagnet-Solo SHALL 該当Group-Setの `groups` 配列の順序を更新し、`chrome.storage.local` に保存する。
7. WHEN 該当Group-Setの `groups` 配列が空の場合、THE Side Panel SHALL Group行の代わりに「登録されたグループがありません」の案内テキストをGroup-Set行の直下に表示する。

### Requirement 11: ローカルストレージのデータ移行

**User Story:** 既存利用者として、拡張機能を更新してもこれまでのグループ設定が失われないでほしい。それは、更新後も継続して利用できるようにするためである。

#### Acceptance Criteria

1. WHEN `chrome.storage.local` に `groupSets` キーが存在せず `targets` キーが存在する場合、THE TabMagnet-Solo SHALL Old Formatの `targets` 配列を1つのGroup-Set（名前「(名称未設定)」/en: 「(Untitled)」、カラー「grey」、展開状態「true」、`groups` に全 `targets` を変換して格納）に変換し、`groupSets` として `chrome.storage.local` に保存する。
2. WHEN ローカルストレージの移行が完了した時、THE TabMagnet-Solo SHALL `targets` キーを `chrome.storage.local` から削除する。
3. WHEN `chrome.storage.local` に `groupSets` キーも `targets` キーも存在しない場合、THE TabMagnet-Solo SHALL 受入基準1-4のデフォルトGroup-Setを生成して保存する。
4. WHEN `chrome.storage.local` に `groupSets` キーが既に存在する場合、THE TabMagnet-Solo SHALL 移行処理をスキップし、既存の `groupSets` を使用する。
5. WHEN Old Formatの `targets` 配列が空配列の場合、THE TabMagnet-Solo SHALL 空の `groups` 配列を持つデフォルトGroup-Setを生成する。

### Requirement 12: 同期ストレージのデータ移行

**User Story:** 端末間同期を利用している利用者として、更新後も同期先から古い形式のデータが入ってきても適切に処理されてほしい。それは、同期環境でもデータ整合性を保つためである。

#### Acceptance Criteria

1. WHEN `chrome.storage.sync` に `groupSets` キーが存在せず `targets` キーが存在する場合、THE TabMagnet-Solo SHALL Old Formatの `targets` 配列を1つのGroup-Setに変換し、`groupSets` として `chrome.storage.local` に反映する。
2. WHEN `chrome.storage.sync` に `groupSets` キーが存在する場合、THE TabMagnet-Solo SHALL 同期先の `groupSets` を `chrome.storage.local` に反映する。
3. WHEN `syncEnabled` 設定が有効な場合、THE TabMagnet-Solo SHALL `chrome.storage.sync` に `groupSets` と `settings` を保存し、`targets` キーは保存しない。
4. WHEN `chrome.storage.sync` からOld Formatの `targets` が変更通知で受信された場合、THE TabMagnet-Solo SHALL 該当データをGroup-Set形式に移行してからローカルに反映する。
5. THE TabMagnet-Solo SHALL 同期ストレージの移行処理で `syncEnabled` フラグはローカル端末の現在値を保持する。

### Requirement 13: インポート・エクスポートの互換性

**User Story:** 利用者として、更新前にエクスポートしたデータを更新後にインポートしても正しく取り込まれてほしい。それは、バージョン更新を挟んだデータの受け渡しを安全に行えるようにするためである。

#### Acceptance Criteria

1. WHEN 利用者がエクスポートを実行した時、THE TabMagnet-Solo SHALL `groupSets` と `settings`（`syncEnabled` は `false` に固定）を含む New Format のJSONデータを出力する。
2. WHEN インポートデータに `groupSets` キーが存在する場合、THE TabMagnet-Solo SHALL 該当データを New Format としてバリデーションして取り込む。
3. WHEN インポートデータに `groupSets` キーが存在せず `targets` キーが存在する場合、THE TabMagnet-Solo SHALL Old Format の `targets` を1つのGroup-Setに移行してから取り込む。
4. WHEN インポートモードが「追記（append）」の場合、THE TabMagnet-Solo SHALL インポートされたGroup-Setを既存の `groupSets` 配列末尾に追加する。
5. WHEN インポートモードが「上書き（overwrite）」の場合、THE TabMagnet-Solo SHALL 既存の `groupSets` 配列をインポートデータで置き換える。
6. WHEN インポートデータのバリデーションに失敗した場合、THE TabMagnet-Solo SHALL インポートを中断しエラーメッセージをToastで表示する。

### Requirement 14: 新データ形式のバリデーション

**User Story:** 開発者として、インポート・同期データが常に妥当な構造であることを保証したい。それは、データ破損や悪意のあるデータによる不具合を防ぐためである。

#### Acceptance Criteria

1. THE TabMagnet-Solo SHALL `groupSets` が配列であることを検証し、配列でない場合はエラーを発生させる。
2. THE TabMagnet-Solo SHALL 各Group-Setが `name`、`color`、`expanded`、`groups` の4プロパティのみを持つことを検証し、それ以外のプロパティが存在する場合はエラーを発生させる。
3. THE TabMagnet-Solo SHALL Group-Setの `name` が1文字以上100文字以下の文字列であることを検証する。
4. THE TabMagnet-Solo SHALL Group-Setの `color` がColor定義（ALL_COLORS または COLOR_COMPATIBILITY_MAP のキー）のいずれかであることを検証する。
5. THE TabMagnet-Solo SHALL Group-Setの `expanded` が真偽値であることを検証する。
6. THE TabMagnet-Solo SHALL Group-Setの `groups` が配列であり、要素数が100以下であることを検証する。
7. THE TabMagnet-Solo SHALL 各Groupが従来の `validateImportData` と同等の検証（`name`/`pattern`/`color` のプロパティ構成、文字列長、パターン件数・長さ、色の有効性）を満たすことを検証する。
8. THE TabMagnet-Solo SHALL Old Format（`targets` キーを持つデータ）のバリデーションを後方互換性のため維持する。
9. WHEN `groupSets` 配列の要素数が上限（20）を超える場合、THE TabMagnet-Solo SHALL エラーを発生させる。

### Requirement 15: i18n対応

**User Story:** 利用者として、UIの文言が自分の言語（日本語/英語）で表示されてほしい。それは、言語の壁なく直感的に操作できるようにするためである。

#### Acceptance Criteria

1. THE TabMagnet-Solo SHALL `_locales/ja/messages.json` と `_locales/en/messages.json` の両方に、Group-Set機能で使用する全メッセージキーを定義する。
2. THE TabMagnet-Solo SHALL デフォルトGroup-Set名「(名称未設定)」/「(Untitled)」をi18nメッセージキーとして定義し、`chrome.i18n.getMessage` を介して取得する。
3. THE TabMagnet-Solo SHALL 選択肢ダイアログの5選択肢（「新規グループの追加」「表示中タブから新規グループを追加」「グループセットを編集」「上に移動」「下に移動」）および「+新規グループセット」フッターボタンのラベルをi18nメッセージキーとして定義する。
4. THE TabMagnet-Solo SHALL グループセット編集ダイアログのGroup-Set名入力欄のプレースホルダ、削除確認ダイアログのメッセージをi18nメッセージキーとして定義する。
5. THE TabMagnet-Solo SHALL 既存の `magnetAll` メッセージキーをGroup-Set名表示用に再利用可能な形で維持する。

### Requirement 16: Material 3 Design準拠

**User Story:** 利用者として、新しいグループセットUIが既存のM3 Designに統一されてほしい。それは、一貫した清潔感のある操作感を保つためである。

#### Acceptance Criteria

1. THE Side Panel SHALL Group-Set行の高さ、余白、タイポグラフィを既存のGroup行と同一のM3トークンで構成する。
2. THE Side Panel SHALL 開閉ボタン、編集ボタン、実行ボタンのサイズを48×48pxのM3 icon-buttonとして既存のicon-buttonスタイルに準拠させる。
3. THE Side Panel SHALL 選択肢ダイアログをM3 Dialog（surface-container-highest背景、28px角丸）のスタイルで表示する。
4. THE Side Panel SHALL グループセット編集ダイアログを既存のGroup編集モーダルと同一のM3 Modalスタイルで表示する。
5. THE Side Panel SHALL 「+新規グループセット」フッターボタンを既存のfooter-buttonスタイル（48px高、24px角丸）で表示する。

### Requirement 17: アクセシビリティ

**User Story:** 利用者として、キーボード操作とスクリーンリーダーでグループセット機能を利用したい。それは、マウス操作に依存せずに全ての機能にアクセスできるようにするためである。

#### Acceptance Criteria

1. THE Side Panel SHALL 開閉ボタンに `aria-expanded` 属性を設定し、展開状態に応じて `true`/`false` を切り替える。
2. THE Side Panel SHALL 開閉ボタンに `aria-label` を設定し、展開・縮小の状態と対象Group-Set名を音声で伝達する。
3. THE Side Panel SHALL 編集ボタンと実行ボタンに `aria-label` を設定し、操作内容と対象Group-Set名を音声で伝達する。
4. THE Side Panel SHALL 全てのボタンがキーボードのTabキーでフォーカス可能であり、EnterキーまたはSpaceキーで実行可能であることを保証する。
5. THE Side Panel SHALL 無効状態のボタンに `disabled` 属性を設定し、フォーカス・操作を無効にする。

### Requirement 18: ユニットテスト

**User Story:** 開発者として、グループセット機能の品質をユニットテストで保証したい。それは、リグレッションを防ぎ、安全にリファクタリングできるようにするためである。

#### Acceptance Criteria

1. THE TabMagnet-Solo SHALL 新データ形式のバリデーション関数（`groupSets` 構造検証、プロパティ検証、上限値検証）に対するユニットテストをJest + JSDOMで実装する。
2. THE TabMagnet-Solo SHALL Old FormatからNew Formatへの移行関数に対するユニットテストを実装する。テストケースは「`targets` 存在」「`targets` 空配列」「`groupSets` 既存」「両方未定義」を含む。
3. THE TabMagnet-Solo SHALL グループセットの並べ替え（上に移動・下に移動）ロジックに対するユニットテストを実装する。
4. THE TabMagnet-Solo SHALL グループセットの削除（Group-Set数1と2以上の場合、含まれるGroupの削除）ロジックに対するユニットテストを実装する。
5. THE TabMagnet-Solo SHALL Group-Setの追加（上限値到達時の挙動含む）ロジックに対するユニットテストを実装する。
6. THE TabMagnet-Solo SHALL 既存の全ユニットテストがNew Formatに対応するよう更新され、全テストが成功することを保証する。

### Requirement 19: E2Eテスト

**User Story:** 開発者として、グループセット機能のエンドツーエンドの動作を保証したい。それは、実際のブラウザ環境での統合的な挙動を検証するためである。

#### Acceptance Criteria

1. THE TabMagnet-Solo SHALL Playwrightでグループセットの開閉操作のE2Eテストを実装する。
2. THE TabMagnet-Solo SHALL Playwrightでグループセット編集メニューから各選択肢（新規グループ追加、グループセット編集、移動）を実行するE2Eテストを実装する。
3. THE TabMagnet-Solo SHALL Playwrightでグループセットの削除（確認ダイアログ経由）のE2Eテストを実装する。
4. THE TabMagnet-Solo SHALL Playwrightでフッターの「+新規グループセット」ボタンによる新規セット追加のE2Eテストを実装する。
5. THE TabMagnet-Solo SHALL PlaywrightでGroup-Set実行（Magnet All）のE2Eテストを実装する。

### Requirement 20: データ移行のテスト

**User Story:** 開発者として、データ移行が安全かつ確実に行われることを保証したい。それは、既存利用者のデータが失われる事故を防ぐためである。

#### Acceptance Criteria

1. THE TabMagnet-Solo SHALL Old Formatの `targets`（複数Groupを含む）からNew Formatへの移行が、全Groupの `name`/`pattern`/`color` を保持したまま行われることを検証するユニットテストを実装する。
2. THE TabMagnet-Solo SHALL Old Formatのエクスポートファイル（`targets` + `settings`）をインポートした際に、1つのGroup-Setに移行されて取り込まれることを検証するテストを実装する。
3. THE TabMagnet-Solo SHALL New Formatのエクスポートファイル（`groupSets` + `settings`）をインポートした際に、そのまま取り込まれることを検証するテストを実装する。
4. THE TabMagnet-Solo SHALL `chrome.storage.sync` からOld Formatの `targets` が通知された際の移行処理を検証するテストを実装する。
5. THE TabMagnet-Solo SHALL 移行後に `targets` キーが `chrome.storage.local` から削除されることを検証するテストを実装する。

### Requirement 21: 制約事項

**User Story:** プロジェクト管理者として、機能追加がプロジェクトの基本原則と整合することを保証したい。それは、プライバシー・ローカル完結・ライブラリ非依存の原則を維持するためである。

#### Acceptance Criteria

1. THE TabMagnet-Solo SHALL 権限を変更せず、従来通り `tabs`、`tabGroups`、`storage`、`sidePanel` のみを使用する。
2. THE TabMagnet-Solo SHALL 外部OSS（UIフレームワーク、ユーティリティライブラリ等）に依存せず、Pure Vanilla JSで実装する。
3. THE TabMagnet-Solo SHALL 収集・設定したデータ、履歴、各種状態をすべて `chrome.storage.local` および `chrome.storage.sync` に保存し、外部サーバーへの送信を行わない。
4. WHEN 機能拡張を含むため、THE TabMagnet-Solo SHALL マイナーバージョンをインクリメント（1.19.2 -> 1.20.0）し、`manifest.json`、`package.json`、`package-lock.json`、`README.md` のバッジのすべてでバージョンの整合性を保つ。
5. THE TabMagnet-Solo SHALL 既存のGroup編集ダイアログ、削除確認ダイアログ、設定モーダル、タブグループ集約（Magnet）ロジックの基本動作を維持し、Group-Set階層を追加する形で拡張する。
6. THE TabMagnet-Solo SHALL 開発用の一時ファイルや不要なログをプロジェクトルートに残さない。

### Requirement 22: パフォーマンス

**User Story:** 利用者として、グループセット機能を追加してもサイドパネルの表示・操作が快適に保たれてほしい。それは、多数のグループセットがあってももたつきを感じないようにするためである。

#### Acceptance Criteria

1. WHEN Group-Set数が上限（20）で各Group-Setが100Groupを含む最大構成の場合、THE Side Panel SHALL メインリストの初期描画を500ミリ秒以内に完了する。
2. WHEN Group-Setの開閉ボタンを押した時、THE Side Panel SHALL 100ミリ秒以内に展開・縮小の表示切り替えを完了する。
3. WHEN Group-Setの移動操作を実行した時、THE TabMagnet-Solo SHALL メインリストの再描画を200ミリ秒以内に完了する。
4. THE TabMagnet-Solo SHALL URLパターンマッチングのキャッシュ機構（patternPartsCache）を維持し、Group-Set階層の追加によるマッチング性能の劣化を発生させない。
