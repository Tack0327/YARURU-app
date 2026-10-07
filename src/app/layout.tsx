import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { NavigationTracker } from "@/components/NavigationTracker";
import { ThemeSync } from "@/components/ThemeSync";
import { ToastProvider } from "@/components/ToastProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YARURU",
  description: "グループの予定・実施作業をみんなで共有するアプリ",
};

// iPhoneのホームバー・ノッチの領域まで画面を広げ、env(safe-area-inset-*)で下部ナビ等の位置を調整できるようにする
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // 「薄暗い背景/白ベース」の選択をhtmlタグに直接反映するスクリプトを使っているため、
      // サーバー側でレンダリングした内容とクライアント側の実際のクラスが異なることをReactに警告させない
      suppressHydrationWarning
    >
      <head>
        {/* Reactのハイドレーション前に同期的にテーマを反映し、選択したテーマと違う色が一瞬表示されるのを防ぐ。
            <html>直下に<script>を置くと「<script> cannot be a child of <html>」というハイドレーションエラーになるため、
            <head>の中に置く。 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* 横向きのiPhoneで、ノッチの領域に文字が隠れないよう左右に余白を取る */}
      <body className="min-h-full flex flex-col bg-gray-900 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-gray-100">
        {/* ページ読み込みと並行してSupabaseへの接続（DNS・TLS）を先に確立し、初回アクセス時の体感速度を改善する */}
        {supabaseUrl && <link rel="preconnect" href={supabaseUrl} />}
        <ThemeSync />
        <NavigationTracker />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
