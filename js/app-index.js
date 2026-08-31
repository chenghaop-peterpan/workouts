(async function () {
  // 1. Draft banner
  const draft = Draft.load();
  if (draft) {
    document.getElementById('draft-banner').classList.remove('hidden');
    const detail = `${draft.session.date} · ${typeLabel(draft.session.type)}` +
      (draft.session.includes_core ? ' (含核心)' : '') +
      ` · ${draft.items.length} 個動作`;
    document.getElementById('draft-banner-detail').textContent = detail;
    document.getElementById('draft-discard').onclick = () => {
      if (confirm('確定丟棄未完成的草稿?')) {
        Draft.clear();
        location.reload();
      }
    };
  }

  // 2. Today's suggestion (SWR)
  let plan = { type: 'push_legs', includes_core: true, reason: '載入建議中…' };

  function renderSuggestion() {
    const label = typeLabel(plan.type) + (plan.includes_core ? ' (加核心)' : '');
    document.getElementById('suggestion').innerHTML =
      `今日建議:<strong>${label}</strong><div class="dim">${plan.reason}</div>`;
    document.querySelectorAll('.day-btn').forEach(btn => {
      btn.classList.toggle('recommended', btn.dataset.type === plan.type);
    });
  }

  const { cached, promise } = Cache.swr('today_plan', () => API.getTodayPlan());
  if (cached) plan = cached;
  renderSuggestion();
  promise.then((fresh) => {
    if (JSON.stringify(fresh) === JSON.stringify(plan)) return;
    plan = fresh;
    renderSuggestion();
  }).catch(() => {
    if (!cached) {
      plan = { type: 'push_legs', includes_core: true, reason: '無法讀取建議,顯示預設' };
      renderSuggestion();
    }
  });

  // 3. Day-type click → create draft + go to session
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.type;
      // 若已有草稿且類型不同,確認要覆蓋
      if (draft && draft.session.type !== type) {
        if (!confirm(`已有 ${typeLabel(draft.session.type)} 的草稿,要放棄並開始 ${typeLabel(type)}?`)) {
          return;
        }
        Draft.clear();
      }
      if (!Draft.exists()) {
        // 若使用者選的類型跟建議相同,套用「今日是否加核心」
        const includes_core = (type === plan.type) ? plan.includes_core : (type === 'core');
        const fresh = Draft.create({ type, includes_core });
        Draft.save(fresh);
      }
      location.href = 'session.html';
    };
  });
})();
