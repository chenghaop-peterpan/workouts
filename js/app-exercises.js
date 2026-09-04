(async function () {
  const CATS = ['push', 'pull', 'legs', 'core'];
  const groupsEl = document.getElementById('exercise-groups');

  const form = {
    title: document.getElementById('ex-form-title'),
    name: document.getElementById('ex-name'),
    category: document.getElementById('ex-category'),
    sets: document.getElementById('ex-sets'),
    reps: document.getElementById('ex-reps'),
    target: document.getElementById('ex-target'),
    coachTip: document.getElementById('ex-coach-tip'),
    hintUrl: document.getElementById('ex-hint-url'),
    saveBtn: document.getElementById('ex-save'),
    cancelBtn: document.getElementById('ex-cancel'),
  };

  let exercises = [];
  let editingId = null; // null = 新增模式,否則是正在編輯的 exercise_id

  async function load() {
    exercises = await API.getExercises();
    render();
  }

  function genId(name) {
    return 'ex_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function resetForm() {
    editingId = null;
    form.title.textContent = '新增動作';
    form.saveBtn.textContent = '新增動作';
    form.name.value = '';
    form.category.value = 'push';
    form.sets.value = 3;
    form.reps.value = 10;
    form.target.value = '';
    form.coachTip.value = '';
    form.hintUrl.value = '';
  }

  function fillForm(ex) {
    editingId = ex.exercise_id;
    form.title.textContent = `編輯動作:${ex.name}`;
    form.saveBtn.textContent = '儲存修改';
    form.name.value = ex.name || '';
    form.category.value = ex.category || 'push';
    form.sets.value = ex.default_sets || 3;
    form.reps.value = ex.default_reps || 10;
    form.target.value = ex.target || '';
    form.coachTip.value = ex.coach_tip || '';
    form.hintUrl.value = ex.hint_url || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.cancelBtn.onclick = resetForm;

  form.saveBtn.onclick = async () => {
    const name = form.name.value.trim();
    if (!name) { toast('請輸入動作名稱', 'error'); return; }

    const payload = {
      exercise_id: editingId || genId(name),
      name,
      category: form.category.value,
      default_sets: Number(form.sets.value) || 3,
      default_reps: Number(form.reps.value) || 10,
      target: form.target.value.trim(),
      coach_tip: form.coachTip.value.trim(),
      hint_url: form.hintUrl.value.trim(),
    };

    form.saveBtn.disabled = true;
    try {
      if (editingId) {
        await API.updateExercise(payload);
        toast(`已儲存「${name}」`, 'success');
      } else {
        await API.createExercise(payload);
        toast(`已新增「${name}」`, 'success');
      }
      resetForm();
      await load();
    } catch (e) {
      toast('儲存失敗:' + e.message, 'error');
    } finally {
      form.saveBtn.disabled = false;
    }
  };

  function exerciseRow(ex) {
    const row = document.createElement('div');
    row.className = 'menu-item-row';

    const info = document.createElement('div');
    let html = `${ex.name} <span class="dim">${ex.default_sets}×${ex.default_reps}</span>`;
    if (ex.target) html += `<div class="target-chip" style="margin-top:4px; display:inline-block;">${ex.target}</div>`;
    info.innerHTML = html;
    row.appendChild(info);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '4px';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-icon btn-sm';
    editBtn.textContent = '✎';
    editBtn.title = '編輯';
    editBtn.onclick = () => fillForm(ex);
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-icon btn-sm';
    delBtn.textContent = '🗑';
    delBtn.title = '刪除';
    delBtn.onclick = async () => {
      if (!confirm(`確定刪除「${ex.name}」?`)) return;
      try {
        await API.deleteExercise(ex.exercise_id);
        toast(`已刪除「${ex.name}」`, 'success');
        if (editingId === ex.exercise_id) resetForm();
        await load();
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    actions.appendChild(delBtn);

    row.appendChild(actions);
    return row;
  }

  function render() {
    groupsEl.innerHTML = '';
    CATS.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'card';

      const header = document.createElement('div');
      header.className = 'card-header';
      header.innerHTML = `<div class="card-title">${CATEGORY_LABELS[cat]}</div>`;
      card.appendChild(header);

      const inCat = exercises.filter(e => e.category === cat);
      if (inCat.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'dim';
        empty.textContent = '目前沒有動作。';
        card.appendChild(empty);
      } else {
        inCat.forEach(ex => card.appendChild(exerciseRow(ex)));
      }

      groupsEl.appendChild(card);
    });
  }

  function toast(msg, kind = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + kind;
    setTimeout(() => t.className = 'toast', 2500);
  }

  resetForm();
  await load();
})();
