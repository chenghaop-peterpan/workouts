// localStorage 草稿 (short memory)。防止斷電、關 tab、切網路造成資料遺失。
// 只有 submitSession 成功後才會 clear()。

const DRAFT_KEY = 'workout_draft';

const Draft = {
  load() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  save(draft) {
    draft.updated_at = new Date().toISOString();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  },

  clear() {
    localStorage.removeItem(DRAFT_KEY);
  },

  exists() {
    return !!localStorage.getItem(DRAFT_KEY);
  },

  // 新建一份空草稿
  // categories(選填):自由勾選部位時的 category 陣列,如 ['push','legs','core']。
  // 3 顆快速按鈕不傳,session.html 會從 type 逗號切開相容。
  create({ type, includes_core, categories }) {
    return {
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      session: {
        date: new Date().toISOString().slice(0, 10),
        type,
        includes_core: !!includes_core,
        categories: categories || null,
        body_weight: null,
        notes: '',
      },
      // items: 每個動作一個 entry,含 sets 陣列
      items: [],
    };
  },
};

window.Draft = Draft;
