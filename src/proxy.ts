import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // セッションを検証・更新し、Cookieを最新に保つ（Server Componentでの認証状態参照に必要）
  await supabase.auth.getUser();

  return response;
}

// login・signupは未ログイン状態で使う画面で、そもそもセッションの検証・更新が不要なため対象から除外する
// （毎回Supabaseへの往復が発生し、ログイン画面の表示・ログイン処理そのものを遅くしていたため）
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|signup|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
