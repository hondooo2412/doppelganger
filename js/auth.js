// ============================================================
// Doppelganger - 認証ロジック
// ※ supabase-config.js を先に読み込むこと
// ============================================================

const Auth = {
  // ============================================================
  // メール/パスワード新規登録
  // ============================================================
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;

    // usersテーブルにレコードを作成
    if (data.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({ id: data.user.id });
      if (profileError && profileError.code !== '23505') {
        // 23505 = 既に存在（重複INSERT防止）
        throw profileError;
      }
    }

    return data;
  },

  // ============================================================
  // メール/パスワードログイン
  // ============================================================
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // ============================================================
  // Googleログイン
  // ============================================================
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/board.html',
      },
    });
    if (error) throw error;
    return data;
  },

  // ============================================================
  // ログアウト
  // ============================================================
  async signOut() {
    clearProfileCache();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = 'index.html';
  },

  // ============================================================
  // パスワードリセットメール送信
  // ============================================================
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/index.html?reset=1',
    });
    if (error) throw error;
  },

  // ============================================================
  // 診断結果をユーザープロフィールに保存
  // ============================================================
  async saveDiagnosisResult(result) {
    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    const { error } = await supabase
      .from('users')
      .update({
        type_code: result.typeCode,
        type_number: result.typeNumber,
        type_name: result.typeName,
        family: result.family,
        diagnosis_scores: result.scores,
        diagnosis_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) throw error;
    clearProfileCache();
  },

  // ============================================================
  // プロフィール保存（ニックネーム・自己紹介・username）
  // ============================================================
  async saveProfile(nickname, bio, hobbies = [], username = null) {
    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    const updates = {
      nickname: nickname.trim().slice(0, 20),
      bio: bio ? bio.trim().slice(0, 100) : null,
      hobbies: (hobbies || []).slice(0, 3),
      profile_completed_at: new Date().toISOString(),
    };

    // usernameは初回のみ設定（nullなら更新しない）
    if (username) {
      updates.username = username.toLowerCase().slice(0, 20);
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;
    clearProfileCache();
  },

  // ============================================================
  // 認証状態に応じたUI切り替え
  // ============================================================
  async initAuthUI() {
    const user = await getCurrentUser();

    // ログイン済み → 適切なページへ
    if (user && window.location.pathname.endsWith('index.html')) {
      const profile = await getMyProfile();
      if (profile) {
        // プロフィール未設定（ニックネームなし）→ プロフィール設定へ
        if (!profile.nickname) {
          window.location.href = 'profile.html?setup=1';
          return;
        }
        // プロフィール設定済み・診断未完了 → 診断へ
        if (!profile.diagnosis_completed_at) {
          window.location.href = 'doppelganger-diagnosis.index.html';
          return;
        }
        // 診断済み → 掲示板へ
        window.location.href = 'board.html';
        return;
      }
    }

    return user;
  },
};
