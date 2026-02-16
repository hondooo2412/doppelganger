// ============================================================
// Doppelganger - Supabase 接続設定
// ============================================================
// ⚠️ セットアップ手順:
// 1. https://supabase.com でプロジェクトを作成
// 2. Settings > API から URL と anon key をコピー
// 3. 下記のプレースホルダーを置き換える
// ============================================================

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Supabase クライアント初期化
// ※ supabase-js は CDN から読み込み（index.html の <script> タグで先に読み込む）
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// 共通ユーティリティ
// ============================================================

// 現在のログインユーザーを取得
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ユーザーのプロフィール（usersテーブル）を取得
async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// 現在のユーザーのプロフィールを取得（キャッシュ付き）
let _cachedProfile = null;
async function getMyProfile(forceRefresh = false) {
  if (_cachedProfile && !forceRefresh) return _cachedProfile;
  const user = await getCurrentUser();
  if (!user) return null;
  _cachedProfile = await getUserProfile(user.id);
  return _cachedProfile;
}

// プロフィールキャッシュのクリア
function clearProfileCache() {
  _cachedProfile = null;
}

// 認証状態の変化を監視
function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    clearProfileCache();
    callback(event, session);
  });
}

// ログイン必須のページガード
async function requireAuth(redirectTo = 'index.html') {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

// 診断完了チェック
async function requireDiagnosis(redirectTo = 'doppelganger-diagnosis.index.html') {
  const profile = await getMyProfile();
  if (!profile || !profile.diagnosis_completed_at) {
    window.location.href = redirectTo;
    return null;
  }
  return profile;
}

// トースト通知
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// 相対時間の表示（例: "3分前", "2時間前"）
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'たった今';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}日前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

// ファミリー名 → CSS クラス名
function familyClass(family) {
  return family ? `badge-${family.toLowerCase()}` : '';
}

// ファミリー名 → アイコンスタイル用RGB
function familyColor(family) {
  const colors = {
    Architects: 'var(--fam-architects)',
    Mystics: 'var(--fam-mystics)',
    Commanders: 'var(--fam-commanders)',
    Catalysts: 'var(--fam-catalysts)',
  };
  return colors[family] || 'var(--fam-architects)';
}

// HTMLエスケープ（XSS対策）
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
