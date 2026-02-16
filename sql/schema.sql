-- ============================================================
-- Doppelganger 掲示板 DBスキーマ
-- Supabase PostgreSQL 用
-- ============================================================

-- UUID生成用
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ユーザーテーブル（Supabase Auth と連携）
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id TEXT NOT NULL UNIQUE,               -- 匿名ID（例: "#A3K7"）
  type_code TEXT,                                 -- 5軸コード（例: "Core-Logic-Open-Free-Flow"）
  type_number INT CHECK (type_number BETWEEN 1 AND 32),
  type_name TEXT,                                 -- タイプ名（例: "静かなる賢者"）
  family TEXT CHECK (family IN ('Architects','Mystics','Commanders','Catalysts')),
  diagnosis_scores JSONB,                         -- {P1:72, P2:35, ...P15:68}
  diagnosis_progress JSONB,                       -- 途中セーブ用 {cur, ans[], ts}
  diagnosis_completed_at TIMESTAMPTZ,
  ban_status TEXT NOT NULL DEFAULT 'active' CHECK (ban_status IN ('active','warned','banned')),
  violation_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- display_id の自動生成関数（英数字4文字）
CREATE OR REPLACE FUNCTION generate_display_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 紛らわしい文字を除外（I,O,0,1）
  result TEXT := '#';
  i INT;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 新規ユーザー作成時にdisplay_idを自動セット
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_display_id TEXT;
  max_attempts INT := 10;
  attempt INT := 0;
BEGIN
  LOOP
    new_display_id := generate_display_id();
    -- 重複チェック
    IF NOT EXISTS (SELECT 1 FROM users WHERE display_id = new_display_id) THEN
      NEW.display_id := new_display_id;
      EXIT;
    END IF;
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'display_id生成に失敗しました';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_insert
  BEFORE INSERT ON users
  FOR EACH ROW
  WHEN (NEW.display_id IS NULL)
  EXECUTE FUNCTION handle_new_user();

-- updated_at の自動更新
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. 掲示板テーブル
-- ============================================================
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,                       -- URL用スラッグ
  board_type TEXT NOT NULL CHECK (board_type IN ('family','type')),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,                                       -- 絵文字アイコン
  family_filter TEXT CHECK (family_filter IN ('Architects','Mystics','Commanders','Catalysts')),
  type_filter INT CHECK (type_filter BETWEEN 1 AND 32),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. スレッドテーブル
-- ============================================================
CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reply_count INT NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_threads_board ON threads(board_id, updated_at DESC);
CREATE INDEX idx_threads_user ON threads(user_id);

CREATE TRIGGER threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. 投稿テーブル
-- ============================================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  likes_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_posts_thread ON posts(thread_id, created_at ASC);
CREATE INDEX idx_posts_user ON posts(user_id);

-- reply_count の自動更新（投稿追加時）
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE threads SET reply_count = reply_count + 1, updated_at = now()
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_post_insert
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_reply_count();

-- ============================================================
-- 5. いいねテーブル
-- ============================================================
CREATE TABLE likes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- likes_count の自動更新
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION update_likes_count();

-- ============================================================
-- 6. 通報テーブル
-- ============================================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 同一ユーザーが同一投稿を複数回通報するのを防止
  UNIQUE (reporter_id, post_id)
);

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);

-- ============================================================
-- 7. Row Level Security (RLS)
-- ============================================================

-- 全テーブルでRLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- --- users ---
-- 自分のプロフィールは読み書き可能
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (auth.uid() = id);

-- 掲示板表示のため、他ユーザーの公開情報（display_id, type_name, family等）も閲覧可
CREATE POLICY "users_select_public" ON users FOR SELECT
  USING (true);

CREATE POLICY "users_insert_own" ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- --- boards ---
-- 板の閲覧: 診断完了ユーザーのみ（自分のファミリー/タイプの板のみ）
CREATE POLICY "boards_select" ON boards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid()
      AND u.diagnosis_completed_at IS NOT NULL
      AND (
        -- familyタイプの板: 自分のファミリーと一致
        (boards.board_type = 'family' AND boards.family_filter = u.family)
        OR
        -- typeタイプの板: 自分のタイプ番号と一致
        (boards.board_type = 'type' AND boards.type_filter = u.type_number)
      )
    )
  );

