# Implementation Plan: multi-group-sets

## Overview

本ドキュメントは、TabMagnet-Solo に「マルチグループセット（multi-group-sets）」機能を実装するためのタスク計画を定義する。設計書（design.md）の16個の Correctness Properties に基づき、各実装タスクに対応するプロパティテストを配置する。

実装は以下の論理順序で進める:
1. **基盤**: 定数・データモデル・バリデーション・移行関数（constants.js, utils.js）と状態管理（state.js）
2. **UI基盤**: HTML構造（sidepanel.html）と階層描画（list-renderer.js）
3. **Group-Setモジュール**: 新規モジュール group-set.js の作成
4. **統合**: 既存モジュール（modal-target.js, dialog-delete.js, modal-settings.js）の Group-Set 対応
5. **オーケストレーション**: sidepanel.js と background.js の Group-Set 操作・イベント接続
6. **i18n**: メッセージキー追加
7. **テスト**: ユニットテスト（Jest + JSDOM）と E2Eテスト（Playwright）
8. **バージョン更新**: 1.19.2 → 1.20.0（マイナーアップ）

実装言語は JavaScript（Pure Vanilla JS）。テストは Jest + JSDOM（ユニット）、Playwright（E2E）。

## Tasks

- [ ] 0. design.md の更新
  - [ ] 0.1 design.md の Testing Strategy と File Structure に tests/sidepanel.test.js を追記する
    - Testing Strategy のテストファイル一覧表に `tests/sidepanel.test.js`（インポート/エクスポート、handleConfirmDelete、handleSaveTarget、handleAddFromDomain、ストレージ変更リスナー）を「更新」として追記
    - File Structure に `tests/sidepanel.test.js` を追記
    - _依存: なし_
    - _要件: 18.6_

- [ ] 1. 定数とデータモデルの基盤
  - [ ] 1.1 constants.js に Group-Set 上限制約・許可プロパティの定数を追加する
    - `MAX_GROUP_SETS`（20）、`MAX_GROUPS_PER_SET`（100）、`MAX_GROUP_SET_NAME_LENGTH`（100）を追加
    - `ALLOWED_GROUP_SET_PROPERTIES`（`name`, `color`, `expanded`, `groups` の Set）を追加
    - `ALLOWED_GROUP_SET_IMPORT_PROPERTIES`（`groupSets`, `targets`, `settings` の Set）を追加
    - 既存の `ALL_COLORS`, `COLORS_CHROME`, `COLORS_EDGE`, `COLOR_COMPATIBILITY_MAP` は変更しない
    - _依存: なし_
    - _要件: 1.2, 1.3, 14.2, 14.9_

  - [ ] 1.2 utils.js に validateSingleTarget 関数を抽出し validateImportData を拡張する
    - 既存の `validateImportData` 内の target 単体検証ロジックを `validateSingleTarget(target)` として関数抽出する（単一ソース化）
    - `validateImportData` を `groupSets` キーの検証に対応: `groupSets` が存在する場合は `validateGroupSets` を呼び出し、`targets` が存在する場合は従来の targets 検証（`validateSingleTarget` 経由）を呼び出す。両方存在する場合は `groupSets` を優先し `targets` は無視
    - `ALLOWED_IMPORT_PROPERTIES` を `groupSets` を含む集合に拡張
    - 既存の Old Format（`targets`）検証は後方互換のため維持する
    - _依存: 1.1_
    - _要件: 14.7, 14.8_

  - [ ] 1.3 utils.js に validateGroupSet / validateGroupSets バリデーション関数を追加する
    - `validateGroupSet(groupSet)`: 4プロパティのみ保持（`validateAllowedProperties` 使用）、`name`（1-100文字の文字列）、`color`（`ALLOWED_TARGET_COLORS` 検証）、`expanded`（真偽値）、`groups`（配列・100以下）を検証。各Groupは `validateSingleTarget` で検証
    - `validateGroupSets(groupSets)`: 配列判定、要素数20以下、各Group-Setを `validateGroupSet` で検証
    - `MAX_TARGET_COLOR_LENGTH`, `ALLOWED_TARGET_COLORS` など既存定数を再利用（constants.js に既存の場合は確認、未存在なら 1.1 で追加）
    - _依存: 1.1, 1.2_
    - _要件: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.9, 1.2, 1.3_

  - [ ]* 1.4 プロパティテスト: バリデーションは全ての不正な groupSets 構造を拒否する
    - **Property 15: バリデーションは全ての不正な groupSets 構造を拒否する**
    - `validateGroupSets` が以下の全ケースでエラーを投げることを検証: 配列でない値、4プロパティ以外を持つ要素、`name` が空/空白のみ/101文字超、`color` が無効色、`expanded` が真偽値でない、`groups` が配列でない/101要素超、`groups` 内Groupが `validateSingleTarget` 違反、21要素超
    - 有効な Old Format（`targets` キーを持つデータ）は `validateImportData` でエラーにならないことを検証
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 1.2, 1.3**
    - _依存: 1.3_
    - _テストファイル: tests/utils.test.js_

  - [ ] 1.5 utils.js に移行関数（createDefaultGroupSet, migrateTargetsToGroupSets, resolveGroupSets）を追加する
    - `createDefaultGroupSet()`: `chrome.i18n.getMessage('defaultGroupSetName')` でデフォルト名を取得(引数なし)。setIndex 引数は廃止。`{name, color:'grey', expanded:true, groups:[]}` を返す
    - `migrateTargetsToGroupSets(targets)`: 全targetsの `name`/`pattern`/`color` を保持し、`color` は `getCompatibleColor` 適用後の値でGroup-Setに変換する。空配列の場合は空の `groups` を持つデフォルトGroup-Setを生成
    - `resolveGroupSets(rawData)`: 優先順位 1) `groupSets` が配列→そのまま、2) `targets` が配列→移行、3) いずれもなし→デフォルト生成。`{groupSets, migrated, needsCleanup}` を返す
    - _依存: 1.1, 1.2_
    - _要件: 1.4, 1.5, 11.1, 11.5_

  - [ ]* 1.6 プロパティテスト: データ移行は全Groupの name/pattern/color を保全する
    - **Property 11: データ移行は全Groupの name/pattern/color を保全する**
    - `migrateTargetsToGroupSets(targets)` が生成するGroup-Setの `groups` 配列が元の `targets` と同じ要素数を持ち、各要素の `name`/`pattern`/`color`（互換マッピング適用後）が等価であることを検証
    - 空配列の場合は空の `groups` を持つデフォルトGroup-Setが生成されることを検証
    - **Validates: Requirements 11.1, 11.5, 13.3, 20.1**
    - _依存: 1.5_
    - _テストファイル: tests/migration.test.js_

  - [ ]* 1.7 プロパティテスト: 空状態は常に有効なデフォルトgroupSetsを生成する
    - **Property 2: 空状態は常に有効なデフォルトgroupSetsを生成する**
    - 空配列・未定義・null のいずれかの入力に対し、`resolveGroupSets` が1以上20以下の要素を持ち、各要素が4プロパティを持つ有効な `groupSets` 配列を返すことを検証
    - **Validates: Requirements 1.4, 1.5**
    - _依存: 1.5_
    - _テストファイル: tests/utils.test.js_

