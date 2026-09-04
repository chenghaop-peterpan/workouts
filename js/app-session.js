(async function () {
  let draft = Draft.load();
  if (!draft) {
    alert('沒有進行中的訓練,回首頁選擇日子類型');
    location.href = 'index.html';
    return;
  }

  const cfg = window.APP_CONFIG;

  // === Header meta (draft 就有,不用等 API) ===
  document.getElementById('session-meta-title').textContent =
    typeLabel(draft.session.type) + (draft.session.includes_core ? ' (含核心)' : '');
  document.getElementById('session-meta-sub').textContent =
    `${draft.session.date} · 開始於 ${new Date(draft.started_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
  document.getElementById('body-weight').value = draft.session.body_weight ?? '';
  document.getElementById('session-notes').value = draft.session.notes ?? '';
  document.getElementById('body-weight').addEventListener('input', (e) => {
    draft.session.body_weight = e.target.value ? Number(e.target.value) : null;
    Draft.save(draft);
  });
  document.getElementById('session-notes').addEventListener('input', (e) => {
    draft.session.notes = e.target.value;
    Draft.save(draft);
  });

  // === 資料層(SWR) ===
  // allExercises / byId / prMap / lastMaxWeight 都會被 SWR fresh 覆寫,
  // renderItems 讀的是當下值,fresh 到後 re-render 就會反映新資料。
  let allExercises = [];
  const byId = {};
  const prMap = {};
  const lastMaxWeight = {};

  function rebuildById() {
    for (const key in byId) delete byId[key];
    for (const e of allExercises) byId[e.exercise_id] = e;
  }

  function rebuildPRAndLastMax(recent) {
    for (const key in prMap) delete prMap[key];
    for (const key in lastMaxWeight) delete lastMaxWeight[key];
    const sorted = [...recent].sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const s of sorted) {
      for (const st of s.sets) {
        const id = st.exercise_id;
        const w = Number(st.weight) || 0;
        const r = Number(st.reps) || 0;
        if (!prMap[id]) prMap[id] = { max_weight: 0, max_reps: 0 };
        if (w > prMap[id].max_weight) prMap[id].max_weight = w;
        if (r > prMap[id].max_reps) prMap[id].max_reps = r;
      }
      const seen = new Set();
      for (const st of s.sets) {
        const id = st.exercise_id;
        if (seen.has(id) || id in lastMaxWeight) continue;
        seen.add(id);
        const inSession = s.sets.filter(x => x.exercise_id === id);
        lastMaxWeight[id] = Math.max(...inSession.map(x => Number(x.weight) || 0));
      }
    }
  }

  // Exercises SWR
  const exSWR = Cache.swr('exercises', () => API.getExercises());
  if (exSWR.cached) { allExercises = exSWR.cached; rebuildById(); }
  exSWR.promise.then((fresh) => {
    if (JSON.stringify(fresh) === JSON.stringify(allExercises)) return;
    allExercises = fresh;
    rebuildById();
    if (draft.items.length > 0) renderItems();
  }).catch((e) => {
    if (!exSWR.cached) toast('讀取動作字典失敗:' + e.message, 'error');
  });

  // Recent SWR (供 PR + 爆增預警)
  const recentSWR = Cache.swr('recent:100', () => API.getRecentSessions(100));
  if (recentSWR.cached) rebuildPRAndLastMax(recentSWR.cached);
  recentSWR.promise.then((fresh) => {
    if (JSON.stringify(fresh) === JSON.stringify(recentSWR.cached)) return;
    rebuildPRAndLastMax(fresh);
    if (draft.items.length > 0) renderItems();
  }).catch(() => { /* silent */ });

  // === Menu / draft.items 初始化 ===
  if (draft.items.length > 0) {
    // 已有 draft.items:立刻 render(即使 byId/prMap 還空,fresh 到會 re-render)
    renderItems();
  } else {
    // categories:自由勾選部位時直接存在 session 上;3 顆舊按鈕沒有 categories,
    // 從 legacy type 相容推導(push_legs → ['push','legs'] 等,逗號分隔 type 直接切開)。
    const categories = draft.session.categories || legacyTypeToCategories(draft.session.type);
    const menuSWRs = categories.map(cat => Cache.swr('menu:' + cat, () => API.getMenu(cat)));

    if (menuSWRs.every(swr => swr.cached)) {
      // Cache 齊全:立刻用 cache 建 draft.items
      draft.items = buildItemsFromMenus(menuSWRs.map(swr => swr.cached));
      Draft.save(draft);
      renderItems();
    } else {
      // Cache 不完整:顯示載入中
      document.getElementById('items-container').innerHTML =
        '<div class="banner">載入菜單中…</div>';
    }

    // 等 fresh 完成:只有在 cache 沒東西(draft.items 還空)時才用 fresh 建 items,
    // 已有 draft.items 就不覆蓋(可能使用者已改動),fresh 只留在 cache 供下次。
    Promise.all(menuSWRs.map(swr => swr.promise)).then((results) => {
      if (draft.items.length > 0) return;
      draft.items = buildItemsFromMenus(results);
      Draft.save(draft);
      renderItems();
    }).catch((e) => {
      if (draft.items.length === 0) {
        toast('讀取菜單失敗:' + e.message, 'error');
        document.getElementById('items-container').innerHTML =
          `<div class="banner banner-warn">無法載入菜單:${e.message}</div>`;
      }
    });
  }

  document.getElementById('add-custom').onclick = onAddCustom;
  document.getElementById('discard-btn').onclick = onDiscard;
  document.getElementById('submit-btn').onclick = onSubmit;

  // 30 秒 autosave 心跳
  setInterval(() => { if (draft) Draft.save(draft); }, 30000);

  // ============================================================

  // legacy 3 按鈕的固定 type → category 陣列,供沒有 draft.session.categories 的舊草稿相容
  function legacyTypeToCategories(type) {
    if (type === 'push_legs') return ['push_legs'];
    if (type === 'pull_legs') return ['pull_legs'];
    if (type === 'core') return ['core'];
    return type.split(',');
  }

  function buildItemsFromMenus(menus) {
    const items = [];
    for (const menu of menus) for (const m of menu) items.push(menuItemToDraftItem(m));
    return items;
  }

  function menuItemToDraftItem(m) {
    const sets = [];
    for (let i = 0; i < (m.sets || 3); i++) {
      sets.push({ weight: '', reps: m.reps || '', rpe: '', rest_sec: '', note: '', done: false });
    }
    return {
      exercise_id: m.exercise_id,
      exercise_name: m.exercise_name,
      category: m.category,
      is_substitute: false,
      target: m.target || '',
      coach_tip: m.coach_tip || '',
      hint_url: m.hint_url || '',
      sets,
    };
  }

  function renderItems() {
    const container = document.getElementById('items-container');
    container.innerHTML = '';
    draft.items.forEach((item, idx) => container.appendChild(itemCard(item, idx)));
    draft.items.forEach((item, idx) => loadLastHint(item, idx));
  }

  function itemCard(item, idx) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.idx = idx;

    const header = document.createElement('div');
    header.className = 'card-header';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.exercise_name + (item.is_substitute ? ' (替代)' : '');

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const isCustom = item.exercise_id.startsWith('custom:');
    if (!isCustom) {
      const sel = document.createElement('select');
      sel.className = 'substitute-select';
      sel.innerHTML = '<option value="">替代 ▾</option>' +
        allExercises
          .filter(e => e.category === item.category && e.exercise_id !== item.exercise_id)
          .map(e => `<option value="${e.exercise_id}">${e.name}</option>`)
          .join('');
      sel.onchange = () => {
        const newEx = byId[sel.value];
        if (!newEx) return;
        item.exercise_id = newEx.exercise_id;
        item.exercise_name = newEx.name;
        item.is_substitute = true;
        Draft.save(draft);
        renderItems();
      };
      actions.appendChild(sel);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-icon btn-sm';
    delBtn.textContent = '🗑';
    delBtn.title = '移除此動作';
    delBtn.onclick = () => {
      if (confirm(`移除「${item.exercise_name}」?`)) {
        draft.items.splice(idx, 1);
        Draft.save(draft);
        renderItems();
      }
    };
    actions.appendChild(delBtn);

    header.appendChild(title);
    header.appendChild(actions);
    card.appendChild(header);

    // Target 強度 + 示範連結
    if (item.target || item.hint_url) {
      const meta = document.createElement('div');
      meta.className = 'exercise-meta';
      if (item.target) {
        const t = document.createElement('span');
        t.className = 'target-chip';
        t.textContent = item.target;
        meta.appendChild(t);
      }
      if (item.hint_url) {
        const a = document.createElement('a');
        a.href = item.hint_url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'hint-link';
        a.textContent = '示範 ↗';
        meta.appendChild(a);
      }
      card.appendChild(meta);
    }

    if (item.coach_tip) {
      const tip = document.createElement('div');
      tip.className = 'coach-tip';
      tip.textContent = '💡 ' + item.coach_tip;
      card.appendChild(tip);
    }

    const hint = document.createElement('div');
    hint.className = 'last-hint';
    hint.dataset.hint = 'true';
    hint.textContent = '上次:—';
    card.appendChild(hint);

    // Set rows
    const setsWrap = document.createElement('div');
    item.sets.forEach((s, si) => setsWrap.appendChild(setItem(item, idx, si)));
    card.appendChild(setsWrap);

    // Add set button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-sm';
    addBtn.textContent = '+ 加一組';
    addBtn.onclick = () => {
      const last = item.sets[item.sets.length - 1];
      item.sets.push({
        weight: last?.weight ?? '',
        reps: last?.reps ?? '',
        rpe: '',
        rest_sec: '',
        note: '',
        done: false,
      });
      Draft.save(draft);
      renderItems();
    };
    card.appendChild(addBtn);

    return card;
  }

  function setItem(item, idx, si) {
    const wrap = document.createElement('div');
    wrap.className = 'set-item' + (item.sets[si].done ? ' done' : '');
    wrap.dataset.idx = idx;
    wrap.dataset.si = si;

    const row = document.createElement('div');
    row.className = 'set-row';

    // 組號 + PR 星星
    const label = document.createElement('div');
    label.className = 'set-label';
    const labelText = document.createElement('span');
    labelText.textContent = si + 1;
    label.appendChild(labelText);
    const star = document.createElement('span');
    star.className = 'pr-star hidden';
    star.textContent = '⭐';
    star.title = 'PR!';
    label.appendChild(star);
    row.appendChild(label);

    // Weight
    const wIn = document.createElement('input');
    wIn.type = 'number';
    wIn.inputMode = 'decimal';
    wIn.step = '0.5';
    wIn.placeholder = 'kg';
    wIn.value = item.sets[si].weight;
    wIn.oninput = () => {
      item.sets[si].weight = wIn.value;
      Draft.save(draft);
      updatePRAndWarn(item, si, wrap);
    };
    row.appendChild(wIn);

    // Reps
    const rIn = document.createElement('input');
    rIn.type = 'number';
    rIn.inputMode = 'numeric';
    rIn.placeholder = 'reps';
    rIn.value = item.sets[si].reps;
    rIn.oninput = () => {
      item.sets[si].reps = rIn.value;
      Draft.save(draft);
      updatePRAndWarn(item, si, wrap);
    };
    row.appendChild(rIn);

    // RIR (資料欄位仍叫 rpe,不改 schema)
    const rpe = document.createElement('input');
    rpe.type = 'number';
    rpe.inputMode = 'decimal';
    rpe.step = '0.5';
    rpe.min = '0'; rpe.max = '10';
    rpe.placeholder = 'RIR';
    rpe.value = item.sets[si].rpe;
    rpe.oninput = () => { item.sets[si].rpe = rpe.value; Draft.save(draft); };
    row.appendChild(rpe);

    // 休息秒(直接放在 row 內,和 kg/reps/RIR 同一列)
    const restIn = document.createElement('input');
    restIn.type = 'number';
    restIn.inputMode = 'numeric';
    restIn.className = 'set-rest';
    restIn.placeholder = 'rest';
    restIn.title = 'rest (seconds)';
    restIn.value = item.sets[si].rest_sec || '';
    restIn.oninput = () => {
      item.sets[si].rest_sec = restIn.value;
      Draft.save(draft);
    };
    row.appendChild(restIn);

    // Actions:[✓][📝][🗑]
    const acts = document.createElement('div');
    acts.className = 'set-actions';

    const check = document.createElement('button');
    check.className = 'btn btn-icon btn-check' + (item.sets[si].done ? ' done' : '');
    check.textContent = item.sets[si].done ? '✅' : '⭕';
    check.title = '完成此組並開始休息計時';
    check.onclick = () => {
      const wasDone = item.sets[si].done;
      item.sets[si].done = !wasDone;
      Draft.save(draft);
      wrap.classList.toggle('done', !wasDone);
      check.textContent = !wasDone ? '✅' : '⭕';
      check.classList.toggle('done', !wasDone);
      if (!wasDone) focusNextSet(idx, si);
    };
    acts.appendChild(check);

    const noteBtn = document.createElement('button');
    noteBtn.className = 'btn btn-icon btn-note' + (item.sets[si].note ? ' has-note' : '');
    noteBtn.textContent = '📝';
    noteBtn.title = '這組備註';
    noteBtn.onclick = () => {
      const noteInput = wrap.querySelector('.set-note');
      const hidden = noteInput.classList.contains('hidden');
      noteInput.classList.toggle('hidden', !hidden);
      if (hidden) noteInput.focus();
    };
    acts.appendChild(noteBtn);

    const del = document.createElement('button');
    del.className = 'btn btn-icon btn-delete';
    del.textContent = '✕';
    del.title = '刪除此組';
    del.onclick = () => {
      item.sets.splice(si, 1);
      Draft.save(draft);
      renderItems();
    };
    acts.appendChild(del);

    row.appendChild(acts);
    wrap.appendChild(row);

    // 爆增預警(weight jump warning)
    const warn = document.createElement('div');
    warn.className = 'weight-warn hidden';
    warn.dataset.warn = 'true';
    wrap.appendChild(warn);

    // 備註輸入(預設隱藏,有內容則顯示)
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'set-note' + (item.sets[si].note ? '' : ' hidden');
    noteInput.placeholder = '這組備註(例:握不住、換窄握)';
    noteInput.value = item.sets[si].note || '';
    noteInput.oninput = () => {
      item.sets[si].note = noteInput.value;
      Draft.save(draft);
      noteBtn.classList.toggle('has-note', !!noteInput.value);
    };
    wrap.appendChild(noteInput);

    // 初次渲染就套用 PR 判斷
    setTimeout(() => updatePRAndWarn(item, si, wrap), 0);

    return wrap;
  }

  function updatePRAndWarn(item, si, wrap) {
    const s = item.sets[si];
    const w = Number(s.weight) || 0;
    const r = Number(s.reps) || 0;
    const pr = prMap[item.exercise_id];
    const star = wrap.querySelector('.pr-star');
    // PR 定義:weight 嚴格超越歷史最大 且 reps > 0(避免只填 weight 就閃 PR)
    const isPR = pr && w > 0 && r > 0 && w > pr.max_weight;
    if (star) star.classList.toggle('hidden', !isPR);

    // Weight jump warning
    const warn = wrap.querySelector('[data-warn]');
    const last = lastMaxWeight[item.exercise_id];
    if (warn && last && w > last * cfg.WEIGHT_JUMP_RATIO) {
      const pct = Math.round((w / last - 1) * 100);
      warn.textContent = `⚠ 比上次最大 ${last} kg 高 ${pct}%,確定?`;
      warn.classList.remove('hidden');
    } else if (warn) {
      warn.classList.add('hidden');
    }
  }

  function focusNextSet(itemIdx, si) {
    const nextInSame = document.querySelector(
      `.set-item[data-idx="${itemIdx}"][data-si="${si + 1}"] input`
    );
    if (nextInSame) { nextInSame.focus(); return; }
    // 該動作最後一組:跳到下一個動作的第一組
    const nextItem = document.querySelector(
      `.set-item[data-idx="${itemIdx + 1}"][data-si="0"] input`
    );
    if (nextItem) nextItem.focus();
  }

  async function loadLastHint(item, idx) {
    if (item.exercise_id.startsWith('custom:')) return;
    try {
      const last = await API.getLastForExercise(item.exercise_id);
      if (!last) return;
      const card = document.querySelector(`.card[data-idx="${idx}"]`);
      if (!card) return;
      const hint = card.querySelector('[data-hint]');
      if (!hint) return;
      const summary = last.sets.map(s => `${s.weight}kg × ${s.reps}`).join(', ');
      hint.textContent = `上次 (${last.date}):${summary}`;
    } catch { /* silent */ }
  }

  function onAddCustom() {
    const name = prompt('自訂動作名稱?');
    if (!name || !name.trim()) return;
    const slug = 'custom:' + name.trim().toLowerCase().replace(/\s+/g, '_');
    draft.items.push({
      exercise_id: slug,
      exercise_name: name.trim(),
      category: 'custom',
      is_substitute: true,
      sets: [{ weight: '', reps: '', rpe: '', rest_sec: '', note: '', done: false }],
    });
    Draft.save(draft);
    renderItems();
  }

  function onDiscard() {
    if (!confirm('確定丟棄這場訓練?已輸入的資料會遺失。')) return;
    Draft.clear();
    location.href = 'index.html';
  }

  async function onSubmit() {
    const sets = [];
    for (const item of draft.items) {
      item.sets.forEach((s, i) => {
        if (s.weight === '' && s.reps === '') return;
        sets.push({
          exercise_id: item.exercise_id,
          exercise_name: item.exercise_name,
          set_num: i + 1,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          rpe: s.rpe === '' ? null : Number(s.rpe),
          rest_sec: s.rest_sec === '' || s.rest_sec == null ? null : Number(s.rest_sec),
          note: s.note || '',
          is_substitute: !!item.is_substitute,
        });
      });
    }
    if (sets.length === 0) {
      toast('尚未輸入任何組數', 'error');
      return;
    }
    const payload = { session: draft.session, sets };
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '送出中…';
    try {
      const res = await API.submitSession(payload);
      // 送出後主動 bust 會受影響的 cache,下一頁進去就是最新
      Cache.bust('recent:100');
      Cache.bust('recent:20');
      Cache.bust('today_plan');
      Draft.clear();
      toast(`已送出 (${res.set_count} 組)`, 'success');
      setTimeout(() => location.href = 'history.html', 800);
    } catch (e) {
      toast('送出失敗:' + e.message + ' (草稿保留)', 'error');
      btn.disabled = false;
      btn.textContent = '完成訓練 → 送出';
    }
  }

  function toast(msg, kind = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + kind;
    setTimeout(() => t.className = 'toast', 2500);
  }

})();
