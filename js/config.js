// 部署後把 Apps Script Web App URL 貼在這
window.APP_CONFIG = {
  WEB_APP_URL: '',
  USE_MOCK: true,
  CORE_INTERVAL_DAYS: 3,
  DEFAULT_REST_SEC: 120,   // 預設組間休息秒數
  WEIGHT_JUMP_RATIO: 1.25, // 新重量 > 上次 × 此比例 → 顯示預警
};