-- --- threads ---
-- スレッド閲覧: 板を閲覧できるユーザーのみ
CREATE POLICY "threads_select" ON threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards b
      JOIN users u ON u.id = auth.uid()
      WHERE b.id = threads.board_id
      AND u.diagnosis_completed_at IS NOT NULL
      AND (
        (b.board_type = 'family' AND b.family_filter = u.family)
        OR (b.board_type = 'type' AND b.type_filter = u.type_number)
      )
    )
  );

-- スレッド作成: 自分の板にのみ
CREATE POLICY "threads_insert" ON threads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM boards b
      JOIN users u ON u.id = auth.uid()
      WHERE b.id = board_id
      AND u.diagnosis_completed_at IS NOT NULL
      AND u.ban_status = 'active'
      AND (
        (b.board_type = 'family' AND b.family_filter = u.family)
        OR (b.board_type = 'type' AND b.type_filter = u.type_number)
      )
    )
  );

-- --- posts ---
-- 投稿閲覧: スレッドが見える人
CREATE POLICY "posts_select" ON posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM threads t
      JOIN boards b ON b.id = t.board_id
      JOIN users u ON u.id = auth.uid()
      WHERE t.id = posts.thread_id
      AND u.diagnosis_completed_at IS NOT NULL
      AND (
        (b.board_type = 'family' AND b.family_filter = u.family)
        OR (b.board_type = 'type' AND b.type_filter = u.type_number)
      )
    )
  );

-- 投稿作成: BAN されていないユーザーのみ
CREATE POLICY "posts_insert" ON posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid()
      AND u.ban_status != 'banned'
      AND u.diagnosis_completed_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM threads t
      JOIN boards b ON b.id = t.board_id
      JOIN users u ON u.id = auth.uid()
      WHERE t.id = thread_id
      AND t.is_locked = false
      AND (
        (b.board_type = 'family' AND b.family_filter = u.family)
        OR (b.board_type = 'type' AND b.type_filter = u.type_number)
      )
    )
  );

-- 自分の投稿のみ論理削除可能
CREATE POLICY "posts_update_own" ON posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --- likes ---
CREATE POLICY "likes_select" ON likes FOR SELECT
  USING (true);

CREATE POLICY "likes_insert" ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete" ON likes FOR DELETE
  USING (auth.uid() = user_id);

-- --- reports ---
CREATE POLICY "reports_insert" ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- 自分の通報のみ閲覧可能
CREATE POLICY "reports_select_own" ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- ============================================================
-- 8. 初期データ: 板の作成
-- ============================================================

-- ファミリーラウンジ（4板）
INSERT INTO boards (slug, board_type, name, description, icon, family_filter, sort_order) VALUES
  ('family-architects', 'family', 'Architects Lounge', '分析・考察・効率化で楽しむ人の広場', '🏛️', 'Architects', 1),
  ('family-mystics',    'family', 'Mystics Lounge',    '没入・感動・世界観に浸る人の広場',     '🌙', 'Mystics',    2),
  ('family-commanders', 'family', 'Commanders Lounge', '企画・攻略・情報整理で楽しむ人の広場', '⚔️', 'Commanders',  3),
  ('family-catalysts',  'family', 'Catalysts Lounge',  '体験・共有・盛り上がりで楽しむ人の広場','🔥', 'Catalysts',   4);

