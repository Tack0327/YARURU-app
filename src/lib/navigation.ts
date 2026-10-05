type BackCapableRouter = { back: () => void; replace: (href: string) => void };

/**
 * 開く前の画面に戻る。チケットの登録・更新・削除の後に、ホームから開いたならホームへ、一覧から開いたなら一覧へ戻すために使う。
 * ブックマークや別タブで直接開いた場合は戻る先の履歴が無く、そのままだとアプリの外へ出てしまうため、fallbackHrefへ移動する。
 */
export function goBackOr(router: BackCapableRouter, fallbackHref: string): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