- [ ] 2. 状態管理の更新
  - [ ] 2.1 state.js の state 構造を groupSets 化し編集/削除状態を汎用化する
    - `state.targets` を `state.groupSets` に置き換え
    - `state.currentEditIndex` を `state.currentEdit`（`{setIndex, groupIndex}`）に拡張
    - `state.currentDeleteIndex` を `state.currentDelete`（`{type:'group'|'groupSet', setIndex, groupIndex}`）に拡張
    - `state.currentEditSetIndex`, `state.selectedSetColor` を追加
    - `state.selectedColor` は維持（Group編集用）
    - _依存: 1.1_
    - _要件: 1.1_

  - [ ] 2.2 state.js の loadState を移行対応し saveTargets を saveGroupSets にリネームする
    - `loadState`: `chrome.storage.local.get` を `['groupSets', 'targets', 'settings']` に拡張し、`resolveGroupSets` を呼び出して `groupSets` を決定。`migrated` が true で `needsCleanup` が true の場合、`chrome.storage.local.remove('targets')` を実行し `groupSets` を保存
    - `saveTargets` を `saveGroupSets(groupSets)` にリネーム: `state.groupSets` を `chrome.storage.local` に保存。`syncEnabled` 時は `chrome.storage.sync` に `groupSets` と `settings` を保存（`targets` は保存しない）
    - `syncFromCloudIfNeeded`（utils.js）の groupSets 対応は 8.6 で実装
    - _依存: 1.5, 2.1_
    - _要件: 1.1, 11.1, 11.2, 11.3, 11.4, 12.3_

  - [ ]* 2.3 プロパティテスト: groupSets シリアライズのラウンドトリップ
    - **Property 1: groupSets シリアライズのラウンドトリップ**
    - 有効な `groupSets` 配列と `settings` オブジェクトを `saveGroupSets` で保存した後に `loadState` で読み込んだ結果が、元の `groupSets`（各Group-Setの `name`/`color`/`expanded`/`groups` を含む）および `settings` と等価であることを検証
    - **Validates: Requirements 1.1, 1.6, 3.4**
    - _依存: 2.2_
    - _テストファイル: tests/ui-state.test.js_

  - [ ]* 2.4 プロパティテスト: 移行処理は syncEnabled フラグをローカル値で保持する
    - **Property 12: 移行処理は syncEnabled フラグをローカル値で保持する**
    - ローカルの `syncEnabled` 値 `s` と同期ストレージからの任意の移行データに対し、移行処理後に `state.settings.syncEnabled` が元の `s` と等しいことを検証
    - **Validates: Requirements 12.5**
    - _依存: 2.2_
    - _テストファイル: tests/ui-state.test.js_

