# Doppelganger テスト環境ガイド

## テスト可否の一覧

| ページ | Supabaseなしで動作 | 説明 |
|--------|:------------------:|------|
| `doppelganger-diagnosis.index.html` | ✅ 完全動作 | 診断136問、結果表示、セーブ/再開 |
| `types.html` | ✅ 完全動作 | 32タイプ一覧、フィルター、展開表示 |
| SNSシェアボタン | ✅ 動作 | X/Facebook/Instagram/コピー |
| 途中セーブ（localStorage） | ✅ 動作 | 同一ブラウザ内で再開可能 |
| `index.html`（ログイン画面） | ⚠️ UI表示のみ | ログイン操作はSupabase必要 |
| `board.html`（掲示板） | ❌ | Supabase認証 + DB必須 |
| `thread.html`（スレッド詳細） | ❌ | Supabase認証 + DB必須 |
| `profile.html`（マイページ） | ❌ | Supabase認証 + DB必須 |

---

## 方法1: GitHub Pages（今までと同じ方法 — 推奨）

### 手順

1. **GitHubリポジトリにファイルをアップロード**

   リポジトリのルートに以下の構成でアップロード:
   ```
   /（リポジトリルート）
   ├── doppelganger-diagnosis.index.html
   ├── types.html
   ├── index.html
   ├── board.html
   ├── thread.html
   ├── profile.html
   ├── css/
   │   └── common.css
   ├── js/
   │   ├── supabase-config.js
   │   ├── auth.js
   │   ├── board.js
   │   └── moderation.js
   ├── sql/
   │   └── schema.sql
   └── docs/
       ├── setup-guide.md
       ├── legal-checklist.md
       └── test-guide.md
   ```

2. **GitHub Pagesを有効化**
   - リポジトリ → Settings → Pages
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)`
   - Save

3. **テスト用URL**
   ```
   https://あなたのユーザー名.github.io/リポジトリ名/doppelganger-diagnosis.index.html
   ```

### テストできること
- 性格診断を最初から最後まで通しでプレイ
- 途中でブラウザを閉じて → 再度開いて「途中から再開」
- 結果ページのSNSシェアボタン（X投稿画面が開く等）
- 結果ページ → 32タイプ一覧ページへの遷移
- 一覧ページのフィルタータブ、タップ展開
- シェア文言のURLが自動でGitHub PagesのURLになることを確認

### 注意点
- GitHub Pagesは**公開**されます（URLを知っている人は誰でもアクセス可能）
- クローズドにしたい場合はリポジトリを **Private** にすること
  → Privateリポジトリの GitHub Pages は **GitHub Pro以上** が必要（月$4）
  → 無料で非公開テストしたい場合は「方法2」を使用

---

## 方法2: ローカルサーバー（完全非公開）

### Python未インストールの場合

#### 選択肢A: VS Code Live Server（最も簡単）
1. VS Code をインストール（まだの場合）
2. 拡張機能「Live Server」をインストール
   - VS Code左のExtensionsアイコン → 「Live Server」で検索 → Install
3. プロジェクトフォルダをVS Codeで開く
4. `doppelganger-diagnosis.index.html` を右クリック → 「Open with Live Server」
5. ブラウザが自動で開く（`http://127.0.0.1:5500/doppelganger-diagnosis.index.html`）

#### 選択肢B: ファイルを直接開く（最も手軽、制限あり）
1. `doppelganger-diagnosis.index.html` をダブルクリックでブラウザで開く
2. 診断は動作する
3. ⚠️ シェアボタンのURL自動検出は `file://` プロトコルになるため本番と異なる
4. ⚠️ ページ間遷移（types.htmlへ等）は `file://` でも動作するが、一部ブラウザでJS制限がある場合あり

---

## テストシナリオ（チェックリスト）

### 診断フロー
- [ ] トップ画面が表示される
- [ ] 「診断を始める」で質問画面に遷移する
- [ ] 質問に回答すると次の質問に進む
- [ ] 「戻る」ボタンで前の質問に戻れる
- [ ] 途中の格言カード（ブレイクポイント）が表示される
- [ ] 136問すべて回答すると分析アニメーション → 結果表示

### 途中セーブ/再開
- [ ] 途中（例: 50問目くらい）でブラウザのタブを閉じる
- [ ] 再度ページを開くと「途中から再開しますか？」バナーが表示される
- [ ] 「途中から再開」で前回の続きから始まる
- [ ] 「最初からやり直す」で1問目から始まる
- [ ] 診断完了後に再度開いても再開バナーは表示されない

### 結果ページ
- [ ] タイプ名、ファミリー、キャッチフレーズが表示される
- [ ] 魂の設計図、日常のあるある等のセクションが表示される
- [ ] レーダーチャートが描画される
- [ ] 15次元スペクトラムが表示される

### SNSシェア
- [ ] 「X」ボタン → Xの投稿画面が開く
- [ ] 投稿テキストに「私は○○タイプでした！」+ 説明 + URL が入っている
- [ ] 「Facebook」ボタン → Facebookのシェア画面が開く
- [ ] 「Instagram」ボタン → テキストがコピーされ、案内メッセージが表示される
- [ ] 「コピー」ボタン → クリップボードにコピーされ、ボタンが「✅ コピーしました！」に変わる

### 32タイプ一覧
- [ ] 結果ページの「全32タイプ一覧を見る」リンクで `types.html` に遷移する
- [ ] 自分のタイプがハイライト表示される（スクロール + 枠が光る）
- [ ] ファミリーフィルター（全体/Architects/Mystics/Commanders/Catalysts）が動作する
- [ ] タイプカードをタップすると座右の銘が展開表示される
- [ ] 「← 診断に戻る」リンクで診断ページに戻れる
