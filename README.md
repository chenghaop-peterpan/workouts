# 健身記錄 Prototype

零成本 stack:**GitHub Pages 前端 + Apps Script 後端 + Google Sheets 當 DB**。

- **Live 網站**: https://chenghaop-peterpan.github.io/workouts/
- **Repo**: https://github.com/chenghaop-peterpan/workouts

### 快速連結

| 頁面 | 網址 |
|---|---|
| 🏠 首頁(選日子 + 今日建議) | https://chenghaop-peterpan.github.io/workouts/ |
| 💪 訓練中(有草稿時) | https://chenghaop-peterpan.github.io/workouts/session.html |
| 📜 歷史紀錄 | https://chenghaop-peterpan.github.io/workouts/history.html |
| ⚙️ 設定(token / 清草稿) | https://chenghaop-peterpan.github.io/workouts/admin.html |

## 快速開始 (mock 模式)

用瀏覽器打開 `index.html` 即可。所有資料存在 `js/mock-data.js`,以及瀏覽器 `localStorage`(草稿)。

或啟一個小型 static server(避免部分瀏覽器對 `file://` 的限制):
```bash
cd workouts
python -m http.server 8000
# 開 http://localhost:8000
```

## 流程

1. **index.html** — 今日建議(推/拉輪替 + 每 3 天核心)+ 三顆日子按鈕
2. **session.html** — 依日子類型載入預設菜單。每組:kg / reps / RIR / 休息秒、✓ 完成、📝 加備註、⭐ PR 標記、⚠ 爆增預警
3. 完成訓練 → 一次性 POST → 清 localStorage 草稿 → 跳歷史頁
4. **history.html** — 展開/收起檢視每場訓練
5. **admin.html** — 設定 API token、切換模式、清草稿

## 檔案結構

```
workouts/
├── index.html          選日子 + 今日建議 + 繼續草稿
├── session.html        菜單表單、記錄、送出
├── history.html        最近訓練歷史
├── admin.html          token / 草稿管理
├── css/style.css       手機優先 UI
├── js/
│   ├── config.js       WEB_APP_URL、USE_MOCK、預警閾值
│   ├── mock-data.js    Prototype 假資料(含 4 場真實歷史)
│   ├── api.js          唯一 IO 層 (mock / real 兩實作)
│   ├── plan.js         今日建議演算法
│   ├── draft.js        localStorage 草稿層
│   ├── app-index.js    首頁邏輯
│   ├── app-session.js  訓練頁邏輯(含 rest timer、PR、警告)
│   └── app-history.js  歷史頁邏輯
└── apps-script/
    ├── Code.gs         後端 API(貼進 Apps Script 編輯器)
    └── Seed.gs         initSheet + seedHistorical
```

---

## 接後端 (Phase B + C)

### Phase B — Google Sheet + Apps Script

**1. 建 Google Sheet**
- 到 [sheets.google.com](https://sheets.google.com) 新增一份空白試算表,命名(如「Workouts DB」)
- 5 個工作表會由 `initSheet()` 自動建立,先不用手動加

**2. 貼上 Apps Script**
- Sheet 選單 → `Extensions` → `Apps Script`
- 左側檔案列預設有 `Code.gs`:貼上 repo 中 `apps-script/Code.gs` 全部內容
- 左側 `+` → `Script`,命名 `Seed`:貼上 repo 中 `apps-script/Seed.gs` 全部內容
- Ctrl+S 存檔

**3. 跑 initSheet 建立結構 + seed exercises/templates**
- 上方函式下拉選擇 `initSheet` → **Run**
- 第一次會跳權限:一路允許(自己的 script、只給自己用,可以直接接受)
- 若卡「未驗證的應用程式」:點「進階 → 前往(不安全)」
- **執行紀錄視窗**會印出 `API TOKEN GENERATED`,**複製這個 token 保存好**

**4. (選)跑 seedHistorical 匯入 4 場真實歷史**
- 選 `seedHistorical` → **Run**
- 完成後 Sessions 有 4 筆、SetLogs 有 55 筆

**5. 部署為 Web app**
- 右上角 `Deploy` → `New deployment`
- 齒輪選 `Web app`
- Description: `v1` (隨意)
- Execute as: **Me**
- Who has access: **Anyone**
- `Deploy` → 授權 → **複製 Web app URL**(結尾 `/exec`)

### Phase C — 切前端到 real 模式

**1. 編輯 `js/config.js`**
```js
window.APP_CONFIG = {
  WEB_APP_URL: '你剛拿到的 Web app URL',
  USE_MOCK: false,
  CORE_INTERVAL_DAYS: 3,
  WEIGHT_JUMP_RATIO: 1.25,
};
```

**2. Commit + push**
```bash
git add js/config.js
git commit -m "config: switch to real backend"
git push
```

**3. 等 GitHub Pages 重建(約 30 秒),然後**
- 開 `https://chenghaop-peterpan.github.io/workouts/admin.html`
- 貼上 token → 儲存
- 回首頁測試:今日建議應該還是「推 + 腿」,但現在資料來自 Google Sheet

---

## 日常維護

- **改菜單**:直接改 Sheet 的 `Templates` 表,新增/刪除/調 position
- **加動作**:改 Sheet 的 `Exercises` 表加一列
- **改教練提醒 / target 強度 / 影片連結**:改 Exercises 表對應欄位
- **重跑 initSheet**:安全(Config、Sessions、SetLogs 不動),但會覆蓋 Exercises / Templates
- **改預警閾值**:改 `js/config.js` 的 `WEIGHT_JUMP_RATIO`,推 code

## 除錯

- 在 Apps Script 編輯器選 `_debug` → Run,執行紀錄印出 sheet 筆數與 today plan
- 前端 open DevTools → Network 看 fetch,錯誤訊息在 response body
- CORS 錯誤 = 前端沒用 `text/plain` 送(api.js 已處理過,別動)
- 401 unauthorized = admin.html 的 token 錯或沒設

## 未來遷移到真 DB

Schema 已是關聯式。遷移時:
1. `CREATE TABLE` 對應 4 張業務表(Exercises / Templates / Sessions / SetLogs)
2. 一次性 script 從 Sheet 匯出 → INSERT 到 DB
3. 新 backend(Node/Python)實作相同 API 路徑與回傳格式
4. 前端只改 `js/config.js` 的 URL,其他不動
