export type VersionHistoryEntry = {
  version: string;
  /** Asia/Tokyo基準の「YYYY-MM-DD」 */
  date: string;
  description: string;
};

/**
 * 設定画面に表示するバージョン履歴（新しい順）。
 * package.jsonのversionを上げたら、先頭に1件追加する（tests/versionHistory.test.tsで一致を確認している）。
 */
export const VERSION_HISTORY: VersionHistoryEntry[] = [
  { version: "1.0.0", date: "2026-10-04", description: "Official launch" },
  { version: "0.5.1", date: "2026-10-04", description: "セキュリティ修正（Next.jsの脆弱性に対応）" },
  {
    version: "0.5.0",
    date: "2026-10-04",
    description: "チケット一覧で選択したチケットをCSV（Jira取り込み用）でダウンロード・メール送信できるように",
  },
  { version: "0.4.1", date: "2026-10-04", description: "ホームの期限超過欄に完了済みの項目が表示される不具合を修正" },
  { version: "0.4.0", date: "2026-10-04", description: "チケット一覧の一括変更で開始日・期限日もまとめて変更できるように" },
  { version: "0.3.0", date: "2026-10-04", description: "パスワードを忘れた場合にメールのリンクから再設定できるように" },
  { version: "0.2.1", date: "2026-09-30", description: "カレンダーで月選択に戻るボタンが分かりにくい不具合を修正" },
  {
    version: "0.2.0",
    date: "2026-09-30",
    description: "ホームのカレンダーを月選択→日表示の2段階に変更／ログイン画面・ヘッダーにバージョンを表示",
  },
  { version: "0.1.0", date: "2026-09-15", description: "初版（家族向け予定・実施作業共有アプリ）" },
];
