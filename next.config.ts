import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.mdを独自に管理しているため、Next.jsによる自動生成・上書きを無効化する
  agentRules: false,
};

export default nextConfig;
