// SWR 快取層。呼叫端顯式使用,api.js 保持純 IO。
// Key 帶版本前綴,未來 schema 變動可整批 bust。

window.Cache = (function () {
  const PREFIX = 'cache:v1:';
  const k = (key) => PREFIX + key;

  function get(key) {
    try {
      const raw = localStorage.getItem(k(key));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function set(key, value) {
    try { localStorage.setItem(k(key), JSON.stringify(value)); } catch {}
  }

  function bust(key) {
    localStorage.removeItem(k(key));
  }

  function bustAll() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  }

  // 回傳 { cached, promise }:呼叫端自行決定如何 render
  // - cached 可能是 null
  // - promise 一定會執行 fetch,結果自動寫回 cache
  function swr(key, fetcher) {
    const cached = get(key);
    const promise = Promise.resolve()
      .then(() => fetcher())
      .then((fresh) => { set(key, fresh); return fresh; });
    return { cached, promise };
  }

  return { get, set, bust, bustAll, swr };
})();
