/**
 * 一次性初始化 + Seed 資料。
 *
 * 使用方式(在 Apps Script 編輯器):
 *   1. 選擇函式 `initSheet` → Run(第一次會跳權限,允許)
 *   2. 從 Logger.log 複製產生的 api_token
 *   3. (選)選擇函式 `seedHistorical` → Run 匯入 4 場真實歷史 55 個 SetLog
 *
 * 重跑注意:
 *   - initSheet 是 idempotent(不會覆寫既有 Config、Sessions、SetLogs)
 *   - 但會 **重置** Exercises 與 Templates(若你有手動改過會被覆蓋)
 *   - seedHistorical 不做去重,重跑會插重複資料
 */

const SCHEMA = {
  Exercises: ['exercise_id', 'name', 'category', 'default_sets', 'default_reps', 'target', 'coach_tip', 'hint_url', 'notes'],
  Templates: ['template_type', 'position', 'exercise_id', 'sets', 'reps'],
  Sessions:  ['session_id', 'date', 'type', 'includes_core', 'body_weight', 'notes', 'created_at'],
  SetLogs:   ['log_id', 'session_id', 'exercise_id', 'exercise_name', 'set_num', 'weight', 'reps', 'rpe', 'note', 'is_substitute'],
  Config:    ['key', 'value'],
};

function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Create sheets + headers
  Object.keys(SCHEMA).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SCHEMA[name];
    const existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const isEmpty = existing.every(function (v) { return v === '' || v == null; });
    if (isEmpty) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  });

  // 2. Delete default Sheet1 if exists (and 已無用)
  const s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('工作表1');
  if (s1 && !SCHEMA[s1.getName()]) {
    try { ss.deleteSheet(s1); } catch (_) {}
  }

  // 3. Config: only fill if empty
  const cfg = ss.getSheetByName('Config');
  if (cfg.getLastRow() < 2) {
    const token = 'wk_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    cfg.appendRow(['api_token', token]);
    cfg.appendRow(['core_interval_days', 3]);
    cfg.appendRow(['schema_version', 1]);
    Logger.log('==================================================');
    Logger.log('API TOKEN GENERATED (貼進 js/config.js):');
    Logger.log(token);
    Logger.log('==================================================');
  } else {
    Logger.log('Config 已存在。目前 api_token: ' + readConfig_('api_token'));
  }

  // 4. Overwrite Exercises + Templates
  reseed_('Exercises', SCHEMA.Exercises, EXERCISES);
  reseed_('Templates', SCHEMA.Templates, TEMPLATES);

  Logger.log('Init 完成。Exercises: ' + EXERCISES.length + ',Templates: ' + TEMPLATES.length);
}

function seedHistorical() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sessSh = ss.getSheetByName('Sessions');
  const setSh = ss.getSheetByName('SetLogs');

  let setCount = 0;
  HISTORICAL_SESSIONS.forEach(function (s) {
    appendObj_(sessSh, SCHEMA.Sessions, {
      session_id: s.session_id,
      date: s.date,
      type: s.type,
      includes_core: s.includes_core,
      body_weight: s.body_weight != null ? s.body_weight : '',
      notes: s.notes || '',
      created_at: s.date + ' 18:00:00',
    });
    s.sets.forEach(function (st) {
      appendObj_(setSh, SCHEMA.SetLogs, st);
      setCount++;
    });
  });
  Logger.log('已 seed:' + HISTORICAL_SESSIONS.length + ' 場 sessions,' + setCount + ' 筆 SetLogs');
}

// ============================================================
// Helpers
// ============================================================
function reseed_(sheetName, cols, rows) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).clearContent();
  }
  rows.forEach(function (r) { appendObj_(sh, cols, r); });
}

function appendObj_(sh, cols, obj) {
  sh.appendRow(cols.map(function (c) { return obj[c] !== undefined ? obj[c] : ''; }));
}

