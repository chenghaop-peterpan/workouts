/**
 * 健身記錄後端 (Apps Script Web App)
 *
 * 部署:Deploy → New deployment → Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * 前端呼叫 (js/api.js):
 *   GET  ?action=xxx&token=...&<params>
 *   POST body 為 JSON 字串,Content-Type: text/plain (避開 CORS preflight)
 *
 * 回傳統一格式:
 *   { ok: true,  data: ... }
 *   { ok: false, error: '...' }
 */

const TZ = 'Asia/Taipei';

// ============================================================
// Router
// ============================================================
function doGet(e)  { return handle_('GET',  e); }
function doPost(e) { return handle_('POST', e); }

function handle_(method, e) {
  try {
    let body = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); }
      catch (_) { return err_('invalid JSON body'); }
    }
    const action = (e.parameter && e.parameter.action) || body.action;
    if (!action) return err_('missing action');

    const token = (e.parameter && e.parameter.token) || body.token;
    if (!verifyToken_(token)) return err_('unauthorized');

    switch (action) {
      case 'getExercises':        return jsonOut_(getExercises_());
      case 'getMenu':             return jsonOut_(getMenu_(e.parameter.type));
      case 'getTodayPlan':        return jsonOut_(getTodayPlan_());
      case 'getLastForExercise':  return jsonOut_(getLastForExercise_(e.parameter.exercise_id));
      case 'getRecentSessions':   return jsonOut_(getRecentSessions_(Number(e.parameter.limit) || 10));
      case 'submitSession':       return jsonOut_(submitSession_(body));
      default: return err_('unknown action: ' + action);
    }
  } catch (ex) {
    return err_(ex.message || String(ex));
  }
}

function jsonOut_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function err_(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Sheet helpers
// ============================================================
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function getSheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('sheet not found: ' + name);
  return sh;
}

/** 把整張表讀成物件陣列(首列當 key)。空 row 會被略過。 */
function readTable_(name) {
  const sh = getSheet_(name);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.every(function (v) { return v === '' || v == null; })) continue;
    const o = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) o[headers[j]] = row[j];
    }
    out.push(o);
  }
  return out;
}

function appendRow_(name, obj) {
  const sh = getSheet_(name);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
}

// ============================================================
// Auth
// ============================================================
function verifyToken_(token) {
  if (!token) return false;
  const cfg = readTable_('Config');
  for (let i = 0; i < cfg.length; i++) {
    if (cfg[i].key === 'api_token' && String(cfg[i].value) === String(token)) return true;
  }
  return false;
}

function getConfig_(key) {
  const cfg = readTable_('Config');
  for (let i = 0; i < cfg.length; i++) {
    if (cfg[i].key === key) return cfg[i].value;
  }
  return null;
}

// ============================================================
// Read actions
// ============================================================
function getExercises_() {
  return readTable_('Exercises');
}

function getMenu_(type) {
  if (!type) throw new Error('missing type');
  const tmpl = readTable_('Templates')
    .filter(function (t) { return String(t.template_type) === String(type); })
    .sort(function (a, b) { return (Number(a.position) || 0) - (Number(b.position) || 0); });
  const exs = readTable_('Exercises');
  const byId = {};
  exs.forEach(function (e) { byId[e.exercise_id] = e; });
  return tmpl.map(function (t, i) {
    const ex = byId[t.exercise_id] || {};
    return {
      position: Number(t.position) || i,
      exercise_id: t.exercise_id,
      exercise_name: ex.name || t.exercise_id,
      category: ex.category || '',
      sets: Number(t.sets) || 3,
      reps: t.reps === '' ? null : Number(t.reps),
      target: ex.target || '',
      coach_tip: ex.coach_tip || '',
      hint_url: ex.hint_url || '',
    };
  });
}

function getTodayPlan_() {
  const sessions = readTable_('Sessions').filter(function (s) { return s.date; });
  const intervalDays = Number(getConfig_('core_interval_days')) || 3;
  const today = new Date();

  const sorted = sessions.map(function (s) {
    return Object.assign({}, s, { dateStr: formatDate_(s.date) });
  }).sort(function (a, b) { return a.dateStr < b.dateStr ? 1 : -1; });

  let type = 'push_legs';
  const lastMain = sorted.find(function (s) {
    return s.type && (String(s.type).indexOf('push') === 0 || String(s.type).indexOf('pull') === 0);
  });
  if (lastMain) type = String(lastMain.type).indexOf('push') === 0 ? 'pull_legs' : 'push_legs';

  let includes_core = true;
  let coreReason = '尚無核心紀錄,建議今天做';
  const lastCore = sorted.find(function (s) {
    return s.includes_core === true || String(s.includes_core).toUpperCase() === 'TRUE' || s.type === 'core';
  });
  if (lastCore) {
    const days = daysBetween_(lastCore.dateStr, today);
    if (days >= intervalDays) {
      includes_core = true;
      coreReason = '距上次核心已 ' + days + ' 天';
    } else {
      includes_core = false;
      coreReason = '距上次核心 ' + days + ' 天,尚未到 ' + intervalDays + ' 天';
    }
  }

  return {
    type: type,
    includes_core: includes_core,
    reason: '上次是 ' + (lastMain ? typeLabel_(lastMain.type) : '無紀錄') +
            (lastMain ? '(' + lastMain.dateStr + ')' : '') + ';' + coreReason,
  };
}