- [ ] 3. Checkpoint — 基盤実装の検証
  - 基盤層（constants.js, utils.js, state.js）の実装が完了していることを確認する。全テストが通ることを確認し、質問があればユーザーに確認する。

- [ ] 4. UI基盤の更新
  - [ ] 4.1 sidepanel.html に Group-Set行・編集メニューダイアログ・グループセット編集ダイアログ・フッターのHTMLを追加する
    - 従来の先頭固定「Magnet All」行のHTMLを削除
    - Group-Set行テンプレート: 開閉ボタン（`aria-expanded`）、カラードット、Group-Set名（ellipsis）、編集ボタン、実行ボタンを配置
    - 編集メニューダイアログ: `#gs-edit-menu-scrim` に5つの選択肢リスト（`gsEditMenuAddGroup`, `gsEditMenuAddFromDomain`, `gsEditMenuEditSet`, `gsEditMenuMoveUp`, `gsEditMenuMoveDown`）をM3 Dialog（surface-container-highest、28px角丸）スタイルで追加
    - グループセット編集ダイアログ: `#gs-edit-modal-scrim` にGroup-Set名入力欄（`#gs-edit-name`）、カラーセレクション、削除/キャンセル/保存ボタンをGroup編集モーダルと同一のM3 Modalスタイルで追加
    - フッター: 従来の `add-new-btn`/`add-from-domain-btn` を `add-group-set-btn`（1ボタン）に置き換え
    - 全ての新規要素に `data-i18n`/`data-i18n-aria-label`/`data-i18n-placeholder` 属性を付与
    - _依存: 1.1_
    - _要件: 2.1, 2.2, 2.5, 4.1, 4.2, 4.7, 5.1, 5.2, 5.4, 9.1, 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ] 4.2 list-renderer.js を Group-Set階層描画に拡張する
    - `renderTargetList(onEditGroup, onEditGroupSet)` に拡張: 従来の先頭固定「Magnet All」行を削除し、Group-Set行とGroup行の階層描画に変更
    - `createGroupSetRow(groupSet, setIndex, onEditGroupSet)`: Group-Set行を生成。開閉ボタン（`aria-expanded`/`aria-label`）、カラードット（`bg-{color}`）、名前（`text-overflow: ellipsis`）、編集ボタン、実行ボタン（`groups.length === 0` で `disabled`）を配置。Group-Set行はドラッグ不可（`draggable` 未設定）
    - `createGroupRow(group, setIndex, groupIndex, onEditGroup)`: 従来のGroup行描画ロジックを関数抽出。`data-set-index`/`data-group-index` 属性を付与。ドラッグ可能（`draggable=true`）
    - `createEmptyGroupSetNotice()`: 「登録されたグループがありません」の案内テキスト要素を生成
    - `handleDragOver`/`setupTouchDragList`: Group行のドラッグ並べ替えのみ対応。Group-Set行は `data-static` 相当で除外。ドラッグ完了時は該当Group-Set内の `groups` 配列順序のみ更新して `saveGroupSets`
    - Group行の実行ボタンは該当Groupの `executeMagnet` を呼び出し
    - Group-Set行の実行ボタンは該当Group-Setの `groups` を `executeAllMagnets` に渡して実行
    - `escapeHtml` は変更なし
    - _依存: 2.2, 4.1_
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.6, 3.1, 3.5, 3.6, 3.7, 8.1, 8.2, 10.1, 10.7, 16.1, 16.2, 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 4.3 プロパティテスト: 描画されたGroup-Set行は配列の件数・順序・色を反映する
    - **Property 3: 描画されたGroup-Set行は配列の件数・順序・色を反映する**
    - `renderTargetList` 後に生成されるGroup-Set行の数が `groupSets.length` と一致し、表示順序が配列の順序と一致し、各Group-Set行のカラードットのCSSクラスが該当Group-Setの `color` に対応することを検証
    - **Validates: Requirements 2.1, 2.4**
    - _依存: 4.2_
    - _テストファイル: tests/ui-list-renderer.test.js_

  - [ ]* 4.4 プロパティテスト: Group-Set行はドラッグ不可である
    - **Property 4: Group-Set行はドラッグ不可である**
    - `renderTargetList` 後に生成される全てのGroup-Set行要素が `draggable` 属性未設定または `false` であることを検証
    - **Validates: Requirements 2.3**
    - _依存: 4.2_
    - _テストファイル: tests/ui-list-renderer.test.js_

  - [ ]* 4.5 プロパティテスト: Group-Set内のGroupドラッグ並べ替えは該当セットのgroups順序のみ更新する
    - **Property 10: Group-Set内のGroupドラッグ並べ替えは該当セットのgroups順序のみ更新する**
    - Group-Set内でGroupのドラッグ並べ替えを行った場合、該当Group-Setの `groups` 配列の順序が更新され、要素集合は保存され、他のGroup-Setの `groups` 配列は変更されないことを検証
    - **Validates: Requirements 10.6**
    - _依存: 4.2_
    - _テストファイル: tests/ui-list-renderer.test.js_

