(async function () {
  const CATS = ['push', 'pull', 'legs', 'core'];
  const container = document.getElementById('menu-sections');

  const allExercises = await API.getExercises();
  const byId = Object.fromEntries(allExercises.map(e => [e.exercise_id, e]));

  const state = {}; // cat -> 目前編輯中的清單(尚未存檔),陣列元素 {exercise_id, sets, reps}

  // 一律透過 API.getMenu() 取得目前有效清單(mock 模式會自動套用 TemplateStore override,
  // real 模式直接反映 Google Sheet 目前的 Templates 內容),不再直接讀 MOCK_DATA.templates。
  async function loadCategory(cat) {
    const menu = await API.getMenu(cat);
    state[cat] = menu.map(m => ({ exercise_id: m.exercise_id, sets: m.sets, reps: m.reps }));
  }
  await Promise.all(CATS.map(loadCategory));

  function bustMenuCache(cat) {
    Cache.bust('menu:' + cat);
    if (cat === 'push' || cat === 'legs') Cache.bust('menu:push_legs');
    if (cat === 'pull' || cat === 'legs') Cache.bust('menu:pull_legs');
  }

  function buildAddOptions(cat) {
    const included = new Set(state[cat].map(i => i.exercise_id));
    const groups = {};
    for (const ex of allExercises) {
      if (included.has(ex.exercise_id)) continue;
      const g = CATEGORY_LABELS[ex.category] || ex.category;
      if (!groups[g]) groups[g] = [];
      groups[g].push(ex);
    }
    return Object.keys(groups).map(g =>
      `<optgroup label="${g}">` +
      groups[g].map(ex => `<option value="${ex.exercise_id}">${ex.name}</option>`).join('') +
      `</optgroup>`
    ).join('');
  }

  function itemRow(cat, item, idx) {
    const ex = byId[item.exercise_id] || {};
    const row = document.createElement('div');
    row.className = 'menu-item-row';

    const name = document.createElement('div');
    name.innerHTML = `${ex.name || item.exercise_id} <span class="dim">${item.sets}×${item.reps}</span>`;
    row.appendChild(name);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-icon btn-sm';
    delBtn.textContent = '🗑';
    delBtn.title = '移除';
    delBtn.onclick = () => {
      state[cat].splice(idx, 1);
      render();
    };
    row.appendChild(delBtn);

    return row;
  }

  function sectionCard(cat) {
    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `<div class="card-title">${CATEGORY_LABELS[cat]}</div>`;
    card.appendChild(header);

    if (state[cat].length === 0) {
      const empty = document.createElement('p');
      empty.className = 'dim';
      empty.textContent = '目前沒有動作。';
      card.appendChild(empty);
    } else {
      const list = document.createElement('div');
      state[cat].forEach((item, idx) => list.appendChild(itemRow(cat, item, idx)));
      card.appendChild(list);
    }

    const addRow = document.createElement('div');
    addRow.className = 'btn-row';
    addRow.style.marginTop = '10px';

    const select = document.createElement('select');
    select.className = 'substitute-select menu-add-select';
    select.innerHTML = '<option value="">+ 加入動作庫其他動作 ▾</option>' + buildAddOptions(cat);
    addRow.appendChild(select);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-sm';
    addBtn.textContent = '加入';
    addBtn.onclick = () => {
      if (!select.value) return;
      const ex = byId[select.value];
      if (!ex) return;
      state[cat].push({ exercise_id: ex.exercise_id, sets: ex.default_sets || 3, reps: ex.default_reps || 10 });
      render();
    };
    addRow.appendChild(addBtn);
    card.appendChild(addRow);

    const actions = document.createElement('div');
    actions.className = 'btn-row';
    actions.style.marginTop = '12px';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = '儲存為預設';
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      try {
        if (window.APP_CONFIG.USE_MOCK) {
          TemplateStore.set(cat, state[cat]);
        } else {
          await API.updateTemplate(cat, state[cat]);
        }
        bustMenuCache(cat);
        toast(`已儲存「${CATEGORY_LABELS[cat]}」的預設清單`, 'success');
      } catch (e) {
        toast('儲存失敗:' + e.message, 'error');
      } finally {
        saveBtn.disabled = false;
      }
    };
    actions.appendChild(saveBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-ghost';
    resetBtn.textContent = '還原預設';
    resetBtn.onclick = async () => {
      if (!confirm(`確定把「${CATEGORY_LABELS[cat]}」還原成出廠預設清單?`)) return;
      resetBtn.disabled = true;
      try {
        if (window.APP_CONFIG.USE_MOCK) {
          TemplateStore.reset(cat);
        } else {
          await API.resetTemplate(cat);
        }
        bustMenuCache(cat);
        await loadCategory(cat);
        render();
        toast(`已還原「${CATEGORY_LABELS[cat]}」`, 'success');
      } catch (e) {
        toast('還原失敗:' + e.message, 'error');
        resetBtn.disabled = false;
      }
    };
    actions.appendChild(resetBtn);

    card.appendChild(actions);

    return card;
  }

  function render() {
    container.innerHTML = '';
    CATS.forEach(cat => container.appendChild(sectionCard(cat)));
  }

  function toast(msg, kind = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + kind;
    setTimeout(() => t.className = 'toast', 2500);
  }

  render();
})();
