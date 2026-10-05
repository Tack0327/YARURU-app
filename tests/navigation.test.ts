import { afterEach, describe, expect, it, vi } from "vitest";
import { goBackOr } from "@/lib/navigation";

function fakeRouter() {
  return { back: vi.fn(), replace: vi.fn() };
}

describe("goBackOr", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("開く前の画面（ブラウザの履歴）があれば、その画面に戻る", () => {
    vi.stubGlobal("window", { history: { length: 3 } });
    const router = fakeRouter();
    goBackOr(router, "/items");
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("ブックマークや別タブで直接開いた（履歴が無い）場合は、指定した画面へ移動する", () => {
    vi.stubGlobal("window", { history: { length: 1 } });
    const router = fakeRouter();
    goBackOr(router, "/items");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/items");
  });
});
