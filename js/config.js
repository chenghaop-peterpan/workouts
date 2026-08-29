// 部署後把 Apps Script Web App URL 貼在這
window.APP_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbznwBKjpr5CT5cw3wGL7Xxj0bqZK_MYiMpXZoB9IL___jt1vFiDlB3mw3BX_VVqzD8GGA/exec',
  USE_MOCK: false,
  CORE_INTERVAL_DAYS: 3,
  DEFAULT_REST_SEC: 120,   // 預設組間休息秒數
  WEIGHT_JUMP_RATIO: 1.25, // 新重量 > 上次 × 此比例 → 顯示預警
};
