# GitHub Pages テスト公開ガイド（初心者向け）

## 前提
- GitHubアカウントを持っている（持っていなければ https://github.com で無料登録）
- Git のインストールは不要（ブラウザだけで完結します）

---

## ステップ 1: リポジトリを作成する

1. https://github.com にログイン
2. 右上の「＋」ボタン → 「New repository」をクリック
3. 以下を入力:
   - **Repository name**: `doppelganger`（好きな名前でOK）
   - **Description**: 空欄でOK
   - **Public / Private**:
     - `Public` → 誰でもURLでアクセスできる（無料）
     - `Private` → 自分だけ（GitHub Pages は Pro $4/月 が必要）
   - **Add a README file**: チェックを入れる ✅
4. 「Create repository」をクリック

---

## ステップ 2: フォルダ付きでファイルをアップロードする

### ⚠️ 重要: GitHubのWeb UIは「フォルダごとアップロード」に対応しています

1. 作成したリポジトリのページで「Add file」→「Upload files」をクリック

2. **エクスプローラー（ファイルマネージャー）を開いて、以下のファイルとフォルダをまとめて選択し、ブラウザの画面にドラッグ＆ドロップ**:

   ```
   アップロードするもの（全部まとめてドラッグ）:

   📄 doppelganger-diagnosis.index.html
   📄 index.html
   📄 board.html
   📄 thread.html
   📄 profile.html
   📄 types.html
   📁 css/        ← フォルダごとドラッグ
   📁 js/         ← フォルダごとドラッグ
   📁 sql/        ← フォルダごとドラッグ（任意）
   📁 docs/       ← フォルダごとドラッグ（任意）
   ```

   ### ドラッグ＆ドロップの手順（画像で説明）:

   ```
   ┌─ エクスプローラー ──────────────┐     ┌─ ブラウザ（GitHub）──────┐
   │                                │     │                         │
   │  📄 doppelganger-diag...html   │     │  Drag files here to     │
   │  📄 index.html                 │ ──→ │  add them to your       │
   │  📄 board.html                 │     │  repository             │
   │  📄 thread.html                │     │                         │
   │  📄 profile.html               │     │  Or choose your files   │
   │  📄 types.html                 │     │                         │
   │  📁 css                        │     │                         │
   │  📁 js                         │     │                         │
   │  📁 sql                        │     │                         │
   │  📁 docs                       │     │                         │
   │                                │     │                         │
   └────────────────────────────────┘     └─────────────────────────┘

   ※ Ctrl+A で全選択してからドラッグすると楽です
   ※ ただし CLAUDE.md、work/、1,gemini/、2.Claude/、.claude/ は
     アップロード不要です（個人メモなので）
   ```

3. ファイルが読み込まれると、一覧が表示される
   - `css/common.css` 、 `js/auth.js` のようにフォルダ付きで表示されればOK

4. 下部の「Commit changes」に適当なメッセージを入力（例: 「初回アップロード」）

5. 「Commit changes」ボタンをクリック

6. **アップロード完了を確認**: リポジトリのトップページに戻ると、こんな構成になっているはず:
   ```
   📁 css/
   📁 docs/
   📁 js/
   📁 sql/
   📄 README.md
   📄 board.html
   📄 doppelganger-diagnosis.index.html
   📄 index.html
   📄 profile.html
   📄 thread.html
   📄 types.html
   ```

---

## ステップ 3: GitHub Pages を有効にする

1. リポジトリページの上部タブから「Settings」をクリック
2. 左のサイドバーから「Pages」をクリック
3. **Build and deployment** の設定:
   - **Source**: 「Deploy from a branch」を選択
   - **Branch**: 「main」を選択、フォルダは「/ (root)」のまま
4. 「Save」をクリック
5. **1〜2分待つ**（デプロイに少し時間がかかります）

---

## ステップ 4: テストサイトにアクセスする

### あなたのサイトURL:
```
https://あなたのGitHubユーザー名.github.io/doppelganger/
```

### 各ページのURL:
| ページ | URL |
|--------|-----|
| 性格診断 | `https://ユーザー名.github.io/doppelganger/doppelganger-diagnosis.index.html` |
| 32タイプ一覧 | `https://ユーザー名.github.io/doppelganger/types.html` |
| ログイン画面（UI確認のみ） | `https://ユーザー名.github.io/doppelganger/index.html` |

### 確認方法:
- Settings → Pages のページに緑のバナーで「Your site is live at ...」と表示されたらOK
- 表示されない場合は1〜2分待ってからページを更新（F5）

---

## ステップ 5: テストする

### まずこの順番でチェック:

**① 診断を開く**
- 上記の診断URLをブラウザで開く
- トップ画面が表示されるか確認

**② 数問だけ回答してブラウザを閉じる**
- 10問くらい答えたらタブを閉じる
- 同じURLをもう一度開く
- 「途中から再開しますか？」バナーが出るか確認

**③ 全136問回答して結果を見る**
- 結果ページにタイプ名、レーダーチャート等が表示されるか
- SNSシェアボタンが動作するか（Xボタンを押してツイート画面が開くか）
- シェア文言に GitHub Pages の URL が含まれているか

**④ 32タイプ一覧を開く**
- 結果ページの「📖 全32タイプ一覧を見る」をクリック
- 一覧ページに遷移して、自分のタイプがハイライトされるか

---

## ファイルを更新したいとき

1. リポジトリページで更新したいファイルをクリック
2. 右上の「✏️」（鉛筆アイコン）をクリック
3. 内容を編集 → 「Commit changes」

### または、ファイルを丸ごと差し替える場合:
1. 「Add file」→「Upload files」
2. 同じ名前のファイルをアップロードすると上書きされる
3. 「Commit changes」

---

## よくあるトラブル

### 「404 Not Found」が出る
- GitHub Pages が有効になっていない → ステップ 3 を確認
- URLのリポジトリ名が間違っている → 大文字小文字に注意
- デプロイがまだ完了していない → 2〜3分待ってからF5

### ページは開くがデザインが崩れている
- `css/` フォルダがアップロードされていない → リポジトリに `css/common.css` があるか確認
- フォルダ構造がずれている（例: `css/` が `css/css/` になっている等）

### シェアボタンを押しても何も起きない
- ブラウザのポップアップブロックが動作している → 許可する
- `file://` で開いている（GitHub Pages のURLで開いているか確認）

### 途中セーブが効かない
- ブラウザの設定で localStorage がブロックされている
- シークレットモード（プライベートブラウジング）で開いている → 通常モードで開く

---

## スマホでテストする

GitHub Pages の URL はスマホのブラウザでもそのままアクセスできます:

1. PC のブラウザで URL をコピー
2. 自分にLINEやメールでURLを送る
3. スマホで開く

スマホでチェックすべきポイント:
- 画面が崩れていないか（レスポンシブ対応の確認）
- ボタンが押しやすいサイズか
- シェアボタンが動作するか（特にInstagram）
