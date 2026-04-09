# 示範包租代管平台 (SERENITY RHS Platform)

AI GO 整合的「示範包租代管」展示平台。純前端 Vanilla JS + Vite MPA 架構，透過 AI GO API 實現動態房源管理與預約系統。

## 技術架構

- **前端**：Vanilla HTML/CSS/JS（無框架）
- **建構工具**：Vite（MPA 多頁面應用）
- **後端**：Zero Backend — 所有資料透過 AI GO API 存取
- **認證**：AI GO Independent 模式（Custom App User）
- **資料隔離**：`app_domain: rhs-platform` 標籤

## AI GO 系統表映射

| 業務 | 系統表 | Proxy 模式 |
|------|--------|-----------|
| 房源物件 | `product_templates` | Open Proxy（免登入） |
| 預約/委託 | `crm_leads` | Ext Proxy（需登入） |

## 快速開始

```bash
# 安裝相依套件
npm install

# 建立環境變數（從範本複製）
cp .env.example .env
# 填入 AI GO API Key 與 App Slug

# 首次設定：灌入初始房源資料
node scripts/inject-properties.cjs

# 啟動開發伺服器
npm run dev
```

## 環境變數

```env
VITE_AIGO_API_BASE=https://ai-go.app/api/v1
VITE_AIGO_APP_SLUG=<your-app-slug>
VITE_AIGO_API_KEY=<your-api-key>
VITE_APP_DOMAIN=rhs-platform
```

## 專案結構

```
├── index.html              # 首頁（房東/租客入口）
├── landlord-service.html   # 房東委託服務頁
├── tenant-listing.html     # 租客房源列表
├── tenant-detail.html      # 物件詳情頁
├── tenant-portal.html      # 租客預約進度看板
├── login.html              # 登入/註冊頁
├── vite.config.js          # Vite 配置（含 Proxy 中轉規則）
├── src/
│   ├── css/style.css       # 全域樣式
│   └── js/
│       ├── api/            # API Client 模組
│       │   ├── config.js   # 通用 fetch 封裝
│       │   ├── auth.js     # 認證 + Token Rotation
│       │   ├── domain.js   # App Domain 隔離
│       │   ├── properties.js # 房源 CRUD
│       │   └── bookings.js # 預約/委託 CRUD
│       ├── components.js   # Navbar / Footer
│       ├── i18n.js         # 中英切換
│       └── login.js        # 登入/註冊邏輯
├── scripts/
│   ├── setup-references.cjs    # AI GO References 設定
│   └── inject-properties.cjs   # 初始房源灌入
└── public/images/          # 靜態圖片
```

## 安全架構

- API Key **僅在 Vite Dev Proxy 伺服器側注入**，前端完全不可見
- Ext Proxy 請求由前端帶 Bearer Token，Vite Proxy 直接透傳
- 所有資料寫入強制注入 `app_domain`，查詢強制帶 `domainFilter()`
