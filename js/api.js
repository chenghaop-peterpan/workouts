// 唯一 IO 層。未來換真 DB 只改這個檔案。
// 有 mock / real 兩種模式,由 window.APP_CONFIG.USE_MOCK 切換。

(function () {
  const cfg = window.APP_CONFIG;

  function getToken() {
    return localStorage.getItem('api_token') || '';
  }

  // ---------- MOCK 實作 ----------
  const mock = {
    async getExercises() {
      const override = window.ExerciseStore ? ExerciseStore.get() : null;
      return structuredClone(override || MOCK_DATA.exercises);
    },
    async createExercise(exercise) {
      const list = await this.getExercises();
      list.push({ default_sets: 3, default_reps: 10, target: '', coach_tip: '', hint_url: '', notes: '', ...exercise });
      ExerciseStore.set(list);
      return { exercise_id: exercise.exercise_id };
    },
    async updateExercise(exercise) {
      const list = await this.getExercises();
      const idx = list.findIndex(e => e.exercise_id === exercise.exercise_id);
      if (idx === -1) throw new Error('exercise not found: ' + exercise.exercise_id);
      list[idx] = { ...list[idx], ...exercise };
      ExerciseStore.set(list);
      return { exercise_id: exercise.exercise_id };
    },
    async deleteExercise(exerciseId) {
      const usedIn = [];
      for (const cat of ['push', 'pull', 'legs', 'core']) {
        const menu = await this.getMenu(cat);
        if (menu.some(m => m.exercise_id === exerciseId)) usedIn.push(cat);
      }
      if (usedIn.length > 0) {
        const labels = usedIn.map(c => CATEGORY_LABELS[c] || c).join('、');
        throw new Error(`此動作正被 ${usedIn.length} 個菜單使用中(${labels}),請先從菜單管理移除後再刪除`);
      }
      const list = (await this.getExercises()).filter(e => e.exercise_id !== exerciseId);
      ExerciseStore.set(list);
      return { exercise_id: exerciseId };
    },
    async getMenu(type) {
      // push_legs/pull_legs 是舊按鈕用的組合,動態組出來,不再各自維護一份重複的腿清單
      if (type === 'push_legs') return [...(await this.getMenu('push')), ...(await this.getMenu('legs'))];
      if (type === 'pull_legs') return [...(await this.getMenu('pull')), ...(await this.getMenu('legs'))];

      const override = window.TemplateStore ? TemplateStore.get(type) : null;
      const tmpl = override || MOCK_DATA.templates[type] || [];
      const exercises = await this.getExercises();
      const byId = Object.fromEntries(exercises.map(e => [e.exercise_id, e]));
      return tmpl.map((t, i) => {
        const ex = byId[t.exercise_id] || {};
        return {
          position: i,
          exercise_id: t.exercise_id,
          exercise_name: ex.name || t.exercise_id,
          category: ex.category || '',
          sets: t.sets,
          reps: t.reps,
          target: ex.target || '',
          coach_tip: ex.coach_tip || '',
          hint_url: ex.hint_url || '',
        };
      });
    },
    async getTodayPlan() {
      return computeTodayPlan(MOCK_DATA.sessions);
    },
    async getLastForExercise(exerciseId) {
      for (const s of MOCK_DATA.sessions) {
        const found = s.sets.filter(x => x.exercise_id === exerciseId);
        if (found.length) return { date: s.date, sets: found };
      }
      return null;
    },
    async getRecentSessions(limit = 10) {
      return structuredClone(MOCK_DATA.sessions.slice(0, limit));
    },
    async submitSession(payload) {
      const sid = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const session = {
        session_id: sid,
        date: payload.session.date,
        type: payload.session.type,
        includes_core: !!payload.session.includes_core,
        body_weight: payload.session.body_weight || null,
        notes: payload.session.notes || '',
        sets: payload.sets.map((s, i) => ({ log_id: `${sid}_${i}`, ...s })),
      };
      MOCK_DATA.sessions.unshift(session);
      return { session_id: sid, set_count: payload.sets.length };
    },
  };

  // ---------- REAL 實作(Apps Script Web App)----------
  const real = {
    async _get(action, params = {}) {
      const url = new URL(cfg.WEB_APP_URL);
      url.searchParams.set('action', action);
      url.searchParams.set('token', getToken());
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      const res = await fetch(url.toString());
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'API error');
      return body.data;
    },
    async _post(action, payload) {
      // Apps Script 限制:用 text/plain 才不會觸發 CORS preflight
      const res = await fetch(cfg.WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token: getToken(), ...payload }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || 'API error');
      return body.data;
    },
    getExercises()                 { return this._get('getExercises'); },
    getMenu(type)                  { return this._get('getMenu', { type }); },
    getTodayPlan()                 { return this._get('getTodayPlan'); },
    getLastForExercise(exerciseId) { return this._get('getLastForExercise', { exercise_id: exerciseId }); },
    getRecentSessions(limit = 10)  { return this._get('getRecentSessions', { limit }); },
    submitSession(payload)         { return this._post('submitSession', payload); },
    updateTemplate(category, items) { return this._post('updateTemplate', { category, items }); },
    resetTemplate(category)         { return this._post('resetTemplate', { category }); },
    createExercise(exercise)        { return this._post('createExercise', { exercise }); },
    updateExercise(exercise)        { return this._post('updateExercise', { exercise }); },
    deleteExercise(exerciseId)      { return this._post('deleteExercise', { exercise_id: exerciseId }); },
  };

  window.API = cfg.USE_MOCK ? mock : real;
})();
