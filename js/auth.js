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
  // プロフィール保存（ニックネーム・自己紹介）
  // ============================================================
  async saveProfile(nickname, bio, hobbies = []) {
    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    const updates = {
      nickname: nickname.trim().slice(0, 20),
      bio: bio ? bio.trim().slice(0, 100) : null,
      hobbies: (hobbies || []).slice(0, 3),  // 最大3つ
      profile_completed_at: new Date().toISOString(),
    };

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
      if (profile && profile.diagnosis_completed_at) {
        // 診断済みだがプロフィール未設定 → プロフィール設定へ
        if (!profile.nickname) {
          window.location.href = 'profile.html?setup=1';
          return;
        }
        window.location.href = 'board.html';
        return;
      }
    }

    return user;
  },
};
