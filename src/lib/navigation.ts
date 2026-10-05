type BackCapableRouter = { back: () => void; replace: (href: string) => void };

// このタブでアプリを開いてから表示した画面の数（NavigationTrackerが画面の切り替わりのたびに数える）。
// ページを再読み込みしたり、他のサイトや別タブからアプリを開いたりすると0から数え直される。
let visitedPageCount = 0;
let lastVisitedPath: string | null = null;

/**
 * 画面が切り替わったことを記録する（layout.tsxに置いたNavigationTrackerから呼ぶ）。
 * 開発時のStrictModeでは同じ画面の記録が2回呼ばれるため、直前と同じ画面は数えない。
 */
export function recordPageVisit(pathname: string): void {
  if (pathname === lastVisitedPath) return;
  lastVisitedPath = pathname;
  visitedPageCount += 1;
}

/**
 * 「戻る」でアプリ内の前の画面に戻れるかを判定する（純関数・テスト対象）。
 * ブラウザの履歴の件数（history.length）だけで判断すると、LINEなど他のサイトのリンクから同じタブで開いた場合に
 * そのサイトまで戻ってしまうため、このタブでアプリ内の画面を2つ以上表示したかで判断する。
 */
export function canGoBackInApp(pageCount: number): boolean {
  return pageCount > 1;
}

/**
 * 開く前の画面に戻る。チケットの登録・更新・削除の後に、ホームから開いたならホームへ、一覧から開いたなら一覧へ戻すために使う。
 * アプリ内に戻る先が無い場合（他のサイト・ブックマーク・別タブから直接開いた場合）は、fallbackHrefへ移動する。
 */
export function goBackOr(router: BackCapableRouter, fallbackHref: string): void {
  if (canGoBackInApp(visitedPageCount)) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
