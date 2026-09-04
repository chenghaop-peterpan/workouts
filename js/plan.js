// 今日建議推導 — 給 mock/fallback 使用。
// Real 模式時後端會直接算好回傳,前端不會呼叫這裡。

function computeTodayPlan(sessions) {
  const today = new Date();
  const intervalDays = window.APP_CONFIG.CORE_INTERVAL_DAYS || 3;

  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));

  let type = 'push_legs';
  // 認新舊兩種類型:push / push_legs / pull / pull_legs
  const lastMain = sorted.find(s => s.type && (s.type.startsWith('push') || s.type.startsWith('pull')));
  if (lastMain) type = lastMain.type.startsWith('push') ? 'pull_legs' : 'push_legs';

  let includes_core = true;
  let coreReason = '尚無核心紀錄,建議今天做';
  const lastCore = sorted.find(s => s.includes_core || s.type === 'core');
  if (lastCore) {
    const days = daysBetween(lastCore.date, today);
    if (days >= intervalDays) {
      includes_core = true;
      coreReason = `距上次核心已 ${days} 天`;
    } else {
      includes_core = false;
      coreReason = `距上次核心 ${days} 天,尚未到 ${intervalDays} 天`;
    }
  }

  return {
    type,
    includes_core,
    reason: `上次是 ${lastMain ? typeLabel(lastMain.type) : '無紀錄'}${lastMain ? '(' + lastMain.date + ')' : ''};${coreReason}`,
  };
}

function daysBetween(dateStr, today) {
  const d1 = new Date(dateStr + 'T00:00:00');
  const d2 = new Date(today.toISOString().slice(0, 10) + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000);
}

const LEGACY_TYPE_LABELS = {
  push_legs: '推 + 腿',
  pull_legs: '拉 + 腿',
  core: '核心',
  push: '推 (legacy)',
  pull: '拉 (legacy)',
};

const CATEGORY_LABELS = { push: '推', pull: '拉', legs: '腿', core: '核心' };

function typeLabel(t) {
  if (LEGACY_TYPE_LABELS[t]) return LEGACY_TYPE_LABELS[t];
  // 複合 type(自由勾選部位產生),逗號分隔的 category 清單,如 "push,legs,core"
  if (t && t.includes(',')) {
    return t.split(',').map(c => CATEGORY_LABELS[c] || c).join(' + ');
  }
  return t;
}

window.typeLabel = typeLabel;
window.computeTodayPlan = computeTodayPlan;
