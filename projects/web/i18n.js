const translations = {
  en: {
    title: "TabMagnet-Solo - Local-only tab aggregation tool for Chrome",
    description: "Aggregates specific tabs like a magnet into the current window using URL patterns. Privacy-focused and works completely offline.",
    usage: "Usage",
    privacy: "Privacy Policy",
    tagline: "〜Aggregates specific tabs like a magnet into the current window〜",
    cta: "Add to Chrome Web Store",
    projectOverview: "Project Overview",
    overviewText:
      "TabMagnet-Solo is a tab management tool designed with privacy as the top priority. It identifies specific tabs (e.g., Jira, Slack) scattered across multiple windows based on URL patterns and aggregates them into the current window as a group.",
    features: "Features",
    featureAggregation: "Smart Aggregation",
    featureAggregationText:
      "Scans all windows and moves tabs matching specified URL patterns to the current window instantly.",
    featureLocal: "Complete Local Execution",
    featureLocalText:
      "All data is stored within the browser's chrome.storage.local. No data is ever sent to external servers, protecting your privacy.",
    featureM3: "Material 3 UI",
    featureM3Text:
      "Adopts Google Material 3 (M3) design. Operates comfortably in the side panel for a seamless workflow.",
    featureProtection: "Tab Group Protection",
    featureProtectionText:
      "Groups without the 🧲 prefix are automatically protected, preventing manual groups from being accidentally disbanded.",
    featureAddFromDomain: "Add from Domain",
    featureAddFromDomainText:
      "Create a new target instantly from the current tab's domain with a single click.",
    featurePortability: "Data Portability",
    featurePortabilityText:
      "Export and import your settings via clipboard or JSON files to use them across different environments.",
    install: "How to Install",
    installStep1: "Access the Chrome Web Store.",
    installStep2: 'Click the "Add to Chrome" button.',
    installStep3:
      "Click the extension icon to open the side panel and start organizing your tabs.",
    copyright: "© 2026 TabMagnet-Solo. All rights reserved.",
    privacyTitle: "Privacy Policy - TabMagnet-Solo",
    usageTitle: "Usage - TabMagnet-Solo",
    backToHome: "Back to Home",
    privacyPolicy: "Privacy Policy",
    usageGuide: "Usage Guide",
    langEn: "English",
    langJa: "日本語",
    privacyHeader1: "1. Data Collection and Use",
    privacyText1:
      "TabMagnet-Solo collects user-defined URL patterns and group names. All of this data is stored within the user's browser (chrome.storage.local) and is used only to provide the tab aggregation functions of this extension.",
    privacyHeader2: "2. Data Transmission",
    privacyText2:
      "Collected data is never sent to external servers. This extension is designed (Local-Only) not to transmit data over the internet.",
    privacyHeader3: "3. Third-Party Measurement",
    privacyText3:
      "This extension and introduction website do not use any access analysis tools such as Google Analytics or advertising tracking.",
    privacyHeader4: "4. Data Deletion",
    privacyText4:
      "Users can delete all locally stored data by uninstalling the extension or using the delete function within the settings.",
    usageHeader1: "1. Registering Targets",
    usageText1:
      "Open the side panel and click 'New Target' or 'From Tab Domain'. Enter a name and URL patterns (e.g., *google.com) to define what tabs should be aggregated.",
    usageHeader2: "2. Executing Aggregation",
    usageText2:
      "Click the 'Execute' (magnet icon) button next to a target. All matching tabs from any window will be moved to your current window and grouped.",
    usageHeader3: "3. Group Management",
    usageText3:
      "The extension automatically manages tab groups. When you re-execute, it updates the group and maintains a clean workspace.",
    top: "Top",
  },
  ja: {
    title: "TabMagnet-Solo - 特定のタブを現在のウィンドウに集約するローカル完結型ツール",
    description: "URLパターンに基づいて特定のタブを磁石のように現在のウィンドウへ集約。プライバシー重視で完全にオフラインで動作します。",
    usage: "使い方",
    privacy: "プライバシーポリシー",
    tagline: "〜特定のタブを磁石のように現在のウィンドウへ一括集約〜",
    cta: "Chrome ウェブストアで追加",
    projectOverview: "プロジェクト概要",
    overviewText:
      "TabMagnet-Soloは、プライバシーを最優先に設計されたタブ管理ツールです。複数のウィンドウに散らばった特定のタブ（例: Jira, Slack, 社内ツール等）をURLパターンで識別し、磁石のように現在のウィンドウへ一括集約してグループ化します。",
    features: "特徴",
    featureAggregation: "スマート集約",
    featureAggregationText:
      "全ウィンドウをスキャンし、指定したURLパターンに一致するタブを即座に現在のウィンドウへ移動します。",
    featureLocal: "完全ローカル実行",
    featureLocalText:
      "すべてのデータはブラウザ内の chrome.storage.local に保存されます。外部サーバーへの送信は一切行われず、プライバシーを強力に保護します。",
    featureM3: "Material 3 UI",
    featureM3Text:
      "Google Material 3 (M3) デザインを採用。サイドパネルで作業を邪魔せず、快適に操作できます。",
    featureProtection: "タブグループ保護",
    featureProtectionText:
      "🧲接頭辞のないグループは自動的に保護され、手動で作成したグループが誤って解体されるのを防ぎます。",
    featureAddFromDomain: "ドメインから追加",
    featureAddFromDomainText:
      "現在開いているタブのドメインから、ワンクリックですぐに集約ターゲットを作成できます。",
    featurePortability: "ポータビリティ",
    featurePortabilityText:
      "設定データをクリップボードやJSONファイル経由でエクスポート・インポートでき、環境移行も簡単です。",
    install: "インストール方法",
    installStep1: "Chrome ウェブストアにアクセスします。",
    installStep2: "「Chromeに追加」ボタンをクリックします。",
    installStep3:
      "拡張機能アイコンをクリックしてサイドパネルを開き、タブの整理を開始しましょう。",
    copyright: "© 2026 TabMagnet-Solo. All rights reserved.",
    privacyTitle: "プライバシーポリシー - TabMagnet-Solo",
    usageTitle: "使い方 - TabMagnet-Solo",
    backToHome: "ホームに戻る",
    privacyPolicy: "プライバシーポリシー",
    usageGuide: "使い方",
    langEn: "English",
    langJa: "日本語",
    privacyHeader1: "1. データの収集と利用",
    privacyText1:
      "TabMagnet-Solo は、ユーザーが設定したURLパターンおよびグループ名を収集します。これらのデータはすべて利用者のブラウザ内（chrome.storage.local）に保存され、本拡張機能の機能提供のためにのみ利用されます。",
    privacyHeader2: "2. データの送信",
    privacyText2:
      "収集されたデータが外部サーバーに送信されることは一切ありません。本拡張機能は、インターネット経由でのデータ送信を行わない設計（Local-Only）となっています。",
    privacyHeader3: "3. サードパーティによる計測",
    privacyText3:
      "本拡張機能および紹介用ウェブサイトでは、Google Analytics などのアクセス解析ツールや広告トラッキングなどは一切使用していません。",
    privacyHeader4: "4. データの削除",
    privacyText4:
      "利用者は、拡張機能をアンインストールするか、設定内の削除機能を使用することで、ローカルに保存されたすべてのデータを削除することができます。",
    usageHeader1: "1. ターゲットの登録",
    usageText1:
      "サイドパネルを開き、「新規作成」または「タブのドメインで作成」をクリックします。名前とURLパターン（例: *google.com）を入力して、集約したいタブの条件を設定します。",
    usageHeader2: "2. 集約の実行",
    usageText2:
      "ターゲットの横にある「実行（磁石アイコン）」ボタンをクリックします。別ウィンドウにあるものも含め、条件に一致するすべてのタブが現在のウィンドウに集約され、グループ化されます。",
    usageHeader3: "3. グループ管理",
    usageText3:
      "拡張機能は自動的にグループを管理します。再度実行すると、既存のグループを更新し、常に整理されたワークスペースを維持します。",
    top: "トップ",
  },
};

/**
 * ページ内のテキストとメタタグを現在の言語設定に合わせて更新する
 */
function applyTranslations() {
  const userLang = navigator.language.startsWith("ja") ? "ja" : "en";
  const lang = localStorage.getItem("preferred-lang") || userLang;
  const t = translations[lang];

  // 言語属性の更新
  document.documentElement.lang = lang;

  // 一般的な要素の更新
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = t[key];
      } else {
        el.textContent = t[key];
      }
    }
  });

  // タイトルとメタディスクリプションの更新
  const pageKey = document.body.dataset.page;
  const titleKey = pageKey ? `${pageKey}Title` : "title";
  const finalTitle = t[titleKey] || t.title;

  document.title = finalTitle;

  const metaTitle = document.querySelector('meta[name="title"]');
  if (metaTitle) metaTitle.setAttribute("content", finalTitle);

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && t.description) metaDesc.setAttribute("content", t.description);

  // 言語切り替えボタンの状態更新
  document.querySelectorAll(".lang-switch").forEach((btn) => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();

  document.querySelectorAll(".lang-switch").forEach((btn) => {
    btn.addEventListener("click", () => {
      localStorage.setItem("preferred-lang", btn.dataset.lang);
      applyTranslations();
    });
  });
});