function typeLabel_(t) {
  const map = {
    push_legs: '推 + 腿',
    pull_legs: '拉 + 腿',
    core: '核心',
    push: '推 (legacy)',
    pull: '拉 (legacy)',
  };
  return map[t] || t;
}

function getLastForExercise_(exerciseId) {
  if (!exerciseId) throw new Error('missing exercise_id');
  const sessions = readTable_('Sessions');
  const allSets = readTable_('SetLogs').filter(function (s) { return s.exercise_id === exerciseId; });
  if (allSets.length === 0) return null;

  const bySession = {};
  allSets.forEach(function (s) {
    if (!bySession[s.session_id]) bySession[s.session_id] = [];
    bySession[s.session_id].push(s);
  });

  const sessMap = {};
  sessions.forEach(function (s) { sessMap[s.session_id] = s; });

  const candidates = Object.keys(bySession)
    .map(function (sid) { return { sid: sid, session: sessMap[sid] }; })
    .filter(function (c) { return c.session; })
    .sort(function (a, b) {
      return formatDate_(a.session.date) < formatDate_(b.session.date) ? 1 : -1;
    });

  if (candidates.length === 0) return null;
  const pick = candidates[0];
  return {
    date: formatDate_(pick.session.date),
    sets: bySession[pick.sid].sort(function (a, b) {
      return (Number(a.set_num) || 0) - (Number(b.set_num) || 0);
    }),
  };
}

function getRecentSessions_(limit) {
  const sessions = readTable_('Sessions').filter(function (s) { return s.session_id; });
  const setLogs = readTable_('SetLogs');
  const bySession = {};
  setLogs.forEach(function (s) {
    if (!bySession[s.session_id]) bySession[s.session_id] = [];
    bySession[s.session_id].push(s);
  });

  return sessions
    .map(function (s) {
      return Object.assign({}, s, {
        date: formatDate_(s.date),
        sets: (bySession[s.session_id] || []).sort(function (a, b) {
          return (Number(a.set_num) || 0) - (Number(b.set_num) || 0);
        }),
      });
    })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
    .slice(0, limit);
}

// ============================================================
// Write action (唯一寫入口)
// ============================================================
function submitSession_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!body.session || !body.sets) throw new Error('missing session or sets');
    const now = new Date();
    const sid = Utilities.formatDate(now, TZ, 'yyyyMMddHHmmss');

    appendRow_('Sessions', {
      session_id: sid,
      date: body.session.date || Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
      type: body.session.type,
      includes_core: !!body.session.includes_core,
      body_weight: body.session.body_weight != null ? body.session.body_weight : '',
      notes: body.session.notes || '',
      created_at: Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm:ss'),
    });

    body.sets.forEach(function (s, i) {
      appendRow_('SetLogs', {
        log_id: sid + '_' + (i + 1),
        session_id: sid,
        exercise_id: s.exercise_id,
        exercise_name: s.exercise_name || '',
        set_num: s.set_num || (i + 1),
        weight: s.weight != null ? s.weight : 0,
        reps: s.reps != null ? s.reps : 0,
        rpe: s.rpe == null ? '' : s.rpe,
        note: s.note || '',
        is_substitute: !!s.is_substitute,
      });
    });

    return { session_id: sid, set_count: body.sets.length };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// Date helpers
// ============================================================
function formatDate_(d) {
  if (!d) return '';
  if (d instanceof Date) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return String(d).slice(0, 10);
}

function daysBetween_(dateStr, today) {
  const d1 = new Date(dateStr + 'T00:00:00');
  const d2 = new Date(Utilities.formatDate(today, TZ, 'yyyy-MM-dd') + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000);
}

// ============================================================
// Debug helper (跑一下確認 sheet 讀得到)
// ============================================================
function _debug() {
  Logger.log('Exercises: ' + readTable_('Exercises').length);
  Logger.log('Templates: ' + readTable_('Templates').length);
  Logger.log('Sessions: ' + readTable_('Sessions').length);
  Logger.log('SetLogs: ' + readTable_('SetLogs').length);
  Logger.log('api_token: ' + getConfig_('api_token'));
  Logger.log('todayPlan: ' + JSON.stringify(getTodayPlan_()));
}
