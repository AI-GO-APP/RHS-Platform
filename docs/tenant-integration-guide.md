# RHS 平台 — 租戶抽換與串接指引

> **目的**：讓 AI Agent 或人類根據 6 項輸入資訊，將 staging VM 上已部署的 RHS 平台直接串接到另一個租戶的應用。

---

## 1. 前置條件

- 目標租戶的 Custom App / Self-Built App 已由管理員在 AI GO 管理後台開好
- 系統表引用（references）已由 Builder 事先建立，且**已發佈（Publish）**
- 已 clone 本 Repo 至本機（`git clone https://github.com/AI-GO-APP/RHS-Platform.git`）
- 本機已安裝 Node.js（≥18）與 npm

> ⚠️ **引用必須發佈**：Builder 在 AI GO 管理後台建立系統表引用後，必須點擊「發佈」使其生效。未發佈的引用會導致 Open Proxy / Ext Proxy 回傳 `403 Forbidden`。

### Git 版控說明

| 檔案 | Git 狀態 | 說明 |
|------|---------|------|
| `.env.production` | ✅ **tracked** | 包含 `VITE_*` 公開變數，修改後需 commit + push |
| `.env` | ❌ **gitignored** | 包含 API Key / Admin 密碼等敏感資訊，僅存於本機 |
| `scripts/seed-*.mjs` | ✅ **tracked** | 資料注入腳本 |
| `nginx.conf` | ✅ **tracked** | Nginx 反向代理設定（API Key 由 envsubst 注入） |

---

## 2. 輸入資訊定義

操作者需提供以下 **6 項資訊**：

| # | 輸入名稱 | 範例值 | 說明 |
|---|----------|--------|------|
| ① | **Admin 帳號** | `admin@company-x.com` | Builder 管理員 Email |
| ② | **Admin 密碼** | `Admin1234!` | Builder 管理員密碼 |
| ③ | **Slug** | `a1b2c3d4e5f6` | Custom App 的 12 字元十六進位識別碼 |
| ④ | **API Key** | `sk_live_xxxx...` | Open Proxy 使用的伺服器端 API Key |
| ⑤ | **Login URL** | `https://ai-go.app/api/v1/custom-app-auth/a1b2c3d4e5f6/login` | 消費者登入端點完整 URL |
| ⑥ | **Register URL** | `https://ai-go.app/api/v1/custom-app-auth/a1b2c3d4e5f6/register` | 消費者註冊端點完整 URL |

---

## 3. 從輸入推導環境變數

RHS 平台所有 API 呼叫都建構自兩個核心變數：`VITE_AIGO_API_BASE` 與 `VITE_AIGO_APP_SLUG`。
這兩者可從 Login URL 解析而得：

```
Login URL 格式：
{API_BASE}/custom-app-auth/{SLUG}/login
└─────────────┘              └────┘
  VITE_AIGO_API_BASE     VITE_AIGO_APP_SLUG
```

### 解析規則

```javascript
const loginUrl = '⑤ Login URL';
const match = loginUrl.match(/^(.+)\/custom-app-auth\/([a-f0-9]+)\/login$/);

const VITE_AIGO_API_BASE = match[1];  // e.g. 'https://ai-go.app/api/v1'
const VITE_AIGO_APP_SLUG = match[2];  // e.g. 'a1b2c3d4e5f6'（應等於 ③ Slug）
```

> ⚠️ **驗證**：解析出的 `VITE_AIGO_APP_SLUG` 必須等於輸入 ③ Slug。若不一致，代表 Login URL 與 Slug 不匹配。

### 完整環境變數對照表

