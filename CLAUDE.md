# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイドラインです。

## プロジェクト概要

**YARURU** は、Supabase認証機能付きの家族向け予定・実施作業共有Webアプリケーションです。
メールアドレス＋パスワードでの会員登録・ログインを行い、1つの家族グループに参加したうえで、
家族全員が予定・実施作業（タイトル・日時・担当者・ステータス）を一覧・カレンダーで確認し、
登録・編集・削除・完了管理できることを目的としています。

## 技術スタック

- Next.js 16（App Router）+ TypeScript
- Tailwind CSS 4
- Supabase（`@supabase/supabase-js` / `@supabase/ssr`）による認証・データベース・RLS連携
- Vitest によるユニットテスト（日時計算・並び替えなど純粋関数のビジネスロジックを対象）
- 状態管理は `useState` / `useEffect` / React Context のみ（外部の状態管理ライブラリは導入しない）

## ディレクトリ構成

```
YARURU/
├── .env.example
├── .env.local            # Supabaseの接続情報（Git管理対象外）
├── next.config.ts
├── package.json
├── supabase/
│   └── migrations/
│       ├── 0001_init_schema.sql             # テーブル定義・制約・インデックス
│       ├── 0002_functions_and_rls.sql       # トリガー・RPC関数・RLSポリシー
│       └── 0003_recurrence_and_allday.sql   # end_at・終日・繰り返し用の列追加
├── src/
│   ├── proxy.ts           # Supabaseセッションの検証・更新（旧middleware）
│   ├── app/
│   │   ├── layout.tsx / page.tsx / globals.css
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── groups/new/page.tsx    # 家族グループ作成
│   │   ├── groups/join/page.tsx   # 招待コードで参加
│   │   ├── home/page.tsx          # カレンダー統合済みホーム（期限超過・今日の作業・今後の予定）
│   │   ├── items/page.tsx         # 一覧（検索・絞り込み・並び替え）
│   │   ├── items/new/page.tsx
│   │   ├── items/[id]/page.tsx    # 詳細・編集・削除
│   │   ├── history/page.tsx       # 完了履歴
│   │   └── settings/page.tsx      # グループ情報・メンバー
│   ├── components/
│   │   ├── AuthProvider.tsx   # 認証状態・所属グループのContext
│   │   ├── RequireAuth.tsx    # 未ログイン/未参加時のリダイレクト・共通ヘッダー(表示名・ログアウト)
│   │   ├── NavBar.tsx
│   │   ├── ToastProvider.tsx
│   │   ├── ItemForm.tsx / ItemCard.tsx / StatusBadge.tsx / PasswordInput.tsx
│   │   ├── FilterBar.tsx
│   │   └── CalendarView.tsx       # home/page.tsxに埋め込むカレンダーウィジェット
│   ├── lib/
│   │   ├── supabase/client.ts / server.ts
│   │   ├── items.ts       # 予定・実施作業のCRUD・検索絞り込み並び替え・繰り返し一括作成
│   │   ├── families.ts    # 家族グループの作成・参加・メンバー取得
│   │   ├── dateUtils.ts   # Asia/Tokyo変換・期限超過・14日非表示判定・繰り返し日付生成
│   │   └── notifications.ts # 通知要否の判定（送信処理は将来LINE連携用に未実装）
│   └── types/database.ts  # Supabaseテーブル・RPCの型定義
├── tests/
│   ├── dateUtils.test.ts
│   └── items.test.ts
└── CLAUDE.md
```

## 開発方針

- コンポーネントは役割ごとに分割し、Supabaseへのデータアクセスは `src/lib/` 配下の関数に集約する（UIコンポーネントから直接クエリを書かない）。
- Supabaseとの接続情報（URL・匿名キー）は `.env.local` で管理し、コードに直接埋め込まない。`service_role` キーはクライアントに公開しない。
- 予定・実施作業へのアクセスはSupabaseのRLS（行レベルセキュリティ）により「自分が所属する家族グループのメンバーのみ」に制限する。
- 完了日時の自動設定・解除と `updated_at` の更新は、DBトリガー（`items_before_update`）で一元管理し、クライアント実装に依存させない。
- 完了から14日経過した項目は削除せず、クエリ条件（`isHiddenAfterCompletion`）で通常一覧から除外し、完了履歴画面からのみ確認できるようにする。
- 繰り返し予定（毎日・毎週・隔週・月に一度）は、作成時に既定の期間（3か月）分の**独立した項目を一括生成**する方式とする。生成後の各項目は`recurrence_group_id`で緩く紐づくだけで、それぞれ個別に編集・完了・削除できる（シリーズ一括編集・無期限の繰り返しには対応しない）。
- 予定(event)は単一日のイベントとして扱い、日付＋開始時間＋終了時間で管理する（複数日にまたがる予定は扱わない）。実施作業(todo)は開始日時〜期限日時の期間を持てる。どちらも`is_all_day`で終日（時間未指定）を表現できる。
- 動作確認は `npm run dev` で開発サーバーを起動して行う。

## コーディング規約

