// ============================================================
// Doppelganger - Supabase 接続設定
// ============================================================

const SUPABASE_URL = 'https://ddabcnvxdheuyeqelffx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYWJjbnZ4ZGhldXllcWVsZmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NDY5NTYsImV4cCI6MjA4NzIyMjk1Nn0.211clga5DD-BvSosAosGVa04QBL3SdEQuQlC6do--C4';

// ※ const → var に変更（CDNのSDKと変数名が衝突するため）
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// 共通ユーティリティ
// ============================================================

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

let _cachedProfile = null;
async function getMyProfile(forceRefresh = false) {
  if (_cachedProfile && !forceRefresh) return _cachedProfile;
  const user = await getCurrentUser();
  if (!user) return null;
  _cachedProfile = await getUserProfile(user.id);
  return _cachedProfile;
}

function clearProfileCache() {
  _cachedProfile = null;
}

function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    clearProfileCache();
    callback(event, session);
  });
}

async function requireAuth(redirectTo = 'index.html') {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

async function requireDiagnosis(redirectTo = 'doppelganger-diagnosis.index.html') {
  const profile = await getMyProfile(true); // 常にDBから最新を取得（キャッシュ不使用）
  if (!profile || !profile.diagnosis_completed_at) {
    window.location.href = redirectTo;
    return null;
  }
  return profile;
}

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

function familyClass(family) {
  return family ? `badge-${family.toLowerCase()}` : '';
}

function familyColor(family) {
  const colors = {
    Architects: 'var(--fam-architects)',
    Mystics: 'var(--fam-mystics)',
    Commanders: 'var(--fam-commanders)',
    Catalysts: 'var(--fam-catalysts)',
  };
  return colors[family] || 'var(--fam-architects)';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function updateMyProfile(updates) {
  const user = await getCurrentUser();
  if (!user) throw new Error('ログインが必要です');

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  clearProfileCache();
  return data;
}

function renderUserAvatar(user, sizePx = 32) {
  if (user && user.avatar_url) {
    return `<img src="${escapeHtml(user.avatar_url)}" alt="" class="user-avatar" style="width:${sizePx}px;height:${sizePx}px" loading="lazy">`;
  }
  const emoji = typeof getTypeEmoji === 'function' ? getTypeEmoji(user?.type_number) : '👤';
  const fam = user?.family || 'Architects';
  return `<div class="user-avatar user-avatar-emoji" style="width:${sizePx}px;height:${sizePx}px;background:rgba(${_familyColorRGB(fam)},.12);border:1px solid rgba(${_familyColorRGB(fam)},.3);font-size:${Math.round(sizePx * 0.55)}px">${emoji}</div>`;
}

function _familyColorRGB(family) {
  const c = {
    Architects: '108,92,231',
    Mystics: '232,67,147',
    Commanders: '0,184,148',
    Catalysts: '253,203,110'
  };
  return c[family] || '108,92,231';
}

async function initNavUser() {
  try {
    const profile = await getMyProfile();
    if (!profile) return;

    const avatarEl = document.getElementById('nav-my-avatar');
    const nameEl = document.getElementById('nav-my-name');
    if (avatarEl) {
      if (profile.avatar_url) {
        avatarEl.innerHTML = `<img src="${escapeHtml(profile.avatar_url)}" alt="" class="nav-avatar-img">`;
      } else if (profile.type_number) {
        avatarEl.textContent = getTypeEmoji(profile.type_number);
      }
    }
    if (nameEl && profile.nickname) {
      nameEl.textContent = profile.nickname;
    }
  } catch(e) {
    // 未ログイン等は無視
  }
}