- [ ] 5. Group-Setモジュールの新規作成
  - [ ] 5.1 group-set.js に編集メニューダイアログとグループセット編集ダイアログを実装する
    - `showGroupSetEditMenu(setIndex)`: 編集メニューダイアログを表示。5つの選択肢の有効/無効を `updateEditMenuButtonStates` で制御
    - `hideGroupSetEditMenu()`: 編集メニューダイアログを非表示
    - `showGroupSetModal(setIndex)`: グループセット編集ダイアログを表示。現在の `name`/`color` を初期値として設定。削除ボタンは `updateGroupSetDeleteButtonState` で制御
    - `hideGroupSetModal()`: グループセット編集ダイアログを非表示
    - `renderGroupSetColorOptions()`: Group-Set用カラーセレクション生成（`renderColorOptions` ロジックを再利用）
    - `selectGroupSetColor(color)`: Group-Set用カラー選択状態更新
    - `updateEditMenuButtonStates(setIndex)`: 編集メニューの有効/無効制御（新規グループ追加は groups 100到達時無効、上に移動は先頭または1つのみ時無効、下に移動は最後尾または1つのみ時無効）
    - `updateGroupSetDeleteButtonState()`: 削除ボタン有効/無効制御（groupSets 2以上で有効、1で無効）
    - _依存: 2.1, 4.1_
    - _要件: 4.1, 4.2, 4.3, 4.7, 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.7, 16.3, 16.4_

  - [ ] 5.2 group-set.js に操作ロジック（開閉トグル・移動・削除・追加・保存）を実装する
    - `toggleGroupSetExpanded(setIndex)`: 該当Group-Setの `expanded` を反転し `saveGroupSets` → `renderTargetList`
    - `moveGroupSet(setIndex, direction)`: 境界チェック（上移動は `setIndex > 0` かつ `length >= 2`、下移動は `setIndex < length - 1` かつ `length >= 2`）後、配列内でスワップし `saveGroupSets` → `renderTargetList`
    - `deleteGroupSet(setIndex)`: `groupSets.length >= 2` チェック後 `showDeleteDialog({type:'groupSet', setIndex})` を呼び出し（sidepanel.js の handleConfirmDelete で実際の削除を実行）
    - `addGroupSet()`: `groupSets.length < MAX_GROUP_SETS` チェック後、新規Group-Set（`createDefaultGroupSet()`、カラー grey、expanded true、空 groups）を末尾に追加し `saveGroupSets` → `renderTargetList`
    - `saveGroupSet(setIndex)`: 入力されたGroup-Set名が空文字・空白のみの場合は保存中断してフィードバック表示。有効な場合は `name`/`color` を該当Group-Setに適用し `saveGroupSets` → `hideGroupSetModal` → `renderTargetList`
    - _依存: 2.2, 5.1_
    - _要件: 3.2, 3.3, 3.4, 6.4, 6.5, 7.5, 7.6, 8.3, 9.2, 9.3, 5.5, 5.7_

  - [ ]* 5.3 プロパティテスト: expanded トグルは対合（involution）である
    - **Property 5: expanded トグルは対合（involution）である**
    - Group-Setの `expanded` 状態 `e` に対し、`toggleGroupSetExpanded` を2回連続で適用した結果の `expanded` が元の `e` と等しいこと（`toggle(toggle(e)) === e`）を検証
    - **Validates: Requirements 3.2, 3.3**
    - _依存: 5.2_
    - _テストファイル: tests/group-set.test.js_

  - [ ]* 5.4 プロパティテスト: 空白のみのGroup-Set名は保存を拒否される
    - **Property 6: 空白のみのGroup-Set名は保存を拒否される**
    - 空白文字（スペース・タブ・改行等）のみで構成される文字列をGroup-Set名として保存しようとした場合、保存が中断され `groupSets` 配列が変更されないことを検証
    - **Validates: Requirements 5.7**
    - _依存: 5.2_
    - _テストファイル: tests/group-set.test.js_

  - [ ]* 5.5 プロパティテスト: Group-Set削除は件数を1減らし他を保持する
    - **Property 7: Group-Set削除は件数を1減らし他を保持する**
    - 2以上の要素を持つ `groupSets` 配列と有効な削除インデックス `i` に対し、`deleteGroupSet(i)` 後の `groupSets.length` が元より1減少し、削除対象以外の全Group-Set（`name`/`color`/`expanded`/`groups` を含む）が保持されることを検証
    - **Validates: Requirements 6.5**
    - _依存: 5.2_
    - _テストファイル: tests/group-set.test.js_

  - [ ]* 5.6 プロパティテスト: Group-Set移動は要素集合を保存し順序のみ変化する
    - **Property 8: Group-Set移動は要素集合を保存し順序のみ変化する**
    - 2以上の要素を持つ `groupSets` 配列と移動可能なインデックス `i` に対し、`moveGroupSet(i, direction)` 後の `groupSets` が元の要素集合（全Group-Setの同一性）を保存し、順序のみが変化することを検証
    - **Validates: Requirements 7.5, 7.6**
    - _依存: 5.2_
    - _テストファイル: tests/group-set.test.js_

  - [ ]* 5.7 プロパティテスト: Group-Set上限到達時は追加が拒否される
    - **Property 16: Group-Set上限到達時は追加が拒否される**
    - 20要素の `groupSets` 配列に対し、新規Group-Setの追加が拒否され、`groupSets` 配列が20要素のままであることを検証
    - **Validates: Requirements 1.2, 9.3**
    - _依存: 5.2_
    - _テストファイル: tests/group-set.test.js_

