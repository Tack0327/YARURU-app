/**
 * Supabase RPC/PostgrestErrorはError型ではなくmessageプロパティを持つ単純なオブジェクトのため、
 * `instanceof Error`では判定できない。DB側のraise exceptionメッセージをそのままトーストに出すために使う。
 */
export function toErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}
