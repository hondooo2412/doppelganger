// ============================================================
// Doppelganger - アバター画像処理
// クライアント側リサイズ + WebP変換 + Supabase Storage
// ============================================================

const Avatar = {
  // --- 設定 ---
  MAX_INPUT_SIZE: 5 * 1024 * 1024,  // アップロード前最大: 5MB
  OUTPUT_SIZE: 200,                  // リサイズ後: 200x200px
  MAX_OUTPUT_BYTES: 50 * 1024,       // 変換後上限: 50KB
  INITIAL_QUALITY: 0.7,              // WebP初期品質
  MIN_QUALITY: 0.3,                  // 最低品質（これ以下にはしない）
  BUCKET: 'avatars',
  FILE_NAME: 'avatar.webp',

  // ============================================================
  // 画像ファイル → 200px正方形 WebP Blob に変換
  // ============================================================
  async processImage(file) {
    // ファイルサイズチェック
    if (file.size > this.MAX_INPUT_SIZE) {
      throw new Error('画像サイズが大きすぎます（5MB以下にしてください）');
    }

    // 画像タイプチェック
    if (!file.type.startsWith('image/')) {
      throw new Error('画像ファイルを選択してください');
    }

    // ファイル → Image要素
    const img = await this._loadImage(file);

    // Canvas で 200x200px に中央クロップ + リサイズ
    const canvas = document.createElement('canvas');
    canvas.width = this.OUTPUT_SIZE;
    canvas.height = this.OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');

    // 中央クロップ計算（短辺に合わせて正方形に切り出し）
    const size = Math.min(img.width, img.height);
    const sx = (img.width - size) / 2;
    const sy = (img.height - size) / 2;

    // アンチエイリアスを効かせて描画
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, size, size, 0, 0, this.OUTPUT_SIZE, this.OUTPUT_SIZE);

    // WebP変換（段階的に品質を下げて50KB以下にする）
    let quality = this.INITIAL_QUALITY;
    let blob = await this._canvasToBlob(canvas, 'image/webp', quality);

    // WebP非対応ブラウザのフォールバック（blobがnullまたはimage/pngになった場合）
    if (!blob || blob.type !== 'image/webp') {
      blob = await this._canvasToBlob(canvas, 'image/jpeg', quality);
    }

    // サイズが大きすぎる場合、品質を下げて再圧縮
    while (blob && blob.size > this.MAX_OUTPUT_BYTES && quality > this.MIN_QUALITY) {
      quality -= 0.1;
      const mimeType = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      blob = await this._canvasToBlob(canvas, mimeType, quality);
    }

    if (!blob) {
      throw new Error('画像の変換に失敗しました');
    }

    return blob;
  },

  // ============================================================
  // Blob → Supabase Storage にアップロード → 公開URLを返す
  // ============================================================
  async uploadAvatar(blob) {
    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    const filePath = `${user.id}/${this.FILE_NAME}`;
    const fileExt = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const finalPath = `${user.id}/avatar.${fileExt}`;

    // 既存ファイルを削除してからアップロード（上書き）
    await supabase.storage.from(this.BUCKET).remove([finalPath]);

    const { data, error } = await supabase.storage
      .from(this.BUCKET)
      .upload(finalPath, blob, {
        contentType: blob.type,
        upsert: true,
      });

    if (error) {
      console.error('Avatar upload error:', error);
      throw new Error('アイコンのアップロードに失敗しました');
    }

    // 公開URLを取得
    const { data: urlData } = supabase.storage
      .from(this.BUCKET)
      .getPublicUrl(finalPath);

    const publicUrl = urlData.publicUrl;

    // usersテーブルのavatar_urlを更新
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: publicUrl + '?t=' + Date.now() }) // キャッシュバスト用タイムスタンプ
      .eq('id', user.id);

    if (updateError) {
      console.error('Avatar URL update error:', updateError);
      throw new Error('プロフィールの更新に失敗しました');
    }

    // プロフィールキャッシュをクリア
    if (typeof clearProfileCache === 'function') clearProfileCache();

    return publicUrl;
  },

  // ============================================================
  // ユーザーIDから公開URLを取得（キャッシュバスト付き）
  // ============================================================
  getAvatarUrl(userId) {
    const { data } = supabase.storage
      .from(this.BUCKET)
      .getPublicUrl(`${userId}/avatar.webp`);
    return data.publicUrl;
  },

  // ============================================================
  // 自分のアバターを削除
  // ============================================================
  async deleteAvatar() {
    const user = await getCurrentUser();
    if (!user) throw new Error('ログインが必要です');

    // webpとjpg両方削除（どちらか分からないため）
    await supabase.storage.from(this.BUCKET).remove([
      `${user.id}/avatar.webp`,
      `${user.id}/avatar.jpg`,
    ]);

    // avatar_urlをnullに更新
    await supabase.from('users').update({ avatar_url: null }).eq('id', user.id);

    if (typeof clearProfileCache === 'function') clearProfileCache();
  },

  // ============================================================
  // クロップ済みCanvas → WebP Blob に変換（Cropper.js連携用）
  // ============================================================
  async processCroppedCanvas(canvas) {
    let quality = this.INITIAL_QUALITY;
    let blob = await this._canvasToBlob(canvas, 'image/webp', quality);

    if (!blob || blob.type !== 'image/webp') {
      blob = await this._canvasToBlob(canvas, 'image/jpeg', quality);
    }

    while (blob && blob.size > this.MAX_OUTPUT_BYTES && quality > this.MIN_QUALITY) {
      quality -= 0.1;
      const mimeType = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      blob = await this._canvasToBlob(canvas, mimeType, quality);
    }

    if (!blob) throw new Error('画像の変換に失敗しました');
    return blob;
  },

  // ============================================================
  // プレビュー用: File → Data URL（プレビュー表示用、アップロードしない）
  // ============================================================
  async createPreview(file) {
    const blob = await this.processImage(file);
    return URL.createObjectURL(blob);
  },

  // --- 内部ヘルパー ---

  _loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      img.src = URL.createObjectURL(file);
    });
  },

  _canvasToBlob(canvas, mimeType, quality) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), mimeType, quality);
    });
  },
};
