/**
 * 房源 API 模組
 * 從 AI GO product_templates (type=service) 讀取房源資料
 * 
 * 走 Open Proxy（Vite dev proxy 自動注入 API Key），免登入可瀏覽
 * 
 * 系統表映射：
 * - name → 標題（如「信義區 靜謐極簡高樓套房」）
 * - list_price → 月租金
 * - active → 是否上架
 * - type → 'service'（房屋出租）
 * - custom_data.location → 地址
 * - custom_data.size → 坪數
 * - custom_data.property_type → 房型（獨立套房 / 一房一廳 / 兩房一廳）
 * - custom_data.images → 圖片陣列
 * - custom_data.floor → 樓層
 * - custom_data.amenities → 設備列表
 * - custom_data.description → 房屋介紹
 * - custom_data.app_domain → 'rhs-platform'
 */
import { apiRequest, OPEN_PROXY_PREFIX } from './config.js';
import { domainFilter } from './domain.js';

/**
 * 將 AI GO product_template 記錄轉換為前端房源格式
 */
function transformProperty(p) {
  const cd = (typeof p.custom_data === 'string') ? JSON.parse(p.custom_data) : (p.custom_data || {});
  return {
    id: p.id,
    title: p.name,
    price: Number(p.list_price) || 0,
    active: p.active,
    location: cd.location || '',
    size: cd.size || 0,
    type: cd.property_type || '',
    floor: cd.floor || '',
    images: cd.images || [],
    image: (cd.images && cd.images[0]) || '/images/listing1.png',
    amenities: cd.amenities || [],
    description: cd.description || '',
    createdAt: p.created_at,
  };
}

// ──── 快取 ────
let _propertiesCache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

function isCacheValid() {
  return _propertiesCache && (Date.now() - _cacheTime < CACHE_TTL);
}

/**
 * 取得所有上架房源（免登入，走 Open Proxy 中轉）
 */
export async function fetchAllProperties() {
  if (isCacheValid()) return { ok: true, data: _propertiesCache };

  const r = await apiRequest('POST', `${OPEN_PROXY_PREFIX}/product_templates/query`, {
    filters: [
      { column: 'type', op: 'eq', value: 'service' },
      { column: 'active', op: 'eq', value: true },
      domainFilter(),
    ],
    order_by: [{ column: 'list_price', direction: 'asc' }],
    limit: 50,
  });

  if (r.ok && Array.isArray(r.data)) {
    _propertiesCache = r.data.map(transformProperty);
    _cacheTime = Date.now();
    return { ok: true, data: _propertiesCache };
  }
  return { ok: false, status: r.status, data: r.data };
}

/**
 * 以 ID 取得單一房源
 */
export async function fetchPropertyById(id) {
  // 先試快取
  if (isCacheValid()) {
    const found = _propertiesCache.find(p => p.id === id);
    if (found) return { ok: true, data: found };
  }

  const r = await apiRequest('POST', `${OPEN_PROXY_PREFIX}/product_templates/query`, {
    filters: [
      { column: 'id', op: 'eq', value: id },
      domainFilter(),
    ],
    limit: 1,
  });

  if (r.ok && Array.isArray(r.data) && r.data.length > 0) {
    return { ok: true, data: transformProperty(r.data[0]) };
  }
  return { ok: false, status: r.status, data: null };
}

/**
 * 搜尋房源（關鍵字 + 房型篩選）
 */
export async function searchProperties(keyword = '', typeFilter = '') {
  const all = await fetchAllProperties();
  if (!all.ok) return all;

  let filtered = all.data;

  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(kw) ||
      p.location.toLowerCase().includes(kw)
    );
  }

  if (typeFilter && typeFilter !== '不限房型') {
    filtered = filtered.filter(p => p.type === typeFilter);
  }

  return { ok: true, data: filtered };
}

/**
 * 清除快取
 */
export function clearPropertiesCache() {
  _propertiesCache = null;
  _cacheTime = 0;
}
