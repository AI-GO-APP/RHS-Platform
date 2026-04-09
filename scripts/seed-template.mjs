/**
 * RHS 平台 — 通用房源注入腳本模板
 *
 * 用途：複製此檔案並修改 PROPERTIES 陣列，即可將自訂房源注入目標租戶
 * 執行：node scripts/seed-template.mjs
 * 前置：.env 已設定 VITE_AIGO_API_BASE 和 AIGO_API_KEY
 *
 * 詳細欄位定義請見 docs/tenant-integration-guide.md §A.4
 */
import 'dotenv/config';

const API_BASE = process.env.VITE_AIGO_API_BASE;
const API_KEY  = process.env.AIGO_API_KEY;
const APP_DOMAIN = process.env.VITE_APP_DOMAIN || 'rhs-platform';

if (!API_BASE || !API_KEY) {
  console.error('❌ 需要 VITE_AIGO_API_BASE 和 AIGO_API_KEY 環境變數');
  console.error('💡 請先執行 switch-tenant.sh 或手動建立 .env');
  process.exit(1);
}

// ============================================================
// 通用 API 工具
// ============================================================

async function createRecord(table, data) {
  const res = await fetch(`${API_BASE}/open/proxy/${table}`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(result).substring(0, 200)}`);
  }
  return (result && result.id && result.data)
    ? { id: result.id, ...result.data }
    : result;
}

async function queryRecords(table, filters = [], limit = 200) {
  const res = await fetch(`${API_BASE}/open/proxy/${table}/query`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters, limit }),
  });
  if (!res.ok) throw new Error(`Query ${table} failed: ${res.status}`);
  return res.json();
}

// ============================================================
// 房源資料（請自行替換）
// ============================================================

const PROPERTIES = [
  {
    name: '範例區域 範例房源名稱',
    list_price: 25000,             // 月租金（NT$）
    active: true,
    type: 'service',               // 房源一律用 'service'
    invoice_policy: 'order',
    custom_data: {
      app_domain: APP_DOMAIN,
      // ── 以下為 RHS 前端會讀取的欄位 ──
      property_type: '獨立套房',   // 獨立套房 | 一房一廳 | 兩房一廳 | ...
      location: '台北市大安區和平東路',
      size: 12,                    // 坪數
      floor: '8F',
      images: ['/images/listing1.png'],
      amenities: ['冷氣', '洗衣機', '冰箱', '電子鎖', '光纖寬頻'],
      description: '範例描述文字。',
    },
  },
  // ... 複製上方結構，新增更多房源 ...
];

// ============================================================
// 預約/委託資料（可選，注入 crm_leads）
// ============================================================

const BOOKINGS = [
  // 取消註解以啟用預約注入：
  // {
  //   type: 'opportunity',
  //   name: '預約看房 — 範例區域 範例房源',
  //   contact_name: '王小明',
  //   phone: '0912-345-678',
  //   email_from: 'user@example.com',
  //   custom_data: {
  //     app_domain: APP_DOMAIN,
  //     booking_type: 'viewing',          // viewing | commission
  //     property_id: 'uuid-of-property',
  //     property_name: '範例房源',
  //     preferred_date: '2026-04-15',
  //     preferred_time: '14:00',
  //     message: '希望週末看房',
  //     status: '待處理',
  //   },
  // },
];

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  RHS 平台 — 通用資料注入                     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n  API Base   : ${API_BASE}`);
  console.log(`  App Domain : ${APP_DOMAIN}`);
  console.log(`  房源數     : ${PROPERTIES.length}`);
  console.log(`  預約數     : ${BOOKINGS.length}`);

  let created = 0, skipped = 0, failed = 0;

  // ── 1. 冪等檢查：是否已有 rhs-platform 資料 ──
  const existing = await queryRecords('product_templates', [
    { column: 'custom_data', op: 'ilike', value: `%app_domain%${APP_DOMAIN}%` },
  ], 1);
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`\n⚠️ 已存在 ${APP_DOMAIN} 的房源資料，跳過灌入以避免重複。`);
    console.log('  如需重新灌入，請先手動刪除現有資料。');
    return;
  }

  // ── 2. 注入房源 ──
  if (PROPERTIES.length > 0) {
    console.log('\n🏠 注入房源...');
    for (const prop of PROPERTIES) {
      try {
        const result = await createRecord('product_templates', prop);
        console.log(`  ✅ ${prop.name} — ID: ${result.id}`);
        created++;
      } catch (e) {
        console.log(`  ❌ ${prop.name} — ${e.message}`);
        failed++;
      }
    }
  }

  // ── 3. 注入預約/委託（可選）──
  if (BOOKINGS.length > 0) {
    console.log('\n📋 注入預約...');
    for (const booking of BOOKINGS) {
      try {
        const result = await createRecord('crm_leads', booking);
        console.log(`  ✅ ${booking.name} — ID: ${result.id}`);
        created++;
      } catch (e) {
        console.log(`  ❌ ${booking.name} — ${e.message}`);
        failed++;
      }
    }
  }

  // ── 4. 驗證 ──
  console.log('\n📊 驗證...');
  try {
    const props = await queryRecords('product_templates', [
      { column: 'custom_data', op: 'ilike', value: `%app_domain%${APP_DOMAIN}%` },
    ]);
    console.log(`  房源總數（${APP_DOMAIN}）：${props.length} 筆`);
  } catch (e) {
    console.log(`  ⚠️ 驗證查詢失敗：${e.message}`);
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(`📊 結果：${created} 建立 / ${skipped} 跳過 / ${failed} 失敗`);
  console.log('════════════════════════════════════════════════');

  if (failed > 0) process.exit(1);
  else console.log('\n✅ 所有資料注入成功！');
}

main().catch(e => {
  console.error('❌ 執行失敗:', e.message);
  process.exit(1);
});
