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
  create({ type, includes_core }) {
    return {
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      session: {
        date: new Date().toISOString().slice(0, 10),
        type,
        includes_core: !!includes_core,
        body_weight: null,
        notes: '',
      },
      // items: 每個動作一個 entry,含 sets 陣列
      items: [],
    };
  },
};

window.Draft = Draft;