- [ ] 6. 既存モジュールの統合
  - [ ] 6.1 modal-target.js を setIndex 対応に拡張する
    - `showTargetModal(groupIndex = null, setIndex = 0)` に引数を拡張
    - `state.currentEditIndex` 参照を `state.currentEdit.setIndex`/`state.currentEdit.groupIndex` に置き換え
    - 編集時は `state.groupSets[setIndex].groups[groupIndex]` から初期値を取得
    - 保存時は該当Group-Setの `groups` 配列に対して操作（新規は末尾追加、編集は上書き）
    - 削除時は該当Group-Setの `groups` 配列から削除
    - `renderColorOptions`, `selectColor`, `addPatternInput`, `hideModalFeedback`, `showModalFeedback`, `handlePatternDragOver`, `hideTargetModal` はロジック変更なし
    - _依存: 2.1, 4.1_
    - _要件: 10.2, 10.3, 10.4, 10.5_

  - [ ] 6.2 dialog-delete.js を汎用化し Group/Group-Set削除を区別する
    - `showDeleteDialog(target)`: 引数を `{type:'group'|'groupSet', setIndex, groupIndex}` に拡張し `state.currentDelete` に設定
    - `type` に応じて削除確認メッセージを切り替え（Group-Setは `confirmDeleteGroupSet`、Groupは `confirmDelete`）
    - `hideDeleteDialog()`: `state.currentDelete` をリセット
    - _依存: 2.1, 4.1_
    - _要件: 6.4, 6.6_

  - [ ] 6.3 modal-settings.js の updateAboutInfo 集計を Group-Set対応に変更する
    - `updateAboutInfo`: `about-target-count` の集計を `state.targets.length` から「全Group-Setのgroups要素数の合計」に変更
    - `renderSettingsUI`, `showSettingsModal`, `hideSettingsModal`, `showSyncModal`, `hideSyncModal` は変更なし
    - _依存: 2.1_
    - _要件: 15（targetCount ラベル変更）_

  - [ ]* 6.4 プロパティテスト: Group-Set内のGroup保存・削除は該当セットのgroups配列を正しく更新する
    - **Property 9: Group-Set内のGroup保存・削除は該当セットのgroups配列を正しく更新する**
    - Group-Set `setIndex` の `groups` 配列に対するGroup保存（新規追加または編集）が該当配列に変更を反映し、Group削除が該当配列からそのGroupを除去し、他のGroup-Setの `groups` 配列が変更されないことを検証
    - **Validates: Requirements 10.4, 10.5**
    - _依存: 6.1_
    - _テストファイル: tests/ui-modal-target.test.js_

- [ ] 7. Checkpoint — UI統合の検証
  - UI層（list-renderer.js, group-set.js, modal-target.js, dialog-delete.js, modal-settings.js）の実装が完了していることを確認する。全テストが通ることを確認し、質問があればユーザーに確認する。

