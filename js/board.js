// ============================================================
// Doppelganger - 掲示板ロジック
// ※ supabase-config.js, auth.js, moderation.js を先に読み込むこと
// ============================================================

const Board = {
  // ============================================================
  // 大カテゴリーデータ（DBと同期したJS定数）
  // ※ カテゴリーを追加した場合はここにも追記する（id は DB の SERIAL 順）
  // ============================================================
  getCategoryData() {
    return [
      { id:  1, name: '雑談・日常',             icon: '💬' },
      { id:  2, name: '音楽',                  icon: '🎵' },
      { id:  3, name: 'アニメ・マンガ・ゲーム', icon: '🎮' },
      { id:  4, name: '映画・ドラマ・動画',     icon: '🎬' },
      { id:  5, name: 'スポーツ・アウトドア',   icon: '⚽' },
      { id:  6, name: '読書・学習',             icon: '📚' },
      { id:  7, name: '創作・アート',           icon: '🎨' },
      { id:  8, name: 'グルメ・食',             icon: '🍜' },
      { id:  9, name: 'ファッション・美容',     icon: '👗' },
      { id: 10, name: 'テクノロジー',           icon: '💻' },
      { id: 11, name: 'オフ会・イベント',       icon: '🎉' },
      { id: 12, name: 'お悩み・サポート',       icon: '🤝' },
      { id: 13, name: 'Doppelganger',          icon: '🔮' },
    ];
  },

  // ============================================================
  // 中カテゴリー（サブカテゴリー）を大カテゴリーIDで取得
  // ============================================================
  async getSubcategories(categoryId) {
    const { data, error } = await supabase
      .from('board_subcategories')
      .select('*')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  // ============================================================
  // 板一覧をサブカテゴリー + エリア（family/type）でフィルタ取得
  // ============================================================
  async getBoardsBySubcategory(subcategoryId, areaType, profile) {
    let query = supabase
      .from('boards')
      .select('*')
      .eq('subcategory_id', subcategoryId)
      .eq('board_type', areaType);

    if (areaType === 'family') {
      query = query.eq('family_filter', profile.family);
    } else {
      query = query.eq('type_filter', profile.type_number);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // ============================================================
  // 板（小カテゴリー）を作成（ユーザー）
  // ============================================================
  async createBoard({ subcategoryId, areaType, profile, name, desc, icon }) {
    // バリデーション
    const nameCheck = Moderation.checkTitle(name);
    if (!nameCheck.ok) throw new Error(nameCheck.reason);

    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    const insertData = {
      subcategory_id: subcategoryId,
      board_type:     areaType,
      name:           name.trim().slice(0, 40),
      description:    desc ? desc.trim().slice(0, 100) : null,
      icon:           icon || '📋',
      created_by:     user.id,
      slug:           `user-${user.id.slice(0,8)}-${Date.now()}`,
    };

    if (areaType === 'family') {
      insertData.family_filter = profile.family;
    } else {
      insertData.type_filter = profile.type_number;
    }

    const { data, error } = await supabase
      .from('boards')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ============================================================
  // 板一覧を取得（後方互換のため残す）
  // ============================================================
  async getBoards() {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  // ============================================================
  // 特定の板を取得
  // ============================================================
  async getBoard(boardId) {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .single();
    if (error) throw error;
    return data;
  },

  // ============================================================
  // スレッド一覧を取得（板ごと）
  // ============================================================
  async getThreads(boardId, { page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('threads')
      .select(`
        *,
        user:users!threads_user_id_fkey(display_id, type_name, type_number, family, nickname, avatar_url)
      `, { count: 'exact' })
      .eq('board_id', boardId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { threads: data, total: count };
  },

  // ============================================================
  // スレッド詳細を取得
  // ============================================================
  async getThread(threadId) {
    const { data, error } = await supabase
      .from('threads')
      .select(`
        *,
        board:boards!threads_board_id_fkey(*),
        user:users!threads_user_id_fkey(display_id, type_name, type_number, family)
      `)
      .eq('id', threadId)
      .single();
    if (error) throw error;
    return data;
  },

  // ============================================================
  // スレッド内の投稿一覧を取得
  // ============================================================
  async getPosts(threadId, { page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('posts')
      .select(`
        *,
        user:users!posts_user_id_fkey(display_id, type_name, type_number, family, nickname, avatar_url)
      `, { count: 'exact' })
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) throw error;
    return { posts: data, total: count };
  },

  // ============================================================
  // 新規スレッド作成
  // ============================================================
  async createThread(boardId, title, firstPostContent) {
    // バリデーション
    const titleCheck = Moderation.checkTitle(title);
    if (!titleCheck.ok) throw new Error(titleCheck.reason);

    const contentCheck = Moderation.checkContent(firstPostContent);
    if (!contentCheck.ok) throw new Error(contentCheck.reason);

    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    // スレッド作成
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .insert({
        board_id: boardId,
        user_id: user.id,
        title: title.trim(),
      })
      .select()
      .single();

    if (threadError) throw threadError;

    // 最初の投稿を作成
    const { error: postError } = await supabase
      .from('posts')
      .insert({
        thread_id: thread.id,
        user_id: user.id,
        content: firstPostContent.trim(),
      });

    if (postError) throw postError;

    return thread;
  },

  // ============================================================
  // 投稿（返信）を作成
  // ============================================================
  async createPost(threadId, content) {
    const contentCheck = Moderation.checkContent(content);
    if (!contentCheck.ok) throw new Error(contentCheck.reason);

    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    const { data, error } = await supabase
      .from('posts')
      .insert({
        thread_id: threadId,
        user_id: user.id,
        content: content.trim(),
      })
      .select(`
        *,
        user:users!posts_user_id_fkey(display_id, type_name, type_number, family, nickname, avatar_url)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // ============================================================
  // 投稿を論理削除（自分の投稿のみ）
  // ============================================================
  async deletePost(postId) {
    const { error } = await supabase
      .from('posts')
      .update({ is_deleted: true })
      .eq('id', postId);

    if (error) throw error;
  },

  // ============================================================
  // いいね ON/OFF
  // ============================================================
  async toggleLike(postId) {
    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    // 既にいいね済みか確認
    const { data: existing } = await supabase
      .from('likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .maybeSingle();

    if (existing) {
      // いいね解除
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId);
      if (error) throw error;
      return false; // いいね解除した
    } else {
      // いいね追加
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, post_id: postId });
      if (error) throw error;
      return true; // いいねした
    }
  },

  // ============================================================
  // 自分がいいね済みの投稿IDセットを取得
  // ============================================================
  async getMyLikes(postIds) {
    if (!postIds || postIds.length === 0) return new Set();

    const user = await getCurrentUser();
    if (!user) return new Set();

    const { data, error } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds);

    if (error) throw error;
    return new Set(data.map(l => l.post_id));
  },

  // ============================================================
  // リアルタイム購読（スレッド内の新着投稿）
  // ============================================================
  subscribeToThread(threadId, onNewPost) {
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          // ユーザー情報を追加取得
          const { data: user } = await supabase
            .from('users')
            .select('display_id, type_name, type_number, family')
            .eq('id', payload.new.user_id)
            .single();

          onNewPost({ ...payload.new, user });
        }
      )
      .subscribe();

    return channel; // unsubscribe用
  },

  // ============================================================
  // HTML生成ヘルパー
  // ============================================================

  // 板カードHTML
  renderBoardCard(board) {
    return `
      <a href="board.html?id=${board.id}" class="board-card" data-board-id="${board.id}">
        <span class="board-icon">${board.icon || '📋'}</span>
        <div class="board-info">
          <div class="board-name">${escapeHtml(board.name)}</div>
          <div class="board-desc">${escapeHtml(board.description || '')}</div>
        </div>
        <span class="board-arrow">›</span>
      </a>
    `;
  },

  // スレッド一覧アイテムHTML
  renderThreadItem(thread) {
    const pinned = thread.is_pinned ? '<span class="thread-pinned">📌 固定</span>' : '';
    const locked = thread.is_locked ? '<span class="thread-locked">🔒</span>' : '';
    const user = thread.user || {};
    const badge = user.family ? `badge-${user.family.toLowerCase()}` : '';
    const displayName = user.nickname || user.type_name || '不明';

    return `
      <a href="thread.html?id=${thread.id}" class="thread-item">
        <span class="thread-icon">${typeof renderUserAvatar === 'function' ? renderUserAvatar(user, 28) : '💬'}</span>
        <div class="thread-body">
          <div class="thread-title">${pinned}${locked} ${escapeHtml(thread.title)}</div>
          <div class="thread-meta">
            <span style="font-weight:600;color:var(--text)">${escapeHtml(displayName)}</span>
            <span class="badge ${badge}">${escapeHtml(user.type_name || '')}</span>
            <span>💬 ${thread.reply_count}</span>
            <span>${timeAgo(thread.updated_at)}</span>
          </div>
        </div>
      </a>
    `;
  },

  // 投稿カードHTML
  renderPostCard(post, isLiked = false, isOwn = false) {
    const user = post.user || {};
    const family = user.family || 'Architects';
    const badgeClass = `badge-${family.toLowerCase()}`;
    const displayName = user.nickname || user.type_name || '不明';
    const avatarHtml = typeof renderUserAvatar === 'function'
      ? renderUserAvatar(user, 36)
      : `<div class="user-type-icon" style="background:rgba(${familyColor(family)},.12);border:1px solid rgba(${familyColor(family)},.3)">${getTypeEmoji(user.type_number)}</div>`;

    return `
      <div class="post-card" data-post-id="${post.id}">
        <div class="post-header">
          <div class="user-badge">
            ${avatarHtml}
            <div class="user-info">
              <span class="user-type-name">${escapeHtml(displayName)}</span>
              <span class="user-display-id">${escapeHtml(user.type_name || '')} ${escapeHtml(user.display_id || '')}</span>
            </div>
          </div>
          <span class="badge ${badgeClass}">${family}</span>
        </div>
        <div class="post-content">${escapeHtml(post.content).replace(/\n/g, '<br>')}</div>
        <div class="post-actions">
          <button class="post-action ${isLiked ? 'liked' : ''}" data-action="like" data-post-id="${post.id}">
            ${isLiked ? '❤️' : '🤍'} <span class="like-count">${post.likes_count || 0}</span>
          </button>
          <button class="post-action" data-action="report" data-post-id="${post.id}">
            🚩 通報
          </button>
          ${isOwn ? `<button class="post-action" data-action="delete" data-post-id="${post.id}">🗑️ 削除</button>` : ''}
          <span class="post-time">${timeAgo(post.created_at)}</span>
        </div>
      </div>
    `;
  },
};

// タイプ番号 → 絵文字（板データから取得できない場合のフォールバック）
function getTypeEmoji(typeNumber) {
  const emojis = {
    1:'🦉',2:'🧭',3:'🛡️',4:'♟️',5:'🔍',6:'⚙️',7:'🏰',8:'👑',
    9:'🌌',10:'🌬️',11:'🌙',12:'🎼',13:'🌊',14:'⚡',15:'🎭',16:'🃏',
    17:'🕊️',18:'🦅',19:'⚜️',20:'🦁',21:'⚖️',22:'🔥',23:'⚒️',24:'🏛️',
    25:'☀️',26:'🔥',27:'🌿',28:'🌟',29:'🎪',30:'🌪️',31:'✨',32:'🎭',
  };
  return emojis[typeNumber] || '👤';
}
