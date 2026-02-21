-- ============================================================
-- 差分SQL: username + diagnosis_history カラムを追加
-- 既存のSupabaseプロジェクトに対して実行する
-- SQL Editor で実行してください
-- ============================================================

-- 1. usernameカラムを追加（アカウントID、一度設定したら変更不可）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 2. diagnosis_historyカラムを追加（診断履歴、最大3件のJSONB配列）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS diagnosis_history JSONB NOT NULL DEFAULT '[]';

-- 3. hobbiesカラムを追加（未実施の場合のみ）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hobbies JSONB NOT NULL DEFAULT '[]';

-- 4. usernameのRLSポリシー（他人のusernameも読める、自分だけ書ける）
-- ※ usersテーブルのRLSは既存のまま（SELECT: authenticated / UPDATE: own row）

-- 確認クエリ（コメントアウトして必要に応じて実行）
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;