| 環境變數 | 來源 | 用途 | 暴露範圍 |
|---------|------|------|---------| 
| `VITE_AIGO_API_BASE` | 從 ⑤ Login URL 解析 | （僅腳本用）前端走相對路徑 | 前端（打包進 JS）+ 腳本 |
| `VITE_AIGO_APP_SLUG` | ③ Slug | 前端 Custom App Auth 路由識別 | 前端（打包進 JS） |
| `VITE_APP_DOMAIN` | 固定值 `rhs-platform` | 資料隔離標識 | 前端（打包進 JS） |
| `AIGO_API_KEY` | ④ API Key | Open Proxy + Nginx 反向代理注入 | 僅伺服器端 |
| `AIGO_BUILDER_EMAIL` | ① Admin 帳號 | 管理操作（setup-references） | 僅伺服器端腳本 |
| `AIGO_BUILDER_PASSWORD` | ② Admin 密碼 | 管理操作（setup-references） | 僅伺服器端腳本 |

---

## 4. 執行步驟

### 流程總覽

```
本機操作                                         自動化
───────────────────────────────────────   ──────────────────
Step 1: 產生 .env + .env.production       
Step 2: 驗證端點連通性
Step 3: 匯入展示房源（npm run seed）
Step 4: commit + push to main            → GitHub Actions
                                            自動 build Docker
                                            自動部署到 staging VM
Step 5: SSH 更新 VM 的 AIGO_API_KEY       
Step 6: E2E 驗證（npm test）
```

> 💡 Step 1-3 在**本機**執行。Step 4 push 後由 CI/CD 自動處理建置。Step 5 僅在 API Key 變動時需要。

### 一鍵自動化（Step 1-3）

```bash
bash scripts/switch-tenant.sh \
  --admin-email "admin@company-x.com" \
  --admin-password "Admin1234!" \
  --slug "a1b2c3d4e5f6" \
  --api-key "sk_live_xxxx..." \
  --login-url "https://ai-go.app/api/v1/custom-app-auth/a1b2c3d4e5f6/login" \
  --register-url "https://ai-go.app/api/v1/custom-app-auth/a1b2c3d4e5f6/register"
```

> ⚠️ 完成後需手動執行 Step 4（commit + push）和 Step 5（更新 VM API Key）。

以下為各步驟詳解。

---

### Step 1：產生 `.env` 檔案

```bash
cat > .env << 'EOF'
VITE_AIGO_API_BASE=<從 Login URL 解析的 API_BASE>
VITE_AIGO_APP_SLUG=<③ Slug>
VITE_APP_DOMAIN=rhs-platform

AIGO_API_KEY=<④ API Key>
AIGO_BUILDER_EMAIL=<① Admin 帳號>
AIGO_BUILDER_PASSWORD=<② Admin 密碼>
EOF
```

同步更新 `.env.production`（Git tracked，Vite build 用）：

```bash
cat > .env.production << 'EOF'
VITE_AIGO_API_BASE=<從 Login URL 解析的 API_BASE>
VITE_AIGO_APP_SLUG=<③ Slug>
VITE_APP_DOMAIN=rhs-platform
EOF
```

> ⚠️ `.env.production` 是 **git tracked** 的，修改後須 commit + push 觸發重新部署。
> `.env` 是 **gitignored** 的，僅存於本機。

---

### Step 2：驗證端點連通性

```bash
# 驗證 Login URL（預期 400 或 422）
curl -s -o /dev/null -w "%{http_code}" -X POST "<⑤ Login URL>" \
  -H "Content-Type: application/json" -d '{}'

# 驗證 Register URL
curl -s -o /dev/null -w "%{http_code}" -X POST "<⑥ Register URL>" \
  -H "Content-Type: application/json" -d '{}'

# 驗證 API Key（Open Proxy）
curl -s -o /dev/null -w "%{http_code}" \
  "<VITE_AIGO_API_BASE>/open/proxy/product_templates?limit=1" \
  -H "X-API-Key: <④ API Key>"
```

