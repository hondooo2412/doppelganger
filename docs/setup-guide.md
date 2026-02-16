# Doppelganger - Supabase セットアップガイド

## 1. Supabaseプロジェクト作成

1. https://supabase.com にアクセス
2. 「Start your project」→ GitHubアカウントでログイン
3. 「New Project」をクリック
4. 設定:
   - **Organization**: 自分のOrg（初回は自動作成される）
   - **Project name**: `doppelganger`
   - **Database Password**: 強力なパスワードを設定（メモしておく）
   - **Region**: `Northeast Asia (Tokyo)` ← 日本ユーザー向け
5. 「Create new project」をクリック（作成に数分かかる）

## 2. APIキーの取得

1. プロジェクトダッシュボード → **Settings** → **API**
2. 以下の2つをコピー:
   - **Project URL**: `https://xxxxxxx.supabase.co`
   - **anon public key**: `eyJhbG...`（長い文字列）
3. `js/supabase-config.js` を開いて置き換え:
   ```javascript
   const SUPABASE_URL = 'https://xxxxxxx.supabase.co';  // ← ここ
   const SUPABASE_ANON_KEY = 'eyJhbG...';               // ← ここ
   ```

## 3. データベーススキーマの適用

1. ダッシュボード → **SQL Editor**
2. 「New Query」をクリック
3. `sql/schema.sql` の内容をコピー＆ペースト
4. 「Run」をクリック
5. 全テーブルが作成されたことを確認:
   - **Table Editor** で `users`, `boards`, `threads`, `posts`, `likes`, `reports` が表示される
   - `boards` テーブルに36レコード（ファミリー4 + タイプ32）が入っている

## 4. 認証の設定

### メール/パスワード認証（デフォルトで有効）
1. **Authentication** → **Providers** → **Email** が有効であることを確認
2. 設定変更（推奨）:
   - `Confirm email`: ON（確認メール必須）
   - `Secure email change`: ON

### Google認証（任意、後から追加可能）
1. [Google Cloud Console](https://console.cloud.google.com/) でOAuth 2.0クライアントを作成
2. Supabase → **Authentication** → **Providers** → **Google**
3. Client ID と Client Secret を入力

### 認証URL設定
1. **Authentication** → **URL Configuration**
2. **Site URL**: `http://localhost:3000`（開発時）→ 本番時にドメインに変更
3. **Redirect URLs**: 以下を追加
   - `http://localhost:3000/board.html`
   - `http://localhost:3000/index.html`

## 5. Realtime の有効化

1. **Database** → **Replication**
2. `posts` テーブルの **Realtime** を ON にする
3. これでスレッド内の新着投稿がリアルタイムに表示される

## 6. ローカルでの動作確認

### 方法A: VS Codeの拡張機能（簡単）
1. VS Code で「Live Server」拡張をインストール
2. `index.html` を右クリック → 「Open with Live Server」

### 方法B: Pythonの簡易サーバー
```bash
# Python 3
python -m http.server 3000

# ブラウザで http://localhost:3000 を開く
```

### 方法C: Node.jsの簡易サーバー
```bash
npx serve -p 3000
```

## 7. 動作確認チェックリスト

- [ ] `index.html` が表示される
- [ ] 新規登録 → 確認メール受信 → ログインできる
- [ ] ログイン後、診断ページに遷移する
- [ ] 診断完了後、掲示板に遷移する
- [ ] 自分のファミリーのラウンジが表示される
- [ ] 自分のタイプの部屋が表示される
- [ ] スレッドを作成できる
- [ ] 投稿に返信できる
- [ ] いいねできる
- [ ] 通報モーダルが表示される
- [ ] 禁止ワード（電話番号等）が弾かれる
- [ ] 他のファミリーの板が表示されない（RLS確認）

## 8. 本番デプロイ

### Vercelの場合
1. GitHubリポジトリにプッシュ
2. [Vercel](https://vercel.com) でインポート
3. Framework Preset: `Other`（静的サイト）
4. 環境変数は不要（クライアントサイドのみ）

### Cloudflare Pagesの場合
1. [Cloudflare Pages](https://pages.cloudflare.com/) で接続
2. ビルドコマンド: なし
3. 出力ディレクトリ: `/`（ルート）

### 本番時の変更
- `js/supabase-config.js` のURLとキーは本番用を使用
- Supabase → **Authentication** → **URL Configuration** のSite URLを本番ドメインに変更
