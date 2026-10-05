# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイドラインです。

## プロジェクト概要

**YARURU** は、Supabase認証機能付きの、グループ（家族・サークルなど）向け予定・実施作業共有Webアプリケーションです。
メールアドレス＋パスワードでの会員登録・ログインを行い、グループに参加したうえで、
メンバー全員が予定・実施作業（タイトル・日時・担当者・ステータス）を一覧・カレンダーで確認し、
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
├── .github/workflows/ci.yml  # プッシュ時のLint・型チェック・テスト・ビルド・脆弱性チェック
├── .env.example
├── .env.local            # Supabaseの接続情報（Git管理対象外）
├── next.config.ts
├── package.json
├── supabase/
│   └── migrations/
│       ├── 0001_init_schema.sql             # テーブル定義・制約・インデックス
│       ├── 0002_functions_and_rls.sql       # トリガー・RPC関数・RLSポリシー
│       ├── 0003_recurrence_and_allday.sql   # end_at・終日・繰り返し用の列追加
│       ├── ...（0004〜0024：グループ管理・メモ・アカウント削除など）
│       ├── 0025_bulk_update_and_csv_email_limit.sql # 一括変更のトランザクション化・CSVメール送信の回数制限
│       ├── 0026_block_anon_rpc.sql          # 未ログインからのRPC実行を禁止（アカウント削除・管理者委譲の権限チェック修正）
│       ├── 0027_invite_code_and_integrity_hardening.sql # 招待コード12桁化・参加の試行回数制限・管理者1人の保証など
│       ├── 0028_fix_account_delete_with_items.sql # 0027のトリガーでアカウント削除が失敗する不具合の修正
│       ├── 0029_release_csv_slot_and_transfer_conflict.sql # CSVメール送信失敗時の枠の取り消し・管理者の同時委譲時のメッセージ
│       └── 0030_rename_group.sql            # グループ名の変更（管理者・スーパー管理者）
├── src/
│   ├── proxy.ts           # Supabaseセッションの検証・更新（旧middleware）
│   ├── app/
│   │   ├── layout.tsx / page.tsx / globals.css
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── forgot-password/page.tsx  # パスワード再設定メールの送信
│   │   ├── reset-password/page.tsx   # メールのリンクから新しいパスワードを設定
│   │   ├── groups/new/page.tsx    # グループ作成
│   │   ├── groups/join/page.tsx   # 招待コードで参加
│   │   ├── home/page.tsx          # カレンダー統合済みホーム（期限超過・今日の作業・今後の予定）
│   │   ├── items/page.tsx         # 一覧（検索・絞り込み・並び替え）
│   │   ├── items/new/page.tsx
│   │   ├── items/[id]/page.tsx    # 詳細・編集・削除
│   │   ├── api/export-csv/email/route.ts # 選択チケットのCSVをログイン中の本人宛にメール送信
│   │   ├── history/page.tsx       # 完了履歴
│   │   ├── settings/page.tsx      # グループ情報（名前の変更）・メンバー
│   │   └── versions/page.tsx      # Version history（ヘッダーのバージョン表示から開く）
│   ├── components/
│   │   ├── AuthProvider.tsx   # 認証状態・所属グループのContext
│   │   ├── RequireAuth.tsx    # 未ログイン/未参加時のリダイレクト・共通ヘッダー(表示名・ログアウト)
│   │   ├── NavBar.tsx
│   │   ├── NavigationTracker.tsx # 画面の切り替わりを記録（navigation.tsの「戻る」判定に使う。layout.tsxに配置）
│   │   ├── ToastProvider.tsx
│   │   ├── ItemForm.tsx / ItemCard.tsx / StatusBadge.tsx / PasswordInput.tsx
│   │   ├── FilterBar.tsx
│   │   └── CalendarView.tsx       # home/page.tsxに埋め込むカレンダーウィジェット
│   ├── lib/
│   │   ├── supabase/client.ts / server.ts
│   │   ├── items.ts       # 予定・実施作業のCRUD・検索絞り込み並び替え・繰り返し一括作成
│   │   ├── families.ts    # グループの作成・参加・名前変更・メンバー取得
│   │   ├── dateUtils.ts   # Asia/Tokyo変換・期限超過・14日非表示判定・繰り返し日付生成
│   │   ├── notifications.ts # 通知要否の判定（送信処理は将来LINE連携用に未実装）
│   │   ├── csvExport.ts   # チケットのJira取り込み用CSV生成（BOM付きUTF-8）
│   │   ├── mailer.ts      # Gmail（SMTP_USER/SMTP_PASSWORD）経由のメール送信（サーバー専用）
│   │   ├── navigation.ts  # 登録・更新・削除後に「開く前の画面」へ戻る処理（アプリ内の移動回数で判断。直接開いた場合の移動先付き）
│   │   ├── userPreferences.ts # ブラウザに保存する利用者ごとの画面設定のキー一覧と、ログアウト時の一括消去
│   │   └── versionHistory.ts # Version history画面に表示するバージョン履歴（新しい順）
│   └── types/database.ts  # Supabaseテーブル・RPCの型定義
├── tests/
│   ├── dateUtils.test.ts
│   └── items.test.ts
└── CLAUDE.md
```

## 開発方針

- コンポーネントは役割ごとに分割し、Supabaseへのデータアクセスは `src/lib/` 配下の関数に集約する（UIコンポーネントから直接クエリを書かない）。
- Supabaseとの接続情報（URL・匿名キー）は `.env.local` で管理し、コードに直接埋め込まない。`service_role` キーはクライアントに公開しない。
- 画面上の呼び方は「グループ」に統一する（以前の「家族」「家族グループ」は使わない）。DBのテーブル名・関数名（`family_groups`、`create_family_group`など）は互換のためそのまま使う。
- 予定・実施作業へのアクセスはSupabaseのRLS（行レベルセキュリティ）により「自分が所属するグループのメンバーのみ」に制限する。
- **DB関数（RPC）を追加・変更するときは、必ず次を守る**（0026で修正した、未ログインでアカウント削除できた問題の再発防止）：
  - SECURITY DEFINER関数は、先頭で `if auth.uid() is null then raise exception ...` として未ログインを拒否する。
  - `auth.uid()` との比較は `<>` / `=` ではなく `is distinct from` / `is not distinct from` を使う（NULLのとき `<>` の結果はNULL＝偽扱いになり、権限チェックをすり抜けるため）。
  - 関数を作ったら `revoke execute on function ... from public, anon;` と `grant execute on function ... to authenticated;` を必ず書く（Supabaseは既定でanonにも実行権限を付けるため）。
  - **トリガーや制約を追加するときは、外部キーの連鎖処理（`on delete set null` / `on delete cascade`）との組み合わせを必ず確認する**。外部キーによるNULL化はUPDATEとして扱われ、BEFORE UPDATEトリガーが発火する（0027で作成者の変更を禁止するトリガーを追加した結果、`items.created_by`の`on delete set null`と衝突し、アカウント削除ができなくなった。0028で修正）。連鎖処理からの呼び出しは `pg_trigger_depth() > 1` で見分けられる。
  - `src/types/database.ts` は手書きの型定義のため、テーブル・DB関数を追加・変更したら同じ変更を型にも反映する（Supabase CLIを導入していないため型の自動生成は行っていない）。
- 完了日時の自動設定・解除と `updated_at` の更新は、DBトリガー（`items_before_update`）で一元管理し、クライアント実装に依存させない。
- 完了から14日経過した項目は削除せず、クエリ条件（`isHiddenAfterCompletion`）で通常一覧から除外し、完了履歴画面からのみ確認できるようにする。
- 繰り返し予定（毎日・毎週・隔週・月に一度）は、作成時に既定の期間（3か月）分の**独立した項目を一括生成**する方式とする。生成後の各項目は`recurrence_group_id`で緩く紐づくだけで、それぞれ個別に編集・完了・削除できる（シリーズ一括編集・無期限の繰り返しには対応しない）。
- 予定(event)は単一日のイベントとして扱い、日付＋開始時間＋終了時間で管理する（複数日にまたがる予定は扱わない）。実施作業(todo)は開始日時〜期限日時の期間を持てる。どちらも`is_all_day`で終日（時間未指定）を表現できる。
- 画面の設定（絞り込みなど）をブラウザ（localStorage）に保存するときは、キーを `src/lib/userPreferences.ts` に追加する（ログアウト時にまとめて消すため。グループのメンバーで端末を共有すると、消し忘れた設定が次の人に見えてしまう）。
- 動作確認は `npm run dev` で開発サーバーを起動して行う。社内ネットワークでは、サーバー側（Route Handler・proxy）からSupabaseやGmailへの通信が証明書エラー（`SELF_SIGNED_CERT_IN_CHAIN`）になるため、必ず `NODE_OPTIONS="--use-system-ca" npm run dev` で起動する（付けないとサーバー側の認証確認が失敗し、APIが「ログインしてください」を返す）。

## 受容済みのリスク（改善点を探すときは注意喚起として毎回伝える）

ユーザーが「現状のままでよい」と判断したリスク。改善点の洗い出しや改善提案をするときは、修正案としては出さず、**冒頭に「注意喚起」として毎回あらためて伝える**（その時点の作業内容に関係する具体的な注意点も添える）。

- **開発環境と本番環境が同じSupabaseプロジェクト（DB）を使っている**（2026-10-05時点で受容）：開発サーバーでのチケット登録・削除、CSVメール送信、マイグレーションのSQL実行などは、そのまま本番のグループのデータに反映される。開発中にテスト用のデータを作るときや、DBを変更するSQLを案内するときは、本番データへの影響を必ず意識し、ユーザーにも伝える。

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
   - `NODE_OPTIONS="--use-system-ca" npm audit --omit=dev` と `NODE_OPTIONS="--use-system-ca" npm audit` で依存パッケージの脆弱性を確認する（脆弱性チェック。社内ネットワークでは`--use-system-ca`が無いと証明書エラーで実行できない）
2. 結果を次の形式の表でユーザーに提示する：

   | 項目 | 結果 | 補足 |
   |---|---|---|
   | Lint | ✅ Pass / ❌ Fail | |
   | 型チェック | ✅ Pass / ❌ Fail | |
   | 単体テスト | ✅ Pass / ❌ Fail | 件数など |
   | ビルド | ✅ Pass / ❌ Fail | |
   | 機密情報チェック | ✅ Pass / ❌ Fail | 検出内容があれば記載 |
   | 脆弱性チェック | ✅ Pass / ❌ Fail | 重大度ごとの件数と、本番依存か開発用のみかを記載 |

3. 1つでも❌Failがある場合は、コミット・プッシュせずに修正してから再実行する。すべて✅になったら、コミット・プッシュしてよいかユーザーに確認する。

#### 脆弱性チェックの判定基準

- **❌ Fail**：本番に含まれる依存（`--omit=dev`の結果）に重大度 high 以上がある、または全体のどこかに critical がある場合。修正版があれば更新案（対象パッケージ・更新前後のバージョン・アプリへの影響）をユーザーに提示し、承認を得てから更新する。
- **✅ Pass（要報告）**：開発用ツールのみに high 以下が残っている場合や、本番依存に moderate / low がある場合。本番環境への影響が無い・小さい理由を補足に書き、件数と内容をユーザーに報告する。
- `npm audit fix --force` は、メジャーバージョンの格下げ（例：Next.js 16に対して`eslint-config-next`を14系へ戻す）など互換性を壊す変更を行うことがあるため使わない。依存の更新は、パッチ・マイナー版への個別の`npm install --save-exact <パッケージ>@<バージョン>`で行う（既存の依存がバージョン固定のため、固定指定を保つ）。
- 依存パッケージを追加・更新したときは、コミット前でなくてもその場で脆弱性チェックを実行し、結果をユーザーに報告する。
- 開発サーバー起動中に`next`等を更新すると、ファイルがロックされて更新が不完全になる（EPERM）ため、更新前に開発サーバーを停止する。

#### 脆弱性の詳細報告（省略しない）

脆弱性チェックで1件でも検出された場合（✅ Pass（要報告）・❌ Failのどちらでも）は、試験結果の表のあとに、次の項目を含む詳細報告を必ず付ける。詳細は `npm audit --json`（`via`の中のadvisory情報）・`npm ls <パッケージ> --all`・`npm view <パッケージ> version` で調べる。

1. **結論**：何件が実際にはいくつの脆弱性に由来するか（`npm audit`は経路上の各パッケージも1件として数えるため、件数と実体が異なることがある）と、アプリ・本番環境への影響の有無を最初に書く。
2. **脆弱性の内容**（表）：識別番号（GHSA/CVE）とURL・名称・種類（CWE）・深刻度（CVSSスコア）・対象バージョン範囲・悪用の条件。
3. **依存の経路**：直接の依存から脆弱なパッケージまでのツリー（各バージョン付き）と、本番依存か開発用（devDependencies）か。
4. **このアプリで悪用できる／できない理由**：本番で実行されるか、攻撃者が入力を渡せる経路があるか、悪用された場合の影響範囲。
5. **修正版の状況**（表）：経路上の各パッケージの使用中バージョンと最新版、修正版が公開済みか。`npm audit`の提案する修正が互換性を壊す場合はその旨。
6. **今後の対応**：更新案、または修正版公開まで監視する方針。

前回までの報告と同じ脆弱性が残っている場合も、省略せずに最新の状況（最新版の公開状況など）を調べ直して報告する。

#### 既知の脆弱性（2026-10-05時点）

- `braces` 3.0.3（[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)、CVSS 7.5、深いネストのパターンによるスタック枯渇DoS）：`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` の経路で入る開発用のみの依存。`npm audit`ではhigh 5件と表示される。最新版（braces 3.0.3 / micromatch 4.0.8）でも未修正。修正版が出たら`eslint-config-next`の更新、それで解消しなければ`overrides`での`braces`差し替えを提案する。

## バージョン管理ルール

- バージョン番号は `package.json` の `version`（`x.y.z`）で管理する。
- 各桁の意味（3桁とも0から始まる想定。標準的なSemVerとは意味が異なるので注意）：
  - 1桁目（左）：UX（操作性・画面構成・画面遷移など）が変わったとき
  - 2桁目（中央）：機能が追加されたとき
  - 3桁目（右）：不具合を修正したとき
- 1回のコミットで複数の種類の変更を含む場合は、最も上位（左側）の桁のみ1つ上げ、それより下位の桁は0にリセットする（例：UX変更を伴う機能追加なら1桁目を+1し、2桁目・3桁目は0にする）。
- **コミット前に、今回の変更内容がどれに該当するかをこのルールに照らして判断し、バージョン候補（例：「機能追加のため0.1.0→0.2.0にします」）を提示してユーザーに確認する。** ユーザーが承認した場合のみ、`package.json`の`version`を更新し、コミットに含める。承認が得られない場合や、ユーザーが別の値を指定した場合はそれに従う。
- バージョンを変更しない（見た目にも影響しない些細な修正など）と判断した場合も、その理由を一言添えてユーザーに確認する。
- **バージョンを上げるときは、Version history画面（`/versions`。ヘッダーのバージョン表示から開く）に出す `src/lib/versionHistory.ts` の `VERSION_HISTORY` の先頭にも1件追加する**（バージョン・日付（Asia/Tokyoの`YYYY-MM-DD`）・変更点`changes`）。変更点は**箇条書き（1項目につき1つの変更）**で書き、画面でも箇条書きで表示する。変更点の文言は、バージョン候補と一緒に案を提示してユーザーに確認する。`package.json`の`version`と先頭の履歴が一致しないと`tests/versionHistory.test.ts`が失敗する。
- 履歴は0.x系も含めてすべて公開する（削除・省略しない）。内容はアプリの利用者向けに、何ができるようになったか・何を直したかを簡潔に書く。

## Git運用ルール

- **コードを変更するたびに、必ず GitHub にプッシュすること。**
- 変更内容ごとに適切な単位でコミットし、コミットメッセージには変更内容が分かるように簡潔に記載する。
- 作業の流れ：
  1. コードを変更する
  2. 上記「バージョン管理ルール」に基づき、バージョン候補を提示してユーザーに確認し、承認されたら`package.json`の`version`を更新する
  3. 上記「コミット・プッシュ前の試験結果表示」を実行し、結果を表でユーザーに提示する
  4. `git add` で変更をステージングする
  5. `git commit` で変更をコミットする
  6. `git push` で GitHub リポジトリに反映する
- ローカルに変更を残したままにせず、都度リモートリポジトリへ同期する。

## デプロイ情報

- 本番URL：https://yaruru-app.vercel.app/
- Supabaseプロジェクト名：YARURU
- Vercelの「Git push時の自動デプロイ」は使わない方針（Production BranchはVercel側の初期設定のまま`main`だが、`git push`が本番に反映されるわけではなく、下記のVercel CLIによる明示的デプロイのみで本番を更新する）。
- 本番への反映は、**Vercel CLI (`vercel --prod`) による手動デプロイのみ**で行う（Deploy Hookや専用ブランチは使わない。過去にIgnored Build Step・Deploy Hook・Production Branch分離を試したが、Deploy HookがIgnored Build Stepの影響を受けて機能しない等の問題があったため、この方式に統一した）。
- ローカル環境は `vercel link` 済み（`tack0327/yaruru-app` に紐付け）。
- Supabase CLIは使っていないため、`supabase/migrations/` に追加したSQLは**ユーザーがSupabase管理画面の「SQL Editor」で手動実行する**（開発環境と本番環境で同じSupabaseプロジェクトを使っている）。新しいDB関数・テーブルに依存するコードは、SQLの実行前に動かすとエラーになるため、マイグレーションを追加したときは実行手順を案内し、**実行済みであることをユーザーに確認してから本番デプロイする**。
- 社内ネットワークではNode.js/curlのTLS証明書失効確認でエラーになるため、Vercel CLIを実行する際は環境変数 `NODE_OPTIONS="--use-system-ca"` を付与すること。
- **コードをGitHubにpushした後は、会話が途中でリセットされていても必ず次の手順を踏むこと（省略しない）：**
  1. `NODE_OPTIONS="--use-system-ca" npm run dev` で開発サーバーを起動する（既に起動中ならそれを使う。`package.json`の`version`を変えた場合は再起動しないと画面のバージョン表示に反映されない）。
  2. 起動ログに出る開発環境のURL（例: `http://localhost:3000`）をリンクとしてユーザーに提示し、動作確認を依頼する。
  3. ユーザーから問題ない旨の返答があったら、**「本番環境にデプロイしますか？」と確認する。**
  4. 「デプロイして」等の明確な依頼があった場合のみ、次のコマンドで本番デプロイを実行する：
     ```
     for i in 1 2 3; do NODE_OPTIONS="--use-system-ca" vercel --prod && break; echo "再試行 $i/3..."; sleep 3; done
     ```
     （`vercel --prod`は`"Not authorized"`という一時的なエラーで失敗することがあるが、CLIの認証状態自体には問題がなく、同じコマンドをそのまま再実行すれば成功する。そのため上記のように自動で数回リトライする。3回とも失敗した場合のみユーザーに報告する。）
  5. **本番デプロイに成功したら、デプロイしたコミットに `v<package.jsonのversion>` の注釈付きタグを付けてGitHubにプッシュする**（どの版が本番に出たかを後から特定できるようにするため）。
     ```
     git tag -a v1.2.3 -m "YARURU v1.2.3 production deploy (YYYY-MM-DD)" && git push origin v1.2.3
     ```
     同じバージョンのタグが既にある場合（同じ版を再デプロイした場合など）は付け直さず、その旨を報告する。

## CI（GitHub Actions）

- `.github/workflows/ci.yml` で、`main`へのプッシュとプルリクエストのたびに Lint・型チェック・単体テスト・ビルド・本番依存の脆弱性チェック（`npm audit --omit=dev --audit-level=high`）を自動実行する。
- ローカルでの「コミット・プッシュ前の試験結果表示」の代わりにはしない（両方行う）。プッシュ後のCIの結果は、GitHubリポジトリの「Actions」タブで確認する（このPCには`gh`コマンドが入っていないため、失敗した場合はユーザーに画面の内容を共有してもらって原因を調べる）。
- CIのビルドではSupabaseにつながないダミーの環境変数を使う。本物のキーやパスワードをワークフローファイルに書かない。

## 回答言語

このプロジェクトに関するやり取りでは、**必ず日本語で回答すること**。

## GitHubリポジトリ

https://github.com/Tack0327/YARURU-app.git