function readConfig_(key) {
  const data = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config').getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

// ============================================================
// SEED: Exercises (21)
// ============================================================
const EXERCISES = [
  // Push
  { exercise_id: 'shoulder_warmup',          name: '肩關節啟動熱身',       category: 'push', default_sets: 2, default_reps: 15, target: '2.5 kg 前平舉/側平舉', coach_tip: '輕重量喚醒肩關節,別急著上重', hint_url: '', notes: '' },
  { exercise_id: 'flat_db_press',            name: '平板啞鈴胸推',         category: 'push', default_sets: 3, default_reps: 8,  target: '22.5 kg × 6-8 (RIR 0-1)', coach_tip: '核心徵召極強,穩固後可再進階', hint_url: '', notes: '' },
  { exercise_id: 'incline_db_press',         name: '上斜啞鈴胸推',         category: 'push', default_sets: 3, default_reps: 8,  target: '15-17.5 kg', coach_tip: '平板榨乾後上胸仍能扛大重量', hint_url: '', notes: '' },
  { exercise_id: 'seated_db_shoulder_press', name: '坐姿啞鈴肩推',         category: 'push', default_sets: 3, default_reps: 8,  target: '15-17.5 kg,退階 15 kg 高品質力竭', coach_tip: '前三角肌力量跨度大,選對重量比硬撐重要', hint_url: '', notes: '' },
  { exercise_id: 'db_lateral_raise',         name: '啞鈴側平舉',           category: 'push', default_sets: 3, default_reps: 15, target: '5 kg × 15', coach_tip: '嚴格控制,專注中三角肌充血', hint_url: '', notes: '' },
  { exercise_id: 'pec_fly',                  name: '器械夾胸 (Precor)',    category: 'push', default_sets: 3, default_reps: 10, target: '32-35 kg', coach_tip: '取代三頭下壓,把胸大肌中縫徹底撕裂', hint_url: '', notes: '' },
  // Pull
  { exercise_id: 'hoist_low_row',            name: 'HOIST 機械低拉划船', category: 'pull', default_sets: 3, default_reps: 8,  target: '52-59 kg', coach_tip: '背部力量超車握力,握不住時上拉力帶', hint_url: '', notes: '' },
  { exercise_id: 'lat_pulldown',             name: '滑輪下拉',           category: 'pull', default_sets: 3, default_reps: 8,  target: '39-45 kg', coach_tip: '划船破壞後仍能穩定輸出,背闊肌耐力好', hint_url: '', notes: '' },
  { exercise_id: 'cable_face_pull',          name: '繩索面拉',           category: 'pull', default_sets: 3, default_reps: 12, target: '32 kg × 12-15', coach_tip: '退回 32 kg 目標肌肉感受度與控制力更完美', hint_url: '', notes: '' },
  { exercise_id: 'db_alt_curl',              name: '啞鈴交替彎舉',       category: 'pull', default_sets: 3, default_reps: 10, target: '7.5-10 kg', coach_tip: '鎖死手肘,頂峰外旋擠壓二頭肌短頭', hint_url: '', notes: '' },
  { exercise_id: 'db_hammer_curl',           name: '啞鈴錘式彎舉',       category: 'pull', default_sets: 3, default_reps: 10, target: '5 kg', coach_tip: '終極收尾,榨乾前臂、肱肌與最後的握力', hint_url: '', notes: '' },
  // Legs
  { exercise_id: 'barbell_rdl',              name: '槓鈴羅馬尼亞硬舉',   category: 'legs', default_sets: 3, default_reps: 10, target: '熱身 20 kg × 12', coach_tip: '屁股往後推,下背不反折', hint_url: 'https://www.youtube.com/watch?v=JCXUYuzwNrM', notes: '' },
  { exercise_id: 'leg_press',                name: 'Precor 腿推機',      category: 'legs', default_sets: 3, default_reps: 10, target: '熱身 73 kg × 10', coach_tip: '推頂時膝蓋微彎不鎖死', hint_url: 'https://www.youtube.com/watch?v=GvRgZQlTzcY', notes: '' },
  { exercise_id: 'goblet_squat',             name: '壺鈴高腳杯深蹲',     category: 'legs', default_sets: 3, default_reps: 10, target: '', coach_tip: '軀幹直立,手肘收緊', hint_url: 'https://www.youtube.com/watch?v=MeIiIdhvXT4', notes: '' },
  { exercise_id: 'leg_extension',            name: '機械腿伸展',         category: 'legs', default_sets: 3, default_reps: 12, target: '', coach_tip: '頂峰停頓 1 秒;最後一組做遞減組:力竭後降重再力竭', hint_url: '', notes: '' },
  { exercise_id: 'leg_curl',                 name: '機械腿彎舉',         category: 'legs', default_sets: 3, default_reps: 12, target: '', coach_tip: '離心 3 秒', hint_url: '', notes: '' },
  // Core
  { exercise_id: 'cocoon_curl',              name: '繭式卷腹 (Cocoon Curl)', category: 'core', default_sets: 3, default_reps: 12, target: '10-15 下', coach_tip: '追求腹直肌極致收縮,別像折書死板;保持脊椎伸展,收縮時慢慢吐氣', hint_url: '', notes: '' },
  { exercise_id: 'russian_twist',            name: '俄羅斯轉體變式',     category: 'core', default_sets: 3, default_reps: 20, target: '每邊 10 (共 20)', coach_tip: '放慢速度!不要用慣性狂甩,專注側腹肌擠壓與呼吸', hint_url: '', notes: '' },
  { exercise_id: 'serratus_plank',           name: '前鋸肌平板支撐',     category: 'core', default_sets: 3, default_reps: 12, target: '10-15 下', coach_tip: '肩胛外展(微圓肩)、抬臀時吐氣頂點停 1 秒,對大重量推拉穩定度幫助極大', hint_url: '', notes: '' },
  { exercise_id: 'reverse_crunch',           name: '反向卷腹',           category: 'core', default_sets: 3, default_reps: 18, target: '15-20 下', coach_tip: '骨盆後傾(下背貼地),不要用爆發力把腿甩上去', hint_url: '', notes: '' },
  { exercise_id: 'kneeling_vacuum',          name: '跪姿真空腹',         category: 'core', default_sets: 5, default_reps: 1,  target: '5 次 × 每次 20 秒', coach_tip: '吐光空氣後憋氣,肚臍死命往脊椎方向吸;鍛鍊深層腹橫肌', hint_url: '', notes: '' },
];

// ============================================================
// SEED: Templates (26 rows, flattened)
// ============================================================
const TEMPLATES = [
  // push_legs (11)
  { template_type: 'push_legs', position: 0,  exercise_id: 'shoulder_warmup',          sets: 2, reps: 15 },
  { template_type: 'push_legs', position: 1,  exercise_id: 'flat_db_press',            sets: 3, reps: 8  },
  { template_type: 'push_legs', position: 2,  exercise_id: 'incline_db_press',         sets: 3, reps: 8  },
  { template_type: 'push_legs', position: 3,  exercise_id: 'seated_db_shoulder_press', sets: 3, reps: 8  },
  { template_type: 'push_legs', position: 4,  exercise_id: 'db_lateral_raise',         sets: 3, reps: 15 },
  { template_type: 'push_legs', position: 5,  exercise_id: 'pec_fly',                  sets: 3, reps: 10 },
  { template_type: 'push_legs', position: 6,  exercise_id: 'barbell_rdl',              sets: 3, reps: 10 },
  { template_type: 'push_legs', position: 7,  exercise_id: 'leg_press',                sets: 3, reps: 10 },
  { template_type: 'push_legs', position: 8,  exercise_id: 'goblet_squat',             sets: 3, reps: 10 },
  { template_type: 'push_legs', position: 9,  exercise_id: 'leg_extension',            sets: 3, reps: 12 },
  { template_type: 'push_legs', position: 10, exercise_id: 'leg_curl',                 sets: 3, reps: 12 },
  // pull_legs (10)
  { template_type: 'pull_legs', position: 0, exercise_id: 'hoist_low_row',    sets: 3, reps: 8  },
  { template_type: 'pull_legs', position: 1, exercise_id: 'lat_pulldown',     sets: 3, reps: 8  },
  { template_type: 'pull_legs', position: 2, exercise_id: 'cable_face_pull',  sets: 3, reps: 12 },
  { template_type: 'pull_legs', position: 3, exercise_id: 'db_alt_curl',      sets: 3, reps: 10 },
  { template_type: 'pull_legs', position: 4, exercise_id: 'db_hammer_curl',   sets: 3, reps: 10 },
  { template_type: 'pull_legs', position: 5, exercise_id: 'barbell_rdl',      sets: 3, reps: 10 },
  { template_type: 'pull_legs', position: 6, exercise_id: 'leg_press',        sets: 3, reps: 10 },
  { template_type: 'pull_legs', position: 7, exercise_id: 'goblet_squat',     sets: 3, reps: 10 },
  { template_type: 'pull_legs', position: 8, exercise_id: 'leg_extension',    sets: 3, reps: 12 },
  { template_type: 'pull_legs', position: 9, exercise_id: 'leg_curl',         sets: 3, reps: 12 },
  // core (5)
  { template_type: 'core', position: 0, exercise_id: 'cocoon_curl',     sets: 3, reps: 12 },
  { template_type: 'core', position: 1, exercise_id: 'russian_twist',   sets: 3, reps: 20 },
  { template_type: 'core', position: 2, exercise_id: 'serratus_plank',  sets: 3, reps: 12 },
  { template_type: 'core', position: 3, exercise_id: 'reverse_crunch',  sets: 3, reps: 18 },
  { template_type: 'core', position: 4, exercise_id: 'kneeling_vacuum', sets: 5, reps: 1  },
];

// ============================================================
// SEED: Historical sessions (2026-08-17 ~ 08-25,4 場 55 個 SetLog)
// ============================================================
const HISTORICAL_SESSIONS = [
  // ----- 8/25 pull (18 sets) -----
  {
    session_id: '20260825180000', date: '2026-08-25', type: 'pull', includes_core: false, body_weight: '', notes: '',
    sets: [
      { log_id: '20260825_1',  session_id: '20260825180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 1, weight: 52,  reps: 10, rpe: 9,  note: '熱身組:23*10, 32*10。break 120s 感覺手握不住,但背有力', is_substitute: false },
      { log_id: '20260825_2',  session_id: '20260825180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 2, weight: 52,  reps: 10, rpe: 10, note: 'break 150s 手指真的有點滑', is_substitute: false },
      { log_id: '20260825_3',  session_id: '20260825180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 3, weight: 59,  reps: 6,  rpe: 10, note: '往上一個重量 break 120s', is_substitute: false },
      { log_id: '20260825_4',  session_id: '20260825180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 4, weight: 52,  reps: 7,  rpe: 10, note: '做到力竭', is_substitute: false },
      { log_id: '20260825_5',  session_id: '20260825180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 1, weight: 45,  reps: 8,  rpe: '', note: '熱身:32*10', is_substitute: false },
      { log_id: '20260825_6',  session_id: '20260825180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 2, weight: 45,  reps: 8,  rpe: '', note: '', is_substitute: false },
      { log_id: '20260825_7',  session_id: '20260825180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 3, weight: 45,  reps: 7,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260825_8',  session_id: '20260825180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 4, weight: 39,  reps: 11, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260825_9',  session_id: '20260825180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 1, weight: 36,  reps: 12, rpe: '', note: '熱身組:23*12。break 120s', is_substitute: false },
      { log_id: '20260825_10', session_id: '20260825180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 2, weight: 36,  reps: 12, rpe: '', note: 'break 120s', is_substitute: false },
      { log_id: '20260825_11', session_id: '20260825180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 3, weight: 32,  reps: 12, rpe: '', note: '退後一個重量確保有感度,肌肉比較有感', is_substitute: false },
      { log_id: '20260825_12', session_id: '20260825180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 4, weight: 32,  reps: 15, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260825_13', session_id: '20260825180000', exercise_id: 'db_alt_curl',      exercise_name: '啞鈴交替彎舉',       set_num: 1, weight: 10,  reps: 8,  rpe: 10, note: '熱身:7.5*15', is_substitute: false },
      { log_id: '20260825_14', session_id: '20260825180000', exercise_id: 'db_alt_curl',      exercise_name: '啞鈴交替彎舉',       set_num: 2, weight: 7.5, reps: 8,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260825_15', session_id: '20260825180000', exercise_id: 'db_alt_curl',      exercise_name: '啞鈴交替彎舉',       set_num: 3, weight: 7.5, reps: 8,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260825_16', session_id: '20260825180000', exercise_id: 'db_hammer_curl',   exercise_name: '啞鈴錘式彎舉',       set_num: 1, weight: 5,   reps: 12, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260825_17', session_id: '20260825180000', exercise_id: 'db_hammer_curl',   exercise_name: '啞鈴錘式彎舉',       set_num: 2, weight: 5,   reps: 12, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260825_18', session_id: '20260825180000', exercise_id: 'db_hammer_curl',   exercise_name: '啞鈴錘式彎舉',       set_num: 3, weight: 5,   reps: 8,  rpe: 10, note: '今天結束/完全力竭', is_substitute: false },
    ],
  },
  // ----- 8/20 pull (9 sets) -----
  {
    session_id: '20260820180000', date: '2026-08-20', type: 'pull', includes_core: false, body_weight: '', notes: '',
    sets: [
      { log_id: '20260820_1', session_id: '20260820180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 1, weight: 52, reps: 12, rpe: 10, note: '熱身組:27*12, 32*12', is_substitute: false },
      { log_id: '20260820_2', session_id: '20260820180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 2, weight: 52, reps: 10, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260820_3', session_id: '20260820180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 3, weight: 45, reps: 10, rpe: '', note: '', is_substitute: false },
      { log_id: '20260820_4', session_id: '20260820180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 1, weight: 45, reps: 10, rpe: 10, note: '熱身組:27*12。組間休息 2.5mins', is_substitute: false },
      { log_id: '20260820_5', session_id: '20260820180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 2, weight: 45, reps: 8,  rpe: '', note: '組間休息 2.5mins', is_substitute: false },
      { log_id: '20260820_6', session_id: '20260820180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 3, weight: 39, reps: 11, rpe: 10, note: '組間休息 2.5mins', is_substitute: false },
      { log_id: '20260820_7', session_id: '20260820180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 1, weight: 36, reps: 15, rpe: 10, note: '熱身組:23*12。組間休息 2mins,超累', is_substitute: false },
      { log_id: '20260820_8', session_id: '20260820180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 2, weight: 36, reps: 15, rpe: 10, note: '組間休息 2mins,超累累', is_substitute: false },
      { log_id: '20260820_9', session_id: '20260820180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 3, weight: 32, reps: 15, rpe: 10, note: '組間休息 2mins', is_substitute: false },
    ],
  },
  // ----- 8/18 push_legs (19 sets) -----
  {
    session_id: '20260818180000', date: '2026-08-18', type: 'push_legs', includes_core: false, body_weight: '', notes: '推日結尾加碼 Leg Press 榨乾股四頭肌',
    sets: [
      { log_id: '20260818_1',  session_id: '20260818180000', exercise_id: 'flat_db_press',            exercise_name: '平板啞鈴胸推', set_num: 1, weight: 22.5, reps: 6,  rpe: 9,  note: '熱身組:12.5*12, 15*12。組間休息 2.5mins', is_substitute: false },
      { log_id: '20260818_2',  session_id: '20260818180000', exercise_id: 'flat_db_press',            exercise_name: '平板啞鈴胸推', set_num: 2, weight: 22.5, reps: 8,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260818_3',  session_id: '20260818180000', exercise_id: 'flat_db_press',            exercise_name: '平板啞鈴胸推', set_num: 3, weight: 22.5, reps: 7,  rpe: 10, note: '組間休息 3mins', is_substitute: false },
      { log_id: '20260818_4',  session_id: '20260818180000', exercise_id: 'flat_db_press',            exercise_name: '平板啞鈴胸推', set_num: 4, weight: 20,   reps: 8,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260818_5',  session_id: '20260818180000', exercise_id: 'incline_db_press',         exercise_name: '上斜啞鈴胸推', set_num: 1, weight: 15,   reps: 11, rpe: 10, note: '熱身組:10*10, 12.5*10', is_substitute: false },
      { log_id: '20260818_6',  session_id: '20260818180000', exercise_id: 'incline_db_press',         exercise_name: '上斜啞鈴胸推', set_num: 2, weight: 15,   reps: 10, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260818_7',  session_id: '20260818180000', exercise_id: 'incline_db_press',         exercise_name: '上斜啞鈴胸推', set_num: 3, weight: 17.5, reps: 6,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260818_8',  session_id: '20260818180000', exercise_id: 'seated_db_shoulder_press', exercise_name: '坐姿啞鈴肩推', set_num: 1, weight: 10,   reps: 12, rpe: 10, note: '熱身組:5*10, 7*10 (休息 60s)', is_substitute: false },
      { log_id: '20260818_9',  session_id: '20260818180000', exercise_id: 'seated_db_shoulder_press', exercise_name: '坐姿啞鈴肩推', set_num: 2, weight: 17.5, reps: 5,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260818_10', session_id: '20260818180000', exercise_id: 'seated_db_shoulder_press', exercise_name: '坐姿啞鈴肩推', set_num: 3, weight: 15,   reps: 9,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260818_11', session_id: '20260818180000', exercise_id: 'db_lateral_raise',         exercise_name: '啞鈴側平舉',   set_num: 1, weight: 5,    reps: 15, rpe: '', note: '忘記熱身', is_substitute: false },
      { log_id: '20260818_12', session_id: '20260818180000', exercise_id: 'db_lateral_raise',         exercise_name: '啞鈴側平舉',   set_num: 2, weight: 5,    reps: 15, rpe: '', note: '', is_substitute: false },
      { log_id: '20260818_13', session_id: '20260818180000', exercise_id: 'db_lateral_raise',         exercise_name: '啞鈴側平舉',   set_num: 3, weight: 5,    reps: 15, rpe: '', note: '', is_substitute: false },
      { log_id: '20260818_14', session_id: '20260818180000', exercise_id: 'pec_fly',                  exercise_name: '器械夾胸 (Precor)', set_num: 1, weight: 32, reps: 10, rpe: 9,  note: '熱身組:23*15', is_substitute: false },
      { log_id: '20260818_15', session_id: '20260818180000', exercise_id: 'pec_fly',                  exercise_name: '器械夾胸 (Precor)', set_num: 2, weight: 35, reps: 6,  rpe: 10, note: '組間休息 1.5mins', is_substitute: false },
      { log_id: '20260818_16', session_id: '20260818180000', exercise_id: 'pec_fly',                  exercise_name: '器械夾胸 (Precor)', set_num: 3, weight: 32, reps: 10, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260818_17', session_id: '20260818180000', exercise_id: 'leg_press',                exercise_name: 'Precor 腿推機', set_num: 1, weight: 73,   reps: 10, rpe: 8,  note: '無熱身。組間休息 2.5mins', is_substitute: false },
      { log_id: '20260818_18', session_id: '20260818180000', exercise_id: 'leg_press',                exercise_name: 'Precor 腿推機', set_num: 2, weight: 91,   reps: 10, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260818_19', session_id: '20260818180000', exercise_id: 'leg_press',                exercise_name: 'Precor 腿推機', set_num: 3, weight: 91,   reps: 10, rpe: 10, note: '', is_substitute: false },
    ],
  },
  // ----- 8/17 pull (9 sets) -----
  {
    session_id: '20260817180000', date: '2026-08-17', type: 'pull', includes_core: false, body_weight: '', notes: '',
    sets: [
      { log_id: '20260817_1', session_id: '20260817180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 1, weight: 45, reps: 12, rpe: 10, note: '熱身組:27*12, 32*12', is_substitute: false },
      { log_id: '20260817_2', session_id: '20260817180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 2, weight: 45, reps: 12, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260817_3', session_id: '20260817180000', exercise_id: 'hoist_low_row',    exercise_name: 'HOIST 機械低拉划船', set_num: 3, weight: 52, reps: 8,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260817_4', session_id: '20260817180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 1, weight: 39, reps: 12, rpe: 10, note: '熱身組:27*12', is_substitute: false },
      { log_id: '20260817_5', session_id: '20260817180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 2, weight: 45, reps: 9,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260817_6', session_id: '20260817180000', exercise_id: 'lat_pulldown',     exercise_name: '滑輪下拉',           set_num: 3, weight: 45, reps: 7,  rpe: 10, note: '', is_substitute: false },
      { log_id: '20260817_7', session_id: '20260817180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 1, weight: 27, reps: 15, rpe: 8,  note: '熱身組:18*12', is_substitute: false },
      { log_id: '20260817_8', session_id: '20260817180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 2, weight: 32, reps: 15, rpe: 10, note: '', is_substitute: false },
      { log_id: '20260817_9', session_id: '20260817180000', exercise_id: 'cable_face_pull',  exercise_name: '繩索面拉',           set_num: 3, weight: 32, reps: 17, rpe: '', note: '', is_substitute: false },
    ],
  },
];
