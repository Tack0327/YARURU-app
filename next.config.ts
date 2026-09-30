import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  // CLAUDE.mdを独自に管理しているため、Next.jsによる自動生成・上書きを無効化する
  agentRules: false,
  env: {
    // package.jsonのversionを画面表示用に公開する（ログイン画面・ログイン後ヘッダー）
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  experimental: {
    // 登録・編集直後にホーム等へ戻った際、クライアントルーターキャッシュにより
    // 更新前のデータが表示され続けることがないよう、キャッシュを無効化する
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
