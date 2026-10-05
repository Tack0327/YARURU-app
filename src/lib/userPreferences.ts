// ブラウザ（localStorage）に保存している、ログイン中の利用者ごとの画面の設定。
// 家族で1台の端末を共有することがあるため、ログアウト時にclearUserPreferencesでまとめて消す
// （消さないと、次にログインした人に前の人の検索キーワードなどが見えてしまう）。
// 薄暗い背景/白ベースの選択（theme.ts）は、ログイン画面でも使う端末ごとの設定のためここには含めない。
export const HIDE_COMPLETED_STORAGE_KEY = "yaruru:homeHideCompleted";
export const ITEM_FILTERS_STORAGE_KEY = "yaruru:itemsFilters";

const USER_PREFERENCE_KEYS = [HIDE_COMPLETED_STORAGE_KEY, ITEM_FILTERS_STORAGE_KEY];

export function clearUserPreferences(): void {
  if (typeof window === "undefined") return;
  for (const key of USER_PREFERENCE_KEYS) window.localStorage.removeItem(key);
}
