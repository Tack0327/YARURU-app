export type VersionHistoryEntry = {
  version: string;
  /** Asia/Tokyo基準の「YYYY-MM-DD」 */
  date: string;
  /** 変更点（画面では箇条書きで表示する。1項目につき1つの変更） */
  changes: string[];
};

/**
 * Version history画面（/versions。ヘッダーのバージョン表示から開く）に表示するバージョン履歴（新しい順）。
 * package.jsonのversionを上げたら、先頭に1件追加する（tests/versionHistory.test.tsで一致を確認している）。
 */
export const VERSION_HISTORY: VersionHistoryEntry[] = [
  {
    version: "1.3.3",
    date: "2026-10-05",
    changes: [
      "終日の実施作業が、期限日当日から「期限超過」と表示される不具合を修正",
      "予定・実施作業が多くなると、一部が表示されなくなる不具合を修正",
      "パスワードの変更を、再設定メールのリンクから開いた場合に限定（セキュリティ強化）",
    ],
  },
  {
    version: "1.3.2",
    date: "2026-10-05",
    changes: ["セキュリティの修正（ログインしていない状態でアカウント操作ができてしまう問題に対応）"],
  },
  { version: "1.3.1", date: "2026-10-05", changes: ["Version historyの変更点を箇条書きで表示"] },
  {
    version: "1.3.0",
    date: "2026-10-05",
    changes: [
      "パスワード再設定時に、他の端末のログインを解除するように",
      "一括変更の完了メッセージに、実際に変更した件数を表示",
      "スマホでは一括変更の欄を折りたたんで表示",
      "Version historyをヘッダーのバージョン表示から開く形に変更",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-05",
    changes: [
      "CSV出力でJira取り込み用／Excel閲覧用を選べるように（Excelで数式が実行されない対策）",
      "一括変更の途中で失敗したときに、一部だけ変更される不具合を修正",
      "CSVのメール送信に回数制限を追加",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-05",
    changes: ["Version historyを設定画面から独立させ、「バージョン」タブを追加"],
  },
  { version: "1.0.0", date: "2026-10-04", changes: ["Official launch"] },
  { version: "0.5.1", date: "2026-10-04", changes: ["セキュリティ修正（Next.jsの脆弱性に対応）"] },
  {
    version: "0.5.0",
    date: "2026-10-04",
    changes: ["チケット一覧で選択したチケットを、CSV（Jira取り込み用）でダウンロード・メール送信できるように"],
  },
  { version: "0.4.1", date: "2026-10-04", changes: ["ホームの期限超過欄に、完了済みの項目が表示される不具合を修正"] },
  { version: "0.4.0", date: "2026-10-04", changes: ["チケット一覧の一括変更で、開始日・期限日もまとめて変更できるように"] },
  { version: "0.3.0", date: "2026-10-04", changes: ["パスワードを忘れた場合に、メールのリンクから再設定できるように"] },
  { version: "0.2.1", date: "2026-09-30", changes: ["カレンダーで月選択に戻るボタンが分かりにくい不具合を修正"] },
  {
    version: "0.2.0",
    date: "2026-09-30",
    changes: ["ホームのカレンダーを月選択→日表示の2段階に変更", "ログイン画面・ヘッダーにバージョンを表示"],
  },
  { version: "0.1.0", date: "2026-09-15", changes: ["初版（家族向け予定・実施作業共有アプリ）"] },
];
