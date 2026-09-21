# TabMagnet-Solo - Smart Tab Manager & Domain Organizer

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-TabMagnet--Solo-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/tabmagnet-solo/lffgddghjafcjpfjdpknhfbonhnkdlmc)
[![version](https://img.shields.io/badge/version-1.17.9-blue)](projects/app/manifest.json)
[![Coverage](https://img.shields.io/badge/coverage-59%25-red)](https://masanori-satake.github.io/TabMagnet-Solo/coverage/)
[![Privacy: Local by Default + Optional Sync](https://img.shields.io/badge/Privacy-Local%20by%20Default%20%2B%20Optional%20Sync-brightgreen)](#-privacy--security)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)](projects/app/manifest.json)
[![Chromebook Optimized](https://img.shields.io/badge/Chromebook-Optimized-skyblue)](#chromebook--mobile-environment-friendly)
[![Offline Capable](https://img.shields.io/badge/Offline-Capable-success)](#chromebook--mobile-environment-friendly)
[![Touch & Tablet Ready](https://img.shields.io/badge/Touch%20%26%20Tablet-Ready-purple)](#chromebook--mobile-environment-friendly)
[![Pure Vanilla JS](https://img.shields.io/badge/Pure%20Vanilla%20JS-Zero%20Dependencies-informational)](#chromebook--mobile-environment-friendly)

~ A lightweight, privacy-focused Chrome extension that magnetically aggregates cluttered tabs across multiple windows into dedicated domain groups ~

## Overview

Are you struggling with dozens of open tabs scattered across multiple browser windows? **TabMagnet-Solo** is a privacy-first `chrome-extension` designed to instantly pull and organize your tabs by domain or URL pattern into a single window. Boost your `browser-productivity` with a clean, clutter-free tab bar in just one click.

## Key Features

- **Domain Grouper (`domain-grouper`)**: Automatically gather tabs matching designated domains or URL patterns across all browser windows into one place.
- **Smart Tab Organizer (`tab-organizer`)**: Singleton tab group management ensures each target domain maintains only one organized group, updating existing groups on execution.
- **Automatic Protection**: Keeps your manually organized tab groups safe—only groups prefixed with `🧲` are aggregated.
- **Add from Domain**: Quickly register a new aggregation target from your active tab's domain with one click.
- **Memory & Speed Saver**: Option to auto-collapse and discard collected tabs from memory to keep low-spec devices fast.
- **Duplicate Tab Cleaner**: Close duplicate URL tabs during aggregation to keep your tab bar lean.
- **Material 3 Design**: Built with Google Material Design 3 tokens for a clean, modern, and responsive user experience.
- **Easy Import / Export**: Backup or sync your tab manager (`tab-manager`) configuration via JSON files or clipboard.

## 🔒 Privacy & Security

- **Local by Default, Optional Device Sync**: Settings and target definitions (names, URL patterns, and group colors) are stored in `chrome.storage.local` by default. If you explicitly enable sync, those target definitions and extension settings are also stored in `chrome.storage.sync`, Chrome-managed sync storage associated with your browser profile, so they can be shared with other Chrome browsers signed in to the same profile. No external API calls or tracking servers are used.
- **Zero Developer Data Collection**: We do not collect, track, or transmit user data or browsing history to the developer or third-party servers. When optional sync is enabled, Chrome synchronizes only the configuration data described above through `chrome.storage.sync`.
- **Pure Vanilla JS (Zero Dependencies)**: Developed without third-party external npm/JS libraries, keeping the extension lightweight, secure, and easily verifiable.

## Chromebook & Mobile Environment Friendly

TabMagnet-Solo is optimized for performance and reliability across all devices, including low-spec Chromebooks and tablet screens:

- **Ultra-lightweight Execution**: Zero external dependencies ensure minimal RAM usage and instant response times.
- **100% Offline Capable**: Works reliably in restricted networks, enterprise environments, or offline modes.
- **Touch & Mobile Ready**: 48x48px touch targets and responsive UI layout prevent accidental clicks on touchscreens and Chromebooks.
- **Minimal Permissions**: Uses only necessary extension permissions (`tabs`, `tabGroups`, `storage`, `sidePanel`) for easy enterprise deployment (Chrome Enterprise).

## Installation

### Install from Chrome Web Store (Recommended)

Get the extension directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/tabmagnet-solo/lffgddghjafcjpfjdpknhfbonhnkdlmc).

### Install from Source Code

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the `projects/app` directory.

## Disclaimer

This software is an open-source project by an individual developer and is provided "as is" without warranty. The developer assumes no responsibility for any damages arising from its use.

---

## 🇯🇵 日本語

TabMagnet-Solo は、ドメイン・URLでタブを自動集約・整理するChrome拡張機能です。散らかったタブを磁石のように同じドメイン・サイトごとに一瞬で集約・整理し、開いたままの大量のタブをすっきりまとめて作業効率を大幅に向上させます。

### 概要

複数のブラウザウィンドウに散らばった特定サイトのタブ（Jira、Slack、GitHub、社内ツールなど）を、ワンクリックで現在のウィンドウに集約・グループ化するプライバシー重視のタブ管理支援ツールです。

### 主な機能

- **ドメイン自動集約**: 全ウィンドウを走査し、指定ドメイン・URLパターンのタブを現在のウィンドウに一括集約。
- **ワンクリック追加**: 現在開いているタブのドメインからワンクリックで新しいターゲットを作成可能。
- **重複タブの自動クローズ**: 集約時に同じURLの重複タブをクローズし、タブバーをすっきり整理。
- **メモリ節約機能**: 集約後にタブグループを自動折りたたみ＆メモリ解放（Discard）し、動作を軽量化。
- **既存グループの自動保護**: 接頭辞 `🧲` のない手動作成グループは自動的に保護され、崩されません。
- **設定データの入出力**: 設定をJSON形式でクリップボードやファイル経由で簡単にバックアップ・復元可能。

### 🔒 プライバシー & セキュリティ

- **標準はローカル保存、端末間同期は任意**: 設定と集約ターゲット情報（名前、URLパターン、グループ色）は、標準では `chrome.storage.local` に保存されます。同期を明示的に有効にした場合のみ、これらのターゲット情報と拡張機能の設定が、ブラウザプロフィールに関連付けられた Chrome 管理の同期ストレージ `chrome.storage.sync` にも保存され、同じプロフィールでログインしている他の Chrome ブラウザと共有されます。外部APIやトラッキングサーバーは使用しません。
- **外部依存ライブラリなし (Pure Vanilla JS)**: 外部ライブラリを一切不使用。高い透明性と安全性を確保しています。
- **開発者によるユーザーデータ収集ゼロ**: 開発者や第三者のサーバーへユーザーデータや閲覧履歴を収集・追跡・送信することはありません。任意の同期を有効にした場合、Chrome は上記の設定データのみを `chrome.storage.sync` 経由で同期します。

### インストール方法

- **Chrome ウェブストア（推奨）**: [Chrome ウェブストア](https://chromewebstore.google.com/detail/tabmagnet-solo/lffgddghjafcjpfjdpknhfbonhnkdlmc) からインストールしてください。
- **ソースコードから（デベロッパーモード）**: リポジトリをクローンまたはダウンロードし、`chrome://extensions` で「デベロッパーモード」をONにして `projects/app` フォルダを読み込んでください。

### 免責事項

本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。利用により生じたいかなる損害についても、開発者は一切の責任を負いません。自己責任でご利用ください。
