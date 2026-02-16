// ============================================================
// Doppelganger - 掲示板ロジック
// ※ supabase-config.js, auth.js, moderation.js を先に読み込むこと
// ============================================================

const Board = {
  // ============================================================
  // 板一覧を取得（自分がアクセスできる板のみRLSで自動フィルタ）
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
        user:users!threads_user_id_fkey(display_id, type_name, type_number, family)
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
        user:users!posts_user_id_fkey(display_id, type_name, type_number, family)
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
        user:users!posts_user_id_fkey(display_id, type_name, type_number, family)
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

    return `
      <a href="thread.html?id=${thread.id}" class="thread-item">
        <span class="thread-icon">💬</span>
        <div class="thread-body">
          <div class="thread-title">${pinned}${locked} ${escapeHtml(thread.title)}</div>
          <div class="thread-meta">
            <span class="badge ${badge}">${escapeHtml(user.type_name || '不明')}</span>
            <span>${escapeHtml(user.display_id || '')}</span>
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
    const colorVar = familyColor(family);

    return `
      <div class="post-card" data-post-id="${post.id}">
        <div class="post-header">
          <div class="user-badge">
            <div class="user-type-icon" style="background:rgba(${colorVar},.12);border:1px solid rgba(${colorVar},.3)">
              ${getTypeEmoji(user.type_number)}
            </div>
            <div class="user-info">
              <span class="user-type-name">${escapeHtml(user.type_name || '不明')}</span>
              <span class="user-display-id">${escapeHtml(user.display_id || '')}</span>
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