- [ ] 8. オーケストレーション
  - [ ] 8.1 sidepanel.js に Group-Set操作のイベント接続を追加する
    - Group-Set行の編集ボタン → `showGroupSetEditMenu(setIndex)`
    - 編集メニュー各選択肢 → 対応する group-set.js 関数または showTargetModal 呼び出し
    - Group行クリック → `showTargetModal(groupIndex, setIndex)`
    - 開閉ボタン → `toggleGroupSetExpanded(setIndex)`
    - Group-Set実行ボタン → `executeAllMagnets(groupSet.groups)`
    - `handleAddFromDomain`: 現在編集中のGroup-Set（`state.currentEdit.setIndex`）の `groups` 末尾に追加
    - `handleSaveTarget`: 該当Group-Setの `groups` 配列に対して保存。新規Groupは `groups` 末尾に追加
    - ストレージ変更リスナー: `changes.targets` 監視を `changes.groupSets` に変更。`targets` の変更通知は Old Format 移行として処理
    - _依存: 4.2, 5.2, 6.1, 6.2_
    - _要件: 3.2, 4.1, 4.4, 4.5, 4.6, 7.5, 7.6, 8.3, 9.2, 10.2, 10.3, 10.4, 10.5_

  - [ ] 8.2 sidepanel.js のインポート/エクスポートを groupSets 対応に拡張する
    - エクスポート: `groupSets` と `settings`（`syncEnabled` は `false` 固定）を含む New Format JSONを出力
    - インポート: `groupSets` キー優先。`targets` キーのみの場合は移行して取り込み。両方の場合は `groupSets` 優先で `targets` 無視
    - 追記モード（append）: インポートされたGroup-Setを既存 `groupSets` 末尾に追加
    - 上書きモード（overwrite）: 既存 `groupSets` をインポートデータで置換
    - バリデーション失敗時はインポート中断し `showToast` でエラー表示
    - _依存: 8.1_
    - _要件: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 8.3 プロパティテスト: エクスポート・インポートのラウンドトリップ
    - **Property 13: エクスポート・インポートのラウンドトリップ**
    - 有効な `groupSets` 配列と `settings` オブジェクトを New Format でエクスポートしたJSONデータを上書きモードでインポートした結果の `groupSets` が、元の `groupSets` と等価であること（`syncEnabled` はエクスポート時に `false` 固定、インポート時にローカル値保持）を検証
    - **Validates: Requirements 13.1, 13.2**
    - _依存: 8.2_
    - _テストファイル: tests/sidepanel.test.js_

  - [ ]* 8.4 プロパティテスト: インポートモードは追記で結合・上書きで置換する
    - **Property 14: インポートモードは追記で結合・上書きで置換する**
    - 既存の `groupSets` 配列 `existing` と有効なインポート `groupSets` 配列 `imported` に対し、追記モードの場合は `existing` の末尾に `imported` が結合され、上書きモードの場合は `imported` で完全に置換されることを検証
    - **Validates: Requirements 13.4, 13.5**
    - _依存: 8.2_
    - _テストファイル: tests/sidepanel.test.js_

  - [ ] 8.5 sidepanel.js の削除分岐とフッター変更を実装する
    - `handleConfirmDelete`: `state.currentDelete.type` に応じてGroup削除/Group-Set削除を分岐。Group-Set削除は `groupSets.splice(setIndex, 1)`、Group削除は `groupSets[setIndex].groups.splice(groupIndex, 1)`。削除後 `saveGroupSets` → `hideDeleteDialog` → `renderTargetList`
    - フッター: `add-new-btn`/`add-from-domain-btn` を `add-group-set-btn`（1ボタン）に置き換え。`groupSets.length >= MAX_GROUP_SETS` の場合は `disabled`
    - _依存: 8.1_
    - _要件: 6.5, 6.6, 9.1, 9.2, 9.3_

  - [ ] 8.6 background.js の storage.onChanged リスナーを groupSets 対応に拡張する
    - `chrome.storage.onChanged` リスナー: `changes.groupSets` 監視を追加。`changes.targets` は Old Format 移行として処理し `groupSets` 形式に変換してローカルに反映
    - `onStartup`/`onInstalled`: `syncFromCloudIfNeeded` と `performAutoCleanup` は utils.js 側で groupSets 対応済みのため呼び出しは変更なし
    - utils.js 側の対応: `syncFromCloudIfNeeded` は `chrome.storage.sync.get(['settings', 'groupSets', 'targets'])` に拡張し `groupSets` 優先で反映。`performAutoCleanup` は `chrome.storage.local.get(['groupSets', 'protectedGroups'])` に変更し全Group-Setのgroupsをフラット化してクリーンアップ。`maintainTMOrder` は `chrome.storage.local.get(['groupSets'])` に変更し全Group-Setのgroupsをフラット化して順序基準とする。**引数 `groups` 指定時は該当Group-Setのgroup順序を優先して整列する**(design.md の設計通り、要件8.4に対応)
    - _依存: 2.2_
    - _要件: 8.4, 11.2, 12.1, 12.2, 12.4_

