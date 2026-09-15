# YARURU

家族の予定・ToDoをみんなで共有するアプリです。1つの家族グループに参加したメンバーが、予定・ToDoの登録・担当者設定・期限管理・完了管理を行えます。

## セットアップ

```bash
npm install
```

### 1. Supabaseプロジェクトの準備

1. [Supabase](https://supabase.com/) でプロジェクトを作成します。
2. プロジェクトの `Settings > API` から `Project URL` と `anon public` キーを取得します。
3. `Authentication > Providers` でメール認証（Email）が有効になっていることを確認します。

### 2. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、Supabaseの接続情報を設定します。

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase anonキー
```

`.env.local` はGit管理対象外です。`service_role` キーはクライアントに公開しないため、このアプリでは使用しません。

### 3. Supabase migrationの適用

`supabase/migrations/` 配下のSQLを、Supabaseダッシュボードの `SQL Editor` で **番号順に** 実行してください。

1. `0001_init_schema.sql` … テーブル定義（profiles / family_groups / family_members / items）
2. `0002_functions_and_rls.sql` … トリガー・RPC関数・RLSポリシー

[Supabase CLI](https://supabase.com/docs/guides/cli) を利用している場合は、プロジェクトをリンクした上で以下でも適用できます。

```bash
supabase link --project-ref <あなたのproject-ref>
supabase db push
```

## 起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開くと、未ログイン時はログイン画面（`/login`）にリダイレクトされます。新規登録後、家族グループを作成するか、招待コードで既存のグループに参加してください。

## テスト・検証コマンド

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScriptの型チェック
npm run test       # Vitestによる単体テスト
npm run build      # 本番ビルド
```

## 主な機能

- メール認証によるログイン・新規登録（Supabase Auth）
- 家族グループの作成・招待コードによる参加
- 予定・ToDoの登録・編集・削除・ステータス変更（未対応 / 対応中 / 完了）
- キーワード検索、種別・担当者・ステータスによる絞り込み、期限日時などによる並び替え
- ホーム画面での期限超過・当日期限の強調表示
- カレンダー表示
- 完了から14日後に通常一覧から自動的に非表示（削除はされず、完了履歴から確認可能）
- 家族グループ単位のデータ分離（Supabase RLSによる強制）

## 今後の拡張予定（MVP範囲外）

- パスキー認証
- LINE Messaging APIによる期限通知（`src/lib/notifications.ts` に判定ロジックのみ実装済み）
- ブラウザPush通知
- 画像・ファイル添付
- 複数家族グループの切り替え
- 課金機能
