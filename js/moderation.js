// ============================================================
// Doppelganger - モデレーション機能
// 禁止ワードフィルター + 通報機能
// ※ supabase-config.js を先に読み込むこと
// ============================================================

const Moderation = {
  // ============================================================
  // 禁止パターン（正規表現）
  // ============================================================
  BLOCKED_PATTERNS: [
    // 電話番号（ハイフン有無、全角半角）
    /(?:0[0-9０-９]{1,4}[-ー−]?[0-9０-９]{1,4}[-ー−]?[0-9０-９]{3,4})/,
    // メールアドレス
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
    // LINE ID
    /(?:LINE|ライン|らいん)\s*(?:ID|ＩＤ|id|アイディー)?\s*[:：]?\s*[a-zA-Z0-9._\-]+/i,
    // Twitter/X アカウント
    /(?:Twitter|ツイッター|@)\s*[:：]?\s*@?[a-zA-Z0-9_]{1,15}/i,
    // Instagram
    /(?:Instagram|インスタ|いんすた)\s*[:：]?\s*@?[a-zA-Z0-9._]+/i,
    // Discord
    /(?:Discord|ディスコード|ディスコ)\s*[:：]?\s*[a-zA-Z0-9._#]+/i,
    // 個人情報っぽい開示要求
    /(?:個人|住所|本名|実名|電話番号|連絡先)\s*(?:教えて|おしえて|晒して|さらして|交換)/i,
    // 出会い目的
    /(?:会いたい|あいたい|デート|でーと|付き合|つきあ|彼氏|彼女|恋人)\s*(?:募集|ぼしゅう|探し|さがし|なりたい|ほしい)/i,
    // URL（http/https）
    /https?:\/\/[^\s]+/i,
  ],

  // ============================================================
  // 投稿内容チェック
  // 戻り値: { ok: boolean, reason?: string }
  // ============================================================
  checkContent(text) {
    if (!text || text.trim().length === 0) {
      return { ok: false, reason: '投稿内容を入力してください' };
    }

    if (text.length > 2000) {
      return { ok: false, reason: '投稿は2000文字以内にしてください' };
    }

    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(text)) {
        return {
          ok: false,
          reason: '個人情報・連絡先・URL・出会い目的の投稿は禁止されています',
        };
      }
    }

    return { ok: true };
  },

  // ============================================================
  // スレッドタイトルチェック
  // ============================================================
  checkTitle(title) {
    if (!title || title.trim().length === 0) {
      return { ok: false, reason: 'タイトルを入力してください' };
    }

    if (title.length > 100) {
      return { ok: false, reason: 'タイトルは100文字以内にしてください' };
    }

    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(title)) {
        return {
          ok: false,
          reason: '個人情報・連絡先・出会い目的のタイトルは禁止されています',
        };
      }
    }

    return { ok: true };
  },

  // ============================================================
  // 通報送信
  // ============================================================
  async submitReport(postId, reason) {
    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        post_id: postId,
        reason: reason,
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error('この投稿は既に通報済みです');
      }
      throw error;
    }
  },

  // ============================================================
  // 通報モーダルを表示
  // ============================================================
  showReportModal(postId) {
    // 既存のモーダルを削除
    const existing = document.getElementById('report-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'report-modal';
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">投稿を通報</div>
        <div class="form-group">
          <label class="form-label">通報理由</label>
          <select id="report-reason-select" class="form-input" style="cursor:pointer">
            <option value="">選択してください</option>
            <option value="個人情報の掲載">個人情報の掲載</option>
            <option value="出会い目的の投稿">出会い目的の投稿</option>
            <option value="誹謗中傷・攻撃的な内容">誹謗中傷・攻撃的な内容</option>
            <option value="スパム・宣伝">スパム・宣伝</option>
            <option value="その他の違反">その他の違反</option>
          </select>
        </div>
        <div class="form-group hidden" id="report-detail-group">
          <label class="form-label">詳細（任意）</label>
          <textarea id="report-detail" class="form-input" rows="3"
            placeholder="具体的な理由があれば記入してください"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" id="report-cancel">キャンセル</button>
          <button class="btn btn-danger btn-sm" id="report-submit" disabled>通報する</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const select = document.getElementById('report-reason-select');
    const detailGroup = document.getElementById('report-detail-group');
    const submitBtn = document.getElementById('report-submit');

    select.addEventListener('change', () => {
      submitBtn.disabled = !select.value;
      detailGroup.classList.toggle('hidden', select.value !== 'その他の違反');
    });

    document.getElementById('report-cancel').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    submitBtn.addEventListener('click', async () => {
      const reason = select.value;
      const detail = document.getElementById('report-detail').value;
      const fullReason = detail ? `${reason}: ${detail}` : reason;

      submitBtn.disabled = true;
      submitBtn.textContent = '送信中...';

      try {
        await this.submitReport(postId, fullReason);
        overlay.remove();
        showToast('通報を受け付けました。ご協力ありがとうございます。', 'success');
      } catch (err) {
        showToast(err.message || '通報の送信に失敗しました', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '通報する';
      }
    });
  },
};