- [ ] 9. i18n
  - [ ] 9.1 _locales/ja/messages.json と _locales/en/messages.json に新規メッセージキーを追加する
    - `defaultGroupSetName`（(名称未設定) / (Untitled)）: デフォルトGroup-Set名(プレースホルダなし、固定文字列)
    - `gsAddNewSet`（新規グループセット / New Group-Set）: フッターボタン
    - `gsEditMenuTitle`（グループセットの編集 / Edit Group-Set）: 編集メニュータイトル
    - `gsEditMenuAddGroup`, `gsEditMenuAddFromDomain`, `gsEditMenuEditSet`, `gsEditMenuMoveUp`, `gsEditMenuMoveDown`: 編集メニュー5選択肢
    - `gsEditModalTitle`（グループセット編集 / Edit Group-Set）: 編集ダイアログタイトル
    - `gsPlaceholderName`（グループセット名 / Group-Set name）: 名前入力欄プレースホルダ
    - `gsGroupColor`（グループセットの色 / Group-Set Color）: カラーセレクションラベル
    - `confirmDeleteGroupSet`: Group-Set削除確認メッセージ
    - `gsEmptyNotice`（登録されたグループがありません / No groups registered）: 空Group-Set案内
    - `gsEditButton`, `gsExecuteButton`, `gsExpandButton`, `gsCollapseButton`: aria-label（プレースホルダ `$1` でセット名挿入）
    - `errorGroupSetLimit`（グループセットは20個までです / Up to 20 group-sets allowed）: 上限到達時フィードバック
    - `errorGroupNameRequired`（グループセット名を入力してください / Please enter group-set name）: 空名保存時フィードバック
    - 既存の `magnetAll` メッセージキーは維持（要件15.5）
    - _依存: 1.1_
    - _要件: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 10. ユニットテスト（Jest + JSDOM）
  - [ ]* 10.1 tests/utils.test.js を New Format バリデーション・移行テストに更新する
    - `validateGroupSets`, `validateGroupSet`, `validateSingleTarget` のテスト追加
    - `migrateTargetsToGroupSets`, `resolveGroupSets`, `createDefaultGroupSet` のテスト追加
    - 既存テストの New Format 対応更新
    - _依存: 1.3, 1.5, 1.7_
    - _要件: 18.1, 20.1, 20.3_

  - [ ]* 10.2 tests/ui-state.test.js を groupSets ロード・保存テストに更新する
    - `loadState`（移行判定: targets存在・空配列・groupSets既存・両方未定義）のテスト
    - `saveGroupSets`, `saveSettings` のテスト
    - 既存テストの New Format 対応更新
    - _依存: 2.2, 2.3, 2.4_
    - _要件: 18.2, 18.6_

  - [ ]* 10.3 tests/ui-list-renderer.test.js を Group-Set階層描画テストに更新する
    - `renderTargetList`（Group-Set階層描画、カラードット、ドラッグ不可、空セット案内）のテスト
    - 既存テストの New Format 対応更新
    - _依存: 4.2, 4.3, 4.4, 4.5_
    - _要件: 18.6_

  - [ ]* 10.4 tests/ui-modal-target.test.js を setIndex 対応テストに更新する
    - `showTargetModal`（setIndex対応）、Group保存/削除のテスト
    - 既存テストの New Format 対応更新
    - _依存: 6.1, 6.4_
    - _要件: 18.6_

  - [ ]* 10.5 tests/ui-dialog-delete.test.js を Group-Set削除テストに更新する
    - `showDeleteDialog`（Group/Group-Set区別）、`hideDeleteDialog` のテスト
    - 既存テストの New Format 対応更新
    - _依存: 6.2_
    - _要件: 18.4, 18.6_

  - [ ]* 10.6 tests/background.test.js を groupSets/targets 移行リスナーテストに更新する
    - `chrome.storage.onChanged` リスナー（groupSets/targets移行）のテスト
    - `performAutoCleanup`（groupSets対応）のテスト
    - 既存テストの New Format 対応更新
    - _依存: 8.6_
    - _要件: 18.6, 20.4_

  - [ ]* 10.7 tests/group-set.test.js を新規作成する
    - `toggleGroupSetExpanded`, `moveGroupSet`, `deleteGroupSet`, `addGroupSet`, `saveGroupSet`, `updateEditMenuButtonStates` のユニットテスト
    - 上限値到達時の挙動テスト
    - _依存: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
    - _要件: 18.2, 18.3, 18.4, 18.5_

  - [ ]* 10.8 tests/migration.test.js を新規作成する
    - Old Format `targets`（複数Group含む）→ New Format 移行の全Group保全テスト
    - Old Format エクスポートファイル（`targets` + `settings`）インポートのGroup-Set移行テスト
    - New Format エクスポートファイル（`groupSets` + `settings`）インポートのそのまま取り込みテスト
    - `chrome.storage.sync` からOld Format `targets` 通知時の移行処理テスト
    - 移行後の `targets` キー削除検証テスト
    - _依存: 1.5, 1.6, 8.2_
    - _要件: 20.1, 20.2, 20.3, 20.4, 20.5_

