# TabMagnet-Solo

[![version](https://img.shields.io/badge/version-1.4.0-blue)](projects/app/manifest.json)
[![Coverage](https://img.shields.io/badge/coverage-46%25-red)](https://masanori-satake.github.io/TabMagnet-Solo/coverage/lcov-report/)
[![Privacy-Local Only](https://img.shields.io/badge/Privacy-Local%20Only-brightgreen)](AGENTS.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)](projects/app/manifest.json)

〜特定のタブを磁石のように現在のウィンドウへ一括集約するローカル完結型Chrome拡張機能〜

## プロジェクト概要

TabMagnet-Soloは、プライバシーを最優先に設計された、タブ管理支援ツールです。
複数のブラウザウィンドウに散らばった特定のタブ（例: Jira, Slack, 社内ツール等）を、磁石のように現在のウィンドウへ一括集約し、グループ化して管理します。

設計思想や行動指針については [AGENTS.md](AGENTS.md) を参照してください。

## 特徴

* **Smart Aggregation**: 全ウィンドウを走査し、指定URLパターンのタブを現在のウィンドウに一括集約。
* **Singleton Management**: 同一ターゲットに対して常に一つのグループのみを維持。再実行時には既存グループを自動更新。
* **Automatic Protection**: ユーザーが手動で作成した既存のタブグループを破壊しないよう、接頭辞 `🧲` のないグループは自動的に保護されます。
* **Add from Domain**: 現在開いているタブのドメインから、ワンクリックで新しい集約ターゲットを作成可能。
* **完全ローカル実行**: すべてのデータはブラウザ内の `chrome.storage.local` に保存されます。外部サーバーへの送信は一切行われず、プライバシーを強力に保護します。
* **Vanilla JS & ゼロ依存**: 外部ライブラリを一切使用せず、ブラウザ標準のAPIのみで構築。軽量かつ高速に動作します。
* **Material 3 デザイン**: Google Material 3 (M3) に準拠した、直感的でモダンなUI。
* **ポータビリティ**: 設定データをJSON形式でクリップボードまたはファイル経由でエクスポート/インポート可能。
* **多言語対応**: 日本語と英語をサポート。

## インストール方法

### Chrome ウェブストアからインストール（推奨）

[Chrome ウェブストア](https://chromewebstore.google.com/detail/tabmagnet-solo/lffgddghjafcjpfjdpknhfbonhnkdlmc) からインストールしてください。

### ソースコードからインストール

1. このリポジトリからソースコードをダウンロードまたはクローンします。
2. ブラウザで拡張機能管理ページを開きます（Chrome: `chrome://extensions`）。
3. 「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリックし、`projects/app` フォルダを選択します。

## 免責事項

本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。利用により生じたいかなる損害についても、開発者は一切の責任を負いません。自己責任でご利用ください。
