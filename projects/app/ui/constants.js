/**
 * 拡張機能全体で使用される定数
 */

/**
 * TabMagnetグループを示すプレフィックス（磁石絵文字）
 */
export const PREFIX_TM = '🧲';

/**
 * 収集中のグループに付与されるサフィックス
 * 前方に半角スペースを含む
 */
export const SUFFIX_COLLECTING = ' (Now Collecting)';

/**
 * Chromeでサポートされているタブグループのカラー
 */
export const COLORS_CHROME = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'
];

/**
 * Edgeでサポートされているタブグループのカラー（追加分を含む）
 * ※Edge固有の色: brown, white
 */
export const COLORS_EDGE = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
  'brown', 'white'
];

/**
 * Edge固有の色からChrome互換の色へのマッピング
 */
export const EDGE_TO_CHROME_COLOR_MAP = {
  'brown': 'orange',
  'white': 'grey'
};