| 預期結果 | 說明 |
|---------|------|
| Login/Register 回傳 `400` 或 `422` | ✅ 端點存在 |
| API Key 回傳 `200` | ✅ Open Proxy 正常 |
| 任何 `404` | ❌ Slug 或 API_BASE 有誤 |
| 任何 `401` / `403` | ❌ API Key 無效或引用未發佈 |

---

### Step 3：匯入展示房源

```bash
npm run seed
# 等同於：node scripts/inject-properties.cjs
```

透過 Open Proxy（API Key）將展示房源寫入 `product_templates`。
每筆房源的 `custom_data.app_domain` 會自動標記為 `'rhs-platform'`。

> 💡 若要匯入自訂房源，複製 `scripts/seed-template.mjs` 為新檔案，修改 `PROPERTIES` 陣列即可。
> 完整的欄位定義請見下方 [§A. 資料注入指引](#a-資料注入指引)。

---

### Step 4：提交變更並觸發 CI/CD 部署

```bash
git add .env.production
git commit -m "chore: 切換租戶至 <租戶名稱>"

git checkout main && git merge dev
git push origin main
git checkout dev
```

CI/CD 自動執行：
1. GitHub Actions 偵測 `main` 分支 push
2. SSH 到 staging VM
3. 自動 `docker compose up -d --build`（讀取 `.env.production` 的 `VITE_*` 變數）
4. Nginx envsubst 注入 `AIGO_API_KEY`

---

### Step 5：更新 VM 的 API Key

> ⚠️ 此步驟在 **API Key 變動時**才需要（同一租戶切 slug 通常同一組 key）。

```bash
ssh deploy@<staging-host>
cd /opt/apps/rhs

# 更新 API Key
nano .env
# 確保 AIGO_API_KEY=<新的 API Key>

# 重建容器以套用新 Key
docker compose -f docker-compose.staging.yml up -d --build
```

---

### Step 6：端到端驗證

```bash
npm test
# 等同於：node scripts/e2e-api-test.mjs
```

測試涵蓋：Custom App Auth（register → login → me → refresh → logout）、Open Proxy、Ext Proxy、Proxy Query。

---

## 5. 程式碼關鍵位置速查

### 前端（改完需重新 build）

| 檔案 | 變數 | 用途 |
|------|------|------|
| `src/js/api/config.js:14` | `VITE_AIGO_APP_SLUG` | Custom App Auth 路由識別 |
| `src/js/api/config.js:12-13` | — | Open/Ext Proxy 路徑前綴（相對路徑） |
| `src/js/api/domain.js:9` | `APP_DOMAIN` | 資料隔離標識（硬編碼 `'rhs-platform'`） |

### Nginx 反向代理（Docker 層）

| 檔案 | 變數 | 用途 |
|------|------|------|
| `nginx.conf:17` | `${AIGO_API_KEY}` | envsubst 注入 API Key 到 Open Proxy Header |
| `Dockerfile:14` | `NGINX_ENVSUBST_FILTER=AIGO` | 限制只替換 AIGO 開頭的變數 |
| `docker-compose.staging.yml:15` | `AIGO_API_KEY` | 容器啟動時傳入 Nginx |

### 伺服器端腳本（執行時讀取 .env）

| 腳本 | 使用的環境變數 |
|------|---------------|
| `scripts/inject-properties.cjs` | `VITE_AIGO_API_BASE`, `AIGO_API_KEY` |
| `scripts/setup-references.cjs` | `VITE_AIGO_API_BASE`, `VITE_AIGO_APP_SLUG`, `AIGO_API_KEY`, `AIGO_BUILDER_EMAIL`, `AIGO_BUILDER_PASSWORD` |
| `scripts/e2e-api-test.mjs` | `VITE_AIGO_API_BASE`, `VITE_AIGO_APP_SLUG`, `AIGO_API_KEY` |
| `scripts/switch-tenant.sh` | 由命令列參數產生 .env，不直接讀取 |

---

## 6. 資料隔離策略（APP_DOMAIN）

- **硬編碼值**：`'rhs-platform'`（`src/js/api/domain.js:9`）
- **作用**：所有房源/預約的 `custom_data` 注入 `{ app_domain: 'rhs-platform' }`，查詢時自動過濾
- **跨租戶**：不同租戶的資料天然隔離，`APP_DOMAIN` 保持 `'rhs-platform'` 即可

> 💡 若同一租戶下有多個 RHS 實例需分開資料，可改為環境變數驅動：
> ```javascript
> // domain.js
> export const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || 'rhs-platform';
> ```
> 然後在 `.env.production` 修改 `VITE_APP_DOMAIN=my-custom-domain`。

---

## 7. 架構特色：Nginx 反向代理

### 與 EC Platform 的關鍵差異

RHS 平台採用 **Nginx 反向代理**架構，前端**不直連** AI GO API：

```
開發環境：瀏覽器 → Vite Dev Proxy（注入 API Key）→ AI GO
部署環境：瀏覽器 → Nginx（envsubst 注入 API Key）→ AI GO
```

| 優勢 | 說明 |
|------|------|
| API Key 安全 | Key 在伺服器端注入，前端 JS 完全看不到 |
| 可加安全層 | 可在 Nginx 加 rate limit、IP 白名單、WAF |
| 即時資料 | 未登入用戶也能即時查詢（走 Open Proxy），無需快取 |

| 代價 | 說明 |
|------|------|
| Docker 更複雜 | 需要 envsubst + template 機制 |
| 切換租戶需 rebuild | `VITE_*` 打包在 JS 中，`AIGO_API_KEY` 在 Nginx 中 |

### Nginx 路由表

| 前端路徑 | Nginx 轉發至 | Header 注入 |
|---------|-------------|-------------|
| `/api/open/*` | `https://ai-go.app/api/v1/open/*` | `X-API-Key: ${AIGO_API_KEY}` |
| `/api/ext/*` | `https://ai-go.app/api/v1/ext/*` | 透傳 `Authorization` |
| `/api/custom-app-auth/*` | `https://ai-go.app/api/v1/custom-app-auth/*` | 無（公開端點） |

---

## A. 資料注入指引

### A.1 兩種認證模式

| | Open Proxy（`X-API-Key`） | Ext Proxy（`Bearer Token`） |
|---|---|---|
| **Header** | `X-API-Key: sk_live_xxx` | `Authorization: Bearer <JWT>` |
| **端點前綴** | `/open/proxy/{table}` | `/ext/proxy/{table}` |
| **適用場景** | 伺服器端腳本（seed） | 前端用戶操作（預約看房） |
| **身份** | App 層級（無特定用戶） | 已登入的租客/房東 |
| **安全性** | ⚠️ API Key 絕不可暴露於前端 | ✅ 可安全用於瀏覽器 |

### A.2 `custom_data.app_domain` 注入規則

> ⚠️ **每筆寫入的資料都必須在 `custom_data` 中包含 `app_domain` 欄位，否則前端查不到。**

```javascript
// domain.js 中的 domainFilter()
{ column: 'custom_data', op: 'ilike', value: '%app_domain%rhs-platform%' }
```

---

### A.3 系統表 Schema 與注入範例

RHS 平台使用 **2 張核心表**。

---

#### A.3.1 `product_templates`（房源）

**權限**：read / create / update

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `name` | string | ✅ | 房源名稱（含區域） |
| `list_price` | number | ✅ | 月租金（NT$） |
| `active` | boolean | - | 是否上架（預設 `true`） |
| `type` | string | - | 固定使用 `'service'` |
| `invoice_policy` | string | - | 固定使用 `'order'` |
| `custom_data` | JSONB | ✅* | 自訂資料（**必須包含 `app_domain`**） |

**`custom_data` 建議結構**（RHS 前端會讀取的欄位）：

```json
{
  "app_domain": "rhs-platform",
  "property_type": "獨立套房",
  "location": "台北市信義區松智路",
  "size": 12,
  "floor": "15F",
  "images": ["/images/listing1.png"],
  "amenities": ["冷氣", "洗衣機", "冰箱", "電子鎖", "光纖寬頻"],
  "description": "物件描述文字..."
}
```

**curl 範例 — 建立房源**（Open Proxy）：

```bash
curl -X POST "${API_BASE}/open/proxy/product_templates" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "信義區 靜謐極簡高樓套房",
    "list_price": 28000,
    "active": true,
    "type": "service",
    "invoice_policy": "order",
    "custom_data": {
      "app_domain": "rhs-platform",
      "property_type": "獨立套房",
      "location": "台北市信義區松智路",
      "size": 12,
      "floor": "15F",
      "images": ["/images/listing1.png"],
      "amenities": ["冷氣", "洗衣機", "冰箱"],
      "description": "極簡風設計，全室木地板。"
    }
  }'
```

**查詢房源**（含 app_domain 過濾）：

```bash
curl -X POST "${API_BASE}/open/proxy/product_templates/query" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": [
      { "column": "custom_data", "op": "ilike", "value": "%app_domain%rhs-platform%" }
    ],
    "order_by": [{ "column": "list_price", "direction": "desc" }],
    "limit": 100
  }'
```

---

#### A.3.2 `crm_leads`（預約/委託）

**權限**：read / create / update

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `type` | string | ✅ | 固定使用 `'opportunity'` |
| `name` | string | ✅ | 預約/委託標題 |
| `contact_name` | string | - | 聯絡人姓名 |
| `phone` | string | - | 電話 |
| `email_from` | string | - | Email |
| `custom_data` | JSONB | ✅* | 自訂資料（**必須包含 `app_domain`**） |

> ⚠️ `priority` 欄位若傳入整數 `0` 會導致 AI GO 回傳 500 錯誤，不要傳入此欄位。

**`custom_data` 建議結構**：

```json
{
  "app_domain": "rhs-platform",
  "booking_type": "viewing",
  "property_id": "uuid-of-property",
  "property_name": "信義區 靜謐極簡高樓套房",
  "preferred_date": "2026-04-15",
  "preferred_time": "14:00",
  "message": "希望週末看房",
  "status": "待處理"
}
```

**curl 範例 — 建立預約**（Ext Proxy，需 Bearer Token）：

```bash
curl -X POST "${API_BASE}/ext/proxy/crm_leads" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "opportunity",
    "name": "預約看房 — 信義區 靜謐極簡高樓套房",
    "contact_name": "王小明",
    "phone": "0912-345-678",
    "email_from": "user@example.com",
    "custom_data": {
      "app_domain": "rhs-platform",
      "booking_type": "viewing",
      "property_id": "uuid",
      "preferred_date": "2026-04-15",
      "status": "待處理"
    }
  }'
```

---

### A.4 進階查詢 API（POST /query）

```javascript
{
  "filters": [
    { "column": "custom_data", "op": "ilike", "value": "%app_domain%rhs-platform%" },
    { "column": "list_price", "op": "gte", "value": 20000 }
  ],
  "order_by": [{ "column": "list_price", "direction": "asc" }],
  "limit": 50,
  "offset": 0
}
```

**支援的 filter 運算子**：

| op | 說明 | 範例 |
|----|------|------|
| `eq` | 等於 | `{ "column": "active", "op": "eq", "value": true }` |
| `neq` | 不等於 | — |
| `gt` / `gte` | 大於 / 大於等於 | `{ "column": "list_price", "op": "gte", "value": 20000 }` |
| `lt` / `lte` | 小於 / 小於等於 | — |
| `ilike` | 不分大小寫模糊比對 | `{ "column": "name", "op": "ilike", "value": "%信義%" }` |
| `in` | 在列表中 | `{ "column": "type", "op": "in", "value": ["service"] }` |

---

### A.5 批量注入注意事項

| 項目 | 說明 |
|------|------|
| **冪等性** | `inject-properties.cjs` 會先 query 確認是否已有 `app_domain` 資料，有則跳過 |
| **速率限制** | 建議批量注入時串行執行（每筆 `await`），避免並發 |
| **priority 欄位** | `crm_leads` 的 `priority` 傳入 `0` 會導致 500 錯誤，不要傳入 |
| **JSONB 過濾** | 使用 `%app_domain%rhs-platform%`（省略冒號）更穩定 |
| **圖片 URL** | 可使用相對路徑（如 `/images/listing1.png`），相對於部署域名 |

---

## 8. FAQ

### Q：切換租戶後需要重新 build Docker 嗎？

**需要。** `VITE_*` 變數在 build time 打包進 JS，`AIGO_API_KEY` 在 Nginx 啟動時注入。因此：
- 改 slug → commit `.env.production` + push → CI/CD 自動 rebuild
- 改 API Key → SSH 到 VM 更新 `.env` → `docker compose up -d --build`

### Q：新租戶已有房源資料，不需要 seed？

跳過 Step 3 即可。前端會即時透過 Open Proxy 查詢，不需要本地快取。

### Q：可以多租戶共用同一個實例嗎？

**不建議。** `VITE_AIGO_APP_SLUG` 在 build time 打包進 JS，一個 build 只對應一個租戶。
需要多租戶請部署多個 Docker 容器，各自使用不同 port + 子網域。

### Q：RHS 和 EC Platform 的架構有什麼差別？

| 維度 | EC Platform | RHS Platform |
|------|------------|--------------|
| Nginx 角色 | 純靜態伺服器 | 靜態 + API 反向代理 |
| API Key | 前端不直接用 | Nginx 層伺服器端注入 |
| 未登入資料 | 本地 JSON 快取 | 即時 Open Proxy |
| 安全性 | 依賴 CORS | 可加 Nginx rate limit |

---

## 9. 成功驗證標準

**線上驗證 URL**：`https://rhs.staging.ai-go.app`

### 9.1 房源列表可見（未登入）

| 檢查項目 | 預期結果 |
|---------|---------|
| 首頁載入 | 頁面正常顯示，無白屏 |
| 房源列表 | `/tenant-listing.html` 顯示已匯入的房源 |
| 房源詳情 | 點擊房源可進入詳情頁 |

### 9.2 用戶認證流程

| 檢查項目 | 預期結果 |
|---------|---------|
| 註冊 | 在登入頁成功註冊並自動登入 |
| 登入 | 登出後重新登入，Navbar 顯示用戶名稱 |
| 登出 | 回到未登入狀態 |

### 9.3 預約全流程

| 檢查項目 | 預期結果 |
|---------|---------|
| 預約看房 | 在詳情頁填寫預約表單，成功送出 |
| 進度查詢 | `/tenant-portal.html` 顯示剛建立的預約 |

### 9.4 API 端到端驗證（自動化）

```bash
npm test
```

**通過標準**：全部測試通過，`0 失敗`。

### 9.5 常見驗證失敗排查

| 現象 | 可能原因 | 排查方式 |
|------|---------|---------| 
| 首頁白屏 | `VITE_AIGO_APP_SLUG` 未正確打包 | 檢查 `.env.production` → 重新 docker build |
| 房源列表空白 | API Key 未注入 Nginx | SSH 到 VM 確認 `.env` 中有 `AIGO_API_KEY` |
| 登入回傳 404 | Slug 不正確 | 用 curl 驗證 Login URL |
| 預約送出 500 | `priority` 欄位或資料格式問題 | 檢查 console，確認 payload 不含 `priority` |
| E2E 測試失敗 | API Key 或 Slug 不匹配 | 重新確認 6 項輸入資訊 |