- [ ] 11. E2Eテスト（Playwright）
  - [ ]* 11.1 tests/e2e/group-set.test.js を新規作成する
    - グループセット開閉操作のE2Eテスト
    - 編集メニュー各選択肢（新規グループ追加、表示中タブから追加、グループセット編集、移動）のE2Eテスト
    - グループセット削除（確認ダイアログ経由）のE2Eテスト
    - フッター「+新規グループセット」ボタンによる新規セット追加のE2Eテスト
    - Group-Set実行（Magnet All）のE2Eテスト
    - 既存の `fixtures.js`（`launchPersistentContext`）を再利用
    - Group-Set数が上限(20)で各Group-Setが100Groupを含む最大構成の場合、メインリストの初期描画が500ミリ秒以内に完了することを可能な範囲で計測・検証(要件22.1)
    - Group-Setの開閉ボタン押下時、展開・縮小の表示切り替えが100ミリ秒以内に完了することを可能な範囲で計測・検証(要件22.2)
    - Group-Setの移動操作実行時、メインリストの再描画が200ミリ秒以内に完了することを可能な範囲で計測・検証(要件22.3)
    - _依存: 8.5, 9.1, 10.1-10.8_
    - _要件: 19.1, 19.2, 19.3, 19.4, 19.5, 22.1, 22.2, 22.3_

  - [ ]* 11.2 tests/e2e/normal.test.js を Group-Set対応に更新する
    - 既存シナリオの Group-Set 階層対応更新
    - _依存: 8.5, 9.1, 10.1-10.8_
    - _要件: 18.6_

- [ ] 12. バージョン更新
  - [ ] 12.1 manifest.json, package.json, package-lock.json, README.md のバージョンを 1.19.2 → 1.20.0 に更新する
    - `projects/app/manifest.json`: `"version": "1.19.2"` → `"1.20.0"`
    - `package.json`: `"version": "1.19.2"` → `"1.20.0"`
    - `package-lock.json`: ルートと packages の version を `"1.19.2"` → `"1.20.0"` に更新
    - `README.md`: バージョンバッジを 1.19.2 → 1.20.0 に更新
    - 4ファイルすべてでバージョンの整合性を保つ
    - _依存: 全実装・テスト完了後_
    - _要件: 21.4_

- [ ] 13. Checkpoint — 最終検証
  - 全ての実装とテストが完了していることを確認する。`npm test`（ユニットテスト）と Playwright（E2Eテスト）が全て成功することを確認する。プロジェクトルートに一時ファイルや不要なログが残っていないことを確認する。質問があればユーザーに確認する。

## Notes

- `*` マーク付きのタスクはオプション（スキップ可能）であり、MVPを優先する場合は後回しにできる
- 各タスクは対応する要件を参照し、トレーサビリティを確保する
- チェックポイントは段階的な検証を行い、早期にエラーを検出する
- プロパティテストは design.md の Correctness Properties（16個）を検証し、普遍的な正確性を保証する
- ユニットテストは具体的な例とエッジケースを検証する
- プロパティテストとユニットテストは補完関係にある
- 実装は Pure Vanilla JS（外部OSS非依存）で行い、Material 3 Design に準拠する
- すべてのデータは chrome.storage.local / chrome.storage.sync に保存し、外部サーバーへの送信は行わない
- コメント・コミットメッセージは日本語で記述し、JSDoc形式を採用する

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1", "1.1"] },
    { "id": 1, "tasks": ["1.2", "9.1"] },
    { "id": 2, "tasks": ["1.3", "4.1"] },
    { "id": 3, "tasks": ["1.5", "2.1"] },
    { "id": 4, "tasks": ["2.2", "5.1"] },
    { "id": 5, "tasks": ["4.2", "5.2", "6.2"] },
    { "id": 6, "tasks": ["6.1", "6.3", "8.6"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2"] },
    { "id": 9, "tasks": ["8.5"] },
    { "id": 10, "tasks": ["1.4", "1.6", "2.3", "4.3", "5.3", "6.4", "8.3", "10.5", "10.6"] },
    { "id": 11, "tasks": ["1.7", "2.4", "4.4", "5.4", "8.4", "10.4", "10.8"] },
    { "id": 12, "tasks": ["10.1", "10.2", "4.5", "5.5"] },
    { "id": 13, "tasks": ["10.3", "5.6"] },
    { "id": 14, "tasks": ["5.7"] },
    { "id": 15, "tasks": ["10.7"] },
    { "id": 16, "tasks": ["11.1", "11.2"] },
    { "id": 17, "tasks": ["12.1"] }
  ]
}
```