-- タイプ別ルーム（32室）
INSERT INTO boards (slug, board_type, name, description, icon, type_filter, sort_order) VALUES
  ('type-01', 'type', 'Type 01: 静かなる賢者の部屋',   '穏やかな知性の同類たちの空間',       '🦉', 1,  101),
  ('type-02', 'type', 'Type 02: 孤高の開拓者の部屋',   '一人で道を切り拓く者たちの空間',     '🧭', 2,  102),
  ('type-03', 'type', 'Type 03: 静かなる守護者の部屋',  '誠実に大切な人を守る者たちの空間',   '🛡️', 3,  103),
  ('type-04', 'type', 'Type 04: 戦略家の部屋',         '合理的に世界を構造化する者たちの空間', '♟️', 4,  104),
  ('type-05', 'type', 'Type 05: 影の観察者の部屋',     '深層から世界を観察する者たちの空間',   '🔍', 5,  105),
  ('type-06', 'type', 'Type 06: 異端の設計者の部屋',   '既成概念を壊す設計者たちの空間',      '⚙️', 6,  106),
  ('type-07', 'type', 'Type 07: 鉄壁の番人の部屋',     '揺るがない信念の番人たちの空間',      '🏰', 7,  107),
  ('type-08', 'type', 'Type 08: 冷徹なる司令官の部屋',  '冷静に全体を統率する者たちの空間',    '👑', 8,  108),
  ('type-09', 'type', 'Type 09: 夢見る哲学者の部屋',   '夢と哲学の世界を漂う者たちの空間',    '🌌', 9,  109),
  ('type-10', 'type', 'Type 10: 風の旅人の部屋',       '自由に世界を旅する者たちの空間',      '🌬️', 10, 110),
  ('type-11', 'type', 'Type 11: 月下の守り人の部屋',   '静かに大切な人を見守る者たちの空間',   '🌙', 11, 111),
  ('type-12', 'type', 'Type 12: 静寂の指揮者の部屋',   '静けさの中で全体を導く者たちの空間',   '🎼', 12, 112),
  ('type-13', 'type', 'Type 13: 漂流者の部屋',         '感情の海を漂う者たちの空間',          '🌊', 13, 113),
  ('type-14', 'type', 'Type 14: 嵐の自由人の部屋',     '嵐の中を駆け抜ける者たちの空間',      '⚡', 14, 114),
  ('type-15', 'type', 'Type 15: 仮面の守護者の部屋',   '仮面の裏で大切な人を守る者たちの空間', '🎭', 15, 115),
  ('type-16', 'type', 'Type 16: 仮面の指揮者の部屋',   '仮面の裏で全体を操る者たちの空間',     '🃏', 16, 116),
  ('type-17', 'type', 'Type 17: 穏やかなる導き手の部屋','穏やかに人を導く者たちの空間',        '🕊️', 17, 117),
  ('type-18', 'type', 'Type 18: 解放者の部屋',         '自由を追い求める者たちの空間',         '🦅', 18, 118),
  ('type-19', 'type', 'Type 19: 民の盾の部屋',         '人々を守るために立ち上がる者たちの空間','⚜️', 19, 119),
  ('type-20', 'type', 'Type 20: 覇道の王の部屋',       '覇道を突き進む者たちの空間',           '🦁', 20, 120),
  ('type-21', 'type', 'Type 21: 仮面の調停者の部屋',   '仮面の裏で調和を保つ者たちの空間',     '⚖️', 21, 121),
  ('type-22', 'type', 'Type 22: 革命家の部屋',         '世界を変えようとする者たちの空間',     '🔥', 22, 122),
  ('type-23', 'type', 'Type 23: 鋼鉄の指導者の部屋',   '鋼の意志で導く者たちの空間',           '⚒️', 23, 123),
  ('type-24', 'type', 'Type 24: 帝王の部屋',           '全てを統べる者たちの空間',             '🏛️', 24, 124),
  ('type-25', 'type', 'Type 25: 陽だまりの語り部の部屋','温もりで人を包む語り部たちの空間',     '☀️', 25, 125),
  ('type-26', 'type', 'Type 26: 炎の冒険者の部屋',     '情熱的に冒険を続ける者たちの空間',     '🔥', 26, 126),
  ('type-27', 'type', 'Type 27: 縁の下の力持ちの部屋',  '陰で全てを支える者たちの空間',        '🌿', 27, 127),
  ('type-28', 'type', 'Type 28: 太陽の指導者の部屋',   '明るく人を導く者たちの空間',           '🌟', 28, 128),
  ('type-29', 'type', 'Type 29: 仮面の共感者の部屋',   '仮面の裏で深く共感する者たちの空間',   '🎪', 29, 129),
  ('type-30', 'type', 'Type 30: 嵐の開拓者の部屋',     '嵐を巻き起こしながら前進する者たちの空間','🌪️', 30, 130),
  ('type-31', 'type', 'Type 31: 聖なる犠牲者の部屋',   '自らを犠牲にして守る者たちの空間',     '✨', 31, 131),
  ('type-32', 'type', 'Type 32: 仮面の太陽の部屋',     '仮面の裏に太陽を隠す者たちの空間',     '🎭', 32, 132);
