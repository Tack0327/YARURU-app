export type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "yaruru:theme";
const THEME_CLASS = "theme-light";

/** 保存されているテーマ設定を読み込む（未設定・サーバー側では既定の薄暗いテーマを返す） */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

/** <html>に反映する（実際の見た目を切り替える部分。ページ読み込み直後のちらつき防止にも使う） */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle(THEME_CLASS, theme === "light");
}

/** 選んだテーマを保存し、即座に反映する。ログアウトするまで（＝この値を変えるまで）この設定が使われる。 */
export function setStoredTheme(theme: Theme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * ページ読み込み直後にhtmlへ適用するための、ちらつき防止用スクリプトの文字列。
 * Reactのハイドレーション前に同期的に実行する必要があるため、layout.tsxから<script>として埋め込む。
 */
export const THEME_INIT_SCRIPT = `
try {
  if (localStorage.getItem("${THEME_STORAGE_KEY}") === "light") {
    document.documentElement.classList.add("${THEME_CLASS}");
  }
} catch (e) {}
`;
