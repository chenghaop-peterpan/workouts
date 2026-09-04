// 菜單管理的本機覆寫層(localStorage)。只認 4 個純 category:push/pull/legs/core。
// 有 override 時蓋掉 mock-data.js 內建的預設清單;save 前完全不影響任何地方。

const TEMPLATE_OVERRIDE_PREFIX = 'template_override:';

const TemplateStore = {
  get(category) {
    try {
      const raw = localStorage.getItem(TEMPLATE_OVERRIDE_PREFIX + category);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  set(category, items) {
    localStorage.setItem(TEMPLATE_OVERRIDE_PREFIX + category, JSON.stringify(items));
  },

  reset(category) {
    localStorage.removeItem(TEMPLATE_OVERRIDE_PREFIX + category);
  },
};

window.TemplateStore = TemplateStore;
