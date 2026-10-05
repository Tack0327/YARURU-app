import { beforeEach, describe, expect, it, vi } from "vitest";

// visitedPageCountはモジュール内の状態のため、テストごとに読み込み直して0から始める
async function loadNavigation() {
  vi.resetModules();
  return import("@/lib/navigation");
}

function fakeRouter() {
  return { back: vi.fn(), replace: vi.fn() };
}

describe("canGoBackInApp", () => {
  it("アプリ内で2つ以上の画面を表示していれば戻れる", async () => {
    const { canGoBackInApp } = await loadNavigation();
    expect(canGoBackInApp(2)).toBe(true);
    expect(canGoBackInApp(1)).toBe(false);
    expect(canGoBackInApp(0)).toBe(false);
  });
});

describe("goBackOr", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("アプリ内で画面を移動してきた場合は、開く前の画面に戻る", async () => {
    const { goBackOr, recordPageVisit } = await loadNavigation();
    recordPageVisit("/home");
    recordPageVisit("/items/abc");
    const router = fakeRouter();
    goBackOr(router, "/items");
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("他のサイト・ブックマーク・別タブから直接開いた場合は、アプリの外へ戻らず指定した画面へ移動する", async () => {
    const { goBackOr, recordPageVisit } = await loadNavigation();
    recordPageVisit("/items/abc"); // 最初に開いたのが詳細画面
    const router = fakeRouter();
    goBackOr(router, "/items");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/items");
  });

  it("同じ画面が続けて記録されても（開発時の二重実行）、1画面として数える", async () => {
    const { goBackOr, recordPageVisit } = await loadNavigation();
    recordPageVisit("/items/abc");
    recordPageVisit("/items/abc");
    const router = fakeRouter();
    goBackOr(router, "/items");
    expect(router.replace).toHaveBeenCalledWith("/items");
  });
});
