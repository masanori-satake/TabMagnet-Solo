# TabMagnet-Solo

[![version](https://img.shields.io/badge/version-0.1.0-blue)](projects/app/manifest.json)
[![Coverage](https://img.shields.io/badge/coverage-29%25-red)](#)
[![Privacy-Local Only](https://img.shields.io/badge/Privacy-Local%20Only-brightgreen)](AGENTS.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)](projects/app/manifest.json)

〜特定のタブを磁石のように現在のウィンドウへ一括集約するローカル完結型Chrome拡張機能〜

## プロジェクト概要

TabMagnet-Soloは、プライバシーを最優先に設計された、タブ管理支援ツールです。
複数のブラウザウィンドウに散らばった特定のタブ（例: Jira, Slack, 社内ツール等）を、磁石のように現在のウィンドウへ一括集約し、グループ化して管理します。

設計思想や行動指針については [AGENTS.md](AGENTS.md) を参照してください。

## 特徴

* **Smart Merge**: 全ウィンドウを走査し、指定URLパターンのタブを現在のウィンドウに集約。
* **世代管理**: グループ名にタイムスタンプ（YYYYMMDD_HHMMSS）を付与し、常に最新のグループのみを維持。古い同名グループは自動的に解体。
* **完全ローカル実行**: すべてのデータはブラウザ内の `chrome.storage.local` に保存されます。外部サーバーへの送信は一切行われず、プライバシーを強力に保護します。
* **Vanilla JS & ゼロ依存**: 外部ライブラリを一切使用せず、ブラウザ標準のAPIのみで構築されています。
* **Material 3 デザイン**: Google Material 3 (M3) に準拠したUI。
* **ポータビリティ**: 設定データをJSON形式でクリップボード経由でエクスポート/インポート可能。

## インストール方法

1. このリポジトリからソースコードをダウンロードまたはクローンします。
2. ブラウザで拡張機能管理ページを開きます（Chrome: `chrome://extensions`）。
3. 「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリックし、`projects/app` フォルダを選択します。

## 免責事項

本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。利用により生じたいかなる損害についても、開発者は一切の責任を負いません。自己責任でご利用ください。
