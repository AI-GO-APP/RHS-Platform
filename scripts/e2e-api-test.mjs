/**
 * RHS 平台 — E2E API 測試腳本
 *
 * 驗證目標租戶的所有 API 端點連通性與功能正確性
 * 執行：node scripts/e2e-api-test.mjs（或 npm test）
 * 前置：.env 已設定完整環境變數
 */
import 'dotenv/config';

const API_BASE = process.env.VITE_AIGO_API_BASE;
const API_KEY  = process.env.AIGO_API_KEY;
const APP_SLUG = process.env.VITE_AIGO_APP_SLUG;
const APP_DOMAIN = process.env.VITE_APP_DOMAIN || 'rhs-platform';

if (!API_BASE || !API_KEY || !APP_SLUG) {
  console.error('❌ 需要 VITE_AIGO_API_BASE、AIGO_API_KEY、VITE_AIGO_APP_SLUG');
  process.exit(1);
}

let passed = 0, failed = 0;
const results = [];

// ── 測試工具 ──

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: '✅' });
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    results.push({ name, status: '❌', error: e.message });
    console.log(`  ❌ ${name} — ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ── 通用 fetch ──

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

// ============================================================
// 測試群組
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  RHS 平台 — E2E API 測試                     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n  API Base   : ${API_BASE}`);
  console.log(`  App Slug   : ${APP_SLUG}`);
  console.log(`  App Domain : ${APP_DOMAIN}\n`);

  // ── 1. Custom App Auth ──
  console.log('\n📋 Custom App Auth');
  const testEmail = `e2e-test-${Date.now()}@rhs-test.com`;
  const testPassword = 'TestPass1234!';
  let accessToken = null;
  let refreshTokenVal = null;

  await test('Register（註冊測試用戶）', async () => {
    const r = await apiFetch(`/custom-app-auth/${APP_SLUG}/register`, {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, password: testPassword, display_name: 'E2E Test' }),
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`);
    assert(r.data.access_token, '回傳缺少 access_token');
    assert(r.data.refresh_token, '回傳缺少 refresh_token');
    accessToken = r.data.access_token;
    refreshTokenVal = r.data.refresh_token;
  });

  await test('Login（登入測試用戶）', async () => {
    const r = await apiFetch(`/custom-app-auth/${APP_SLUG}/login`, {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert(r.ok, `HTTP ${r.status}`);
    assert(r.data.access_token, '回傳缺少 access_token');
    accessToken = r.data.access_token;
    refreshTokenVal = r.data.refresh_token;
  });

  await test('Me（取得目前用戶）', async () => {
    const r = await apiFetch(`/custom-app-auth/${APP_SLUG}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert(r.ok, `HTTP ${r.status}`);
    assert(r.data.email === testEmail, `Email 不匹配: ${r.data.email}`);
  });

  await test('Refresh（Token 刷新）', async () => {
    const r = await apiFetch(`/custom-app-auth/${APP_SLUG}/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshTokenVal }),
    });
    assert(r.ok, `HTTP ${r.status}`);
    assert(r.data.access_token, '回傳缺少 access_token');
    accessToken = r.data.access_token;
    refreshTokenVal = r.data.refresh_token;
  });

  // ── 2. Open Proxy（API Key）──
  console.log('\n📋 Open Proxy（API Key）');

  await test('Open Proxy — product_templates 讀取', async () => {
    const r = await apiFetch('/open/proxy/product_templates?limit=5', {
      headers: { 'X-API-Key': API_KEY },
    });
    assert(r.ok, `HTTP ${r.status}`);
    assert(Array.isArray(r.data), '回傳不是陣列');
  });

  await test('Open Proxy — crm_leads 讀取', async () => {
    const r = await apiFetch('/open/proxy/crm_leads?limit=5', {
      headers: { 'X-API-Key': API_KEY },
    });
    assert(r.ok, `HTTP ${r.status}`);
    assert(Array.isArray(r.data), '回傳不是陣列');
  });

  // ── 3. Proxy Query（進階查詢 + domain 過濾）──
  console.log('\n📋 Proxy Query（進階查詢）');

  await test('POST /query — domain 過濾', async () => {
    const r = await apiFetch('/open/proxy/product_templates/query', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY },
      body: JSON.stringify({
        filters: [
          { column: 'custom_data', op: 'ilike', value: `%app_domain%${APP_DOMAIN}%` },
        ],
        limit: 10,
      }),
    });
    assert(r.ok, `HTTP ${r.status}`);
    assert(Array.isArray(r.data), '回傳不是陣列');
    console.log(`         → 找到 ${r.data.length} 筆 ${APP_DOMAIN} 房源`);
  });

  await test('POST /query — 排序驗證', async () => {
    const r = await apiFetch('/open/proxy/product_templates/query', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY },
      body: JSON.stringify({
        filters: [
          { column: 'custom_data', op: 'ilike', value: `%app_domain%${APP_DOMAIN}%` },
        ],
        order_by: [{ column: 'list_price', direction: 'desc' }],
        limit: 10,
      }),
    });
    assert(r.ok, `HTTP ${r.status}`);
    if (r.data.length >= 2) {
      assert(r.data[0].list_price >= r.data[1].list_price, '排序不正確');
    }
  });

  // ── 4. Ext Proxy（Bearer Token）──
  console.log('\n📋 Ext Proxy（Bearer Token）');

  await test('Ext Proxy — product_templates 讀取', async () => {
    const r = await apiFetch('/ext/proxy/product_templates/query', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        filters: [
          { column: 'custom_data', op: 'ilike', value: `%app_domain%${APP_DOMAIN}%` },
        ],
        limit: 5,
      }),
    });
    assert(r.ok, `HTTP ${r.status}`);
  });

  // crm_leads 建立測試
  let testLeadId = null;
  await test('Ext Proxy — crm_leads 建立（預約看房）', async () => {
    const r = await apiFetch('/ext/proxy/crm_leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        type: 'opportunity',
        name: `E2E 測試預約 — ${Date.now()}`,
        contact_name: 'E2E Test User',
        phone: '0900-000-000',
        email_from: testEmail,
        custom_data: {
          app_domain: APP_DOMAIN,
          booking_type: 'viewing',
          message: 'E2E 自動測試產生',
        },
      }),
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data).substring(0, 100)}`);
    testLeadId = r.data.id || (r.data.data && r.data.data.id);
    assert(testLeadId, '回傳缺少 id');
  });

  await test('Ext Proxy — crm_leads 查詢', async () => {
    const r = await apiFetch('/ext/proxy/crm_leads/query', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        filters: [
          { column: 'custom_data', op: 'ilike', value: `%app_domain%${APP_DOMAIN}%` },
        ],
        limit: 5,
      }),
    });
    assert(r.ok, `HTTP ${r.status}`);
    assert(Array.isArray(r.data), '回傳不是陣列');
  });

  // ── 5. Logout ──
  console.log('\n📋 Logout');

  await test('Logout（登出）', async () => {
    const r = await apiFetch(`/custom-app-auth/${APP_SLUG}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ refresh_token: refreshTokenVal }),
    });
    // Logout 可能回傳 200 或 204
    assert(r.status === 200 || r.status === 204, `HTTP ${r.status}`);
  });

  // ── 結果 ──
  console.log('\n════════════════════════════════════════════════');
  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║  結果：${passed} 通過 / ${failed} 失敗${' '.repeat(Math.max(0, 28 - String(passed).length - String(failed).length))}║`);
  console.log(`╚══════════════════════════════════════════════╝`);

  if (failed > 0) {
    console.log('\n❌ 失敗的測試：');
    results.filter(r => r.status === '❌').forEach(r => {
      console.log(`  ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ 所有測試通過！');
  }
}

main().catch(e => {
  console.error('❌ 測試執行失敗:', e.message);
  process.exit(1);
});
