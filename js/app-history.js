(async function () {
  const list = document.getElementById('list');

  function renderList(sessions) {
    if (!sessions.length) {
      list.innerHTML = '<p class="dim">還沒有任何訓練紀錄。</p>';
      return;
    }
    list.innerHTML = '';
    sessions.forEach(s => list.appendChild(sessionCard(s)));
  }

  const { cached, promise } = Cache.swr('recent:20', () => API.getRecentSessions(20));
  if (cached) renderList(cached);
  promise.then((fresh) => {
    if (JSON.stringify(fresh) === JSON.stringify(cached)) return;
    renderList(fresh);
  }).catch((e) => {
    if (!cached) list.innerHTML = `<p class="text-danger">讀取失敗:${e.message}</p>`;
  });

  function sessionCard(s) {
    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
      <div>
        <div class="card-title">${s.date} · ${typeLabel(s.type)}${s.includes_core ? ' (含核心)' : ''}</div>
        <div class="dim">${(s.sets || []).length} 組${s.body_weight ? ' · 體重 ' + s.body_weight + ' kg' : ''}</div>
      </div>
      <button class="btn btn-sm btn-ghost" data-toggle>展開</button>
    `;
    card.appendChild(header);

    const detail = document.createElement('div');
    detail.className = 'hidden';
    detail.style.marginTop = '8px';

    // Group sets by exercise
    const byExercise = {};
    (s.sets || []).forEach(x => {
      const key = x.exercise_id;
      if (!byExercise[key]) byExercise[key] = { name: x.exercise_name, rows: [] };
      byExercise[key].rows.push(x);
    });

    for (const key in byExercise) {
      const g = byExercise[key];
      const gDiv = document.createElement('div');
      gDiv.style.padding = '6px 0';
      gDiv.style.borderTop = '1px solid var(--border)';
      gDiv.innerHTML = `<div style="font-weight:600">${g.name}</div>` +
        g.rows.map(r =>
          `<div class="dim">組 ${r.set_num}: ${r.weight}kg × ${r.reps}${r.rpe ? ' · RIR ' + r.rpe : ''}${r.rest_sec ? ' · 休 ' + r.rest_sec + 's' : ''}</div>`
        ).join('');
      detail.appendChild(gDiv);
    }
    if (s.notes) {
      const n = document.createElement('div');
      n.className = 'dim';
      n.style.marginTop = '6px';
      n.textContent = '備註:' + s.notes;
      detail.appendChild(n);
    }

    card.appendChild(detail);
    header.querySelector('[data-toggle]').onclick = (e) => {
      detail.classList.toggle('hidden');
      e.target.textContent = detail.classList.contains('hidden') ? '展開' : '收起';
    };

    return card;
  }
})();
