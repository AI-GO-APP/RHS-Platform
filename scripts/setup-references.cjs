/**
 * AI GO References 自動設定腳本（參照 Booking Platform）
 * 
 * 用法：node scripts/setup-references.cjs
 */
require('dotenv').config();
const fs = require('fs');

const API_BASE = process.env.VITE_AIGO_API_BASE || 'https://ai-go.app/api/v1';
const API_KEY = process.env.VITE_AIGO_API_KEY;
const APP_SLUG = process.env.VITE_AIGO_APP_SLUG || '6d767888869d';
const BUILDER_EMAIL = 'playground-super-admin@ai-go.app';
const BUILDER_PASSWORD = 'playground-super-admin1234!';

async function api(method, path, body = null, headers = {}) {
  const url = `${API_BASE}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ok: res.ok };
}

async function main() {
  const results = {};

  // === 1. Builder 登入 ===
  console.log('\n=== Step 1: Builder 登入 ===');
  const login = await api('POST', '/auth/login', {
    email: BUILDER_EMAIL,
    password: BUILDER_PASSWORD,
  });

  if (!login.ok) {
    console.error('  ❌ Builder 登入失敗:', login.status, JSON.stringify(login.data));
    process.exit(1);
  }
  const JWT = login.data.access_token;
  const auth = { 'Authorization': `Bearer ${JWT}` };
  console.log('  ✅ Builder 登入成功');

  // === 2. 取得 app_id ===
  console.log('\n=== Step 2: 取得整合資訊 ===');
  const intRes = await api('GET', '/integrations', null, auth);
  if (!intRes.ok) {
    console.error('  ❌ 取得整合列表失敗:', intRes.status, JSON.stringify(intRes.data));
    process.exit(1);
  }

  const integrations = intRes.data;
  console.log(`  找到 ${integrations.length} 個整合`);
  const app = integrations.find(i => i.slug === APP_SLUG);
  if (!app) {
    console.error(`  ❌ 未找到 slug=${APP_SLUG} 的整合`);
    console.log('  可用的 slug:', integrations.map(i => `${i.slug} (${i.name})`).join(', '));
    process.exit(1);
  }
  const APP_ID = app.id;
  console.log(`  ✅ 找到 App: ${app.name} (id: ${APP_ID})`);
  results.app = { id: APP_ID, name: app.name, slug: app.slug };

  // === 3. 設定 allowed_origins ===
  console.log('\n=== Step 3: 設定 allowed_origins ===');
  const settingsR = await api('PATCH', `/integrations/${APP_ID}/settings`, {
    allowed_origins: ['http://localhost:5181'],
  }, auth);
  console.log(`  ${settingsR.ok ? '✅' : '⚠️'} Settings: ${settingsR.status}`);
  results.settings = { status: settingsR.status, ok: settingsR.ok };

  // === 4. 查看現有引用 ===
  console.log('\n=== Step 4: 檢查現有引用 ===');
  const existingRefsRes = await api('GET', `/refs/apps/${APP_ID}`, null, auth);
  const existingTables = [];
  if (existingRefsRes.ok && Array.isArray(existingRefsRes.data)) {
    existingRefsRes.data.forEach(r => existingTables.push(r.table_name));
  }
  console.log('  現有引用:', existingTables.join(', ') || '(無)');

  // === 5. 建立引用 ===
  const refs = [
    {
      table_name: 'product_templates',
      columns: ['id', 'name', 'list_price', 'active', 'type', 'invoice_policy', 'custom_data', 'created_at'],
      permissions: ['read', 'create', 'update'],
    },
    {
      table_name: 'crm_leads',
      columns: ['id', 'type', 'name', 'contact_name', 'phone', 'email_from', 'priority', 'custom_data', 'created_at'],
      permissions: ['read', 'create', 'update'],
    },
  ];

  results.ref_results = [];
  for (const ref of refs) {
    if (existingTables.includes(ref.table_name)) {
      console.log(`  ✅ ${ref.table_name} 已存在，跳過`);
      results.ref_results.push({ table: ref.table_name, action: 'skipped' });
      continue;
    }
    const r = await api('POST', `/refs/apps/${APP_ID}`, ref, auth);
    console.log(`  ${r.ok ? '✅' : '❌'} ${ref.table_name}: ${r.status} ${r.ok ? 'OK' : JSON.stringify(r.data)}`);
    results.ref_results.push({ table: ref.table_name, status: r.status, ok: r.ok, error: r.ok ? null : r.data });
  }

  // === 6. 發布引用 ===
  console.log('\n=== Step 5: 發布引用設定 ===');
  const pubR = await api('POST', `/integrations/${APP_ID}/publish`, {
    note: 'RHS Platform: product_templates + crm_leads',
  }, auth);
  console.log(`  ${pubR.ok ? '✅' : '⚠️'} Publish: ${pubR.status} ${pubR.ok ? 'OK' : JSON.stringify(pubR.data)}`);
  results.publish = { status: pubR.status, ok: pubR.ok, data: pubR.data };

  // === 7. 驗證 Open Proxy ===
  console.log('\n=== Step 6: 驗證 Open Proxy ===');
  const apiKey = { 'X-API-Key': API_KEY };
  for (const table of ['product_templates', 'crm_leads']) {
    const r = await api('GET', `/open/proxy/${table}?limit=1`, null, apiKey);
    console.log(`  ${r.ok ? '✅' : '❌'} Open Proxy ${table}: ${r.status}`);
    results[`verify_${table}`] = { status: r.status, ok: r.ok };
  }

  fs.writeFileSync('scripts/setup-results.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n✅ 完成！結果: scripts/setup-results.json');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