- インデントはスペース2つを基本とする。
- 変数・関数名はキャメルケース（例: `fetchItems`）を使用する。
- コメントは「なぜそうしているか」が自明でない箇所にのみ日本語で最小限に記載する。
- 日時はDBでは `timestamptz`、画面表示は `Asia/Tokyo` 基準とし、変換処理は `src/lib/dateUtils.ts` に集約する。
- 不要な抽象化やライブラリ導入は避け、シンプルな実装を優先する。

## コンポーネント命名規約

- コンポーネント名はパスカルケース（例: `ItemForm`）とし、ファイル名もコンポーネント名と一致させる。
- ページ単位のコンポーネントは `src/app/` 配下にルーティング構造として配置し、それ以外の共通コンポーネントは `src/components/` にフラットに配置する。
- イベントハンドラ関数は「動詞 + 対象」の形で命名する（例: `handleSubmit`, `handleDelete`）。
- 状態変数はキャメルケースで、内容が分かる名前にする（例: `items`, `submitting`）。

## テスト

- `src/lib/dateUtils.ts`（JST変換・期限超過判定・14日非表示判定）、`src/lib/items.ts` の並び替えロジック、`src/lib/notifications.ts` の通知要否判定など、DBに依存しない純粋関数を中心にVitestで単体テストする（`tests/` 配下）。
- `npm run test` でテストを実行し、`npm run lint` / `npm run typecheck` / `npm run build` もあわせて確認する。

### コミット・プッシュ前の試験結果表示（省略しない）

**コードをGitHubにコミット・プッシュする前は、会話が途中でリセットされていても必ず次を実行し、結果を表形式でユーザーに提示すること：**

1. 以下を実行する：
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
   - 変更したファイルに対して `git diff` 上でAPIキー・パスワード・トークン等の直書きパターンを簡易grepする（機密情報チェック）
2. 結果を次の形式の表でユーザーに提示する：

   | 項目 | 結果 | 補足 |
   |---|---|---|
   | Lint | ✅ Pass / ❌ Fail | |
   | 型チェック | ✅ Pass / ❌ Fail | |
   | 単体テスト | ✅ Pass / ❌ Fail | 件数など |
   | ビルド | ✅ Pass / ❌ Fail | |
   | 機密情報チェック | ✅ Pass / ❌ Fail | 検出内容があれば記載 |

3. 1つでも❌Failがある場合は、コミット・プッシュせずに修正してから再実行する。すべて✅になったら、コミット・プッシュしてよいかユーザーに確認する。

## Git運用ルール

- **コードを変更するたびに、必ず GitHub にプッシュすること。**
- 変更内容ごとに適切な単位でコミットし、コミットメッセージには変更内容が分かるように簡潔に記載する。
- 作業の流れ：
  1. コードを変更する
  2. 上記「コミット・プッシュ前の試験結果表示」を実行し、結果を表でユーザーに提示する
  3. `git add` で変更をステージングする
  4. `git commit` で変更をコミットする
  5. `git push` で GitHub リポジトリに反映する
- ローカルに変更を残したままにせず、都度リモートリポジトリへ同期する。

## デプロイ情報

- 本番URL：https://yaruru-app.vercel.app/
- Supabaseプロジェクト名：YARURU
- Vercelの「Git push時の自動デプロイ」は使わない方針（Production BranchはVercel側の初期設定のまま`main`だが、`git push`が本番に反映されるわけではなく、下記のVercel CLIによる明示的デプロイのみで本番を更新する）。
- 本番への反映は、**Vercel CLI (`vercel --prod`) による手動デプロイのみ**で行う（Deploy Hookや専用ブランチは使わない。過去にIgnored Build Step・Deploy Hook・Production Branch分離を試したが、Deploy HookがIgnored Build Stepの影響を受けて機能しない等の問題があったため、この方式に統一した）。
- ローカル環境は `vercel link` 済み（`tack0327/yaruru-app` に紐付け）。
- 社内ネットワークではNode.js/curlのTLS証明書失効確認でエラーになるため、Vercel CLIを実行する際は環境変数 `NODE_OPTIONS="--use-system-ca"` を付与すること。
- **コードをGitHubにpushした後は、会話が途中でリセットされていても必ず次の手順を踏むこと（省略しない）：**
  1. `npm run dev` で開発サーバーを起動する（既に起動中ならそれを使う）。
  2. 起動ログに出る開発環境のURL（例: `http://localhost:3000`）をリンクとしてユーザーに提示し、動作確認を依頼する。
  3. ユーザーから問題ない旨の返答があったら、**「本番環境にデプロイしますか？」と確認する。**
  4. 「デプロイして」等の明確な依頼があった場合のみ、次のコマンドで本番デプロイを実行する：
     ```
     for i in 1 2 3; do NODE_OPTIONS="--use-system-ca" vercel --prod && break; echo "再試行 $i/3..."; sleep 3; done
     ```
     （`vercel --prod`は`"Not authorized"`という一時的なエラーで失敗することがあるが、CLIの認証状態自体には問題がなく、同じコマンドをそのまま再実行すれば成功する。そのため上記のように自動で数回リトライする。3回とも失敗した場合のみユーザーに報告する。）

## 回答言語

このプロジェクトに関するやり取りでは、**必ず日本語で回答すること**。

## GitHubリポジトリ

https://github.com/Tack0327/YARURU-app.git
