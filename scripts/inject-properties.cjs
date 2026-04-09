/**
 * 灌入初始房源假資料至 AI GO product_templates
 * 透過 Open Proxy + API Key
 * 
 * 用法：node scripts/inject-properties.cjs
 */
require('dotenv').config();

const API_BASE = process.env.VITE_AIGO_API_BASE;
const API_KEY = process.env.VITE_AIGO_API_KEY;
const APP_DOMAIN = process.env.VITE_APP_DOMAIN || 'rhs-platform';

const properties = [
  {
    name: '信義區 靜謐極簡高樓套房',
    list_price: 28000,
    active: true,
    type: 'service',
    invoice_policy: 'order',
    custom_data: {
      app_domain: APP_DOMAIN,
      property_type: '獨立套房',
      location: '台北市信義區松智路',
      size: 12,
      floor: '15F',
      images: ['/images/listing1.png'],
      amenities: ['冷氣', '洗衣機', '冰箱', '電子鎖', '光纖寬頻'],
      description: '本物件由專業團隊重新打造，採用極簡風設計，全室鋪設優質木地板。大面採光落地窗讓您擁有絕佳的都市視野與自然採光。',
    },
  },
  {
    name: '大安區 陽光大客廳兩房',
    list_price: 45000,
    active: true,
    type: 'service',
    invoice_policy: 'order',
    custom_data: {
      app_domain: APP_DOMAIN,
      property_type: '兩房一廳',
      location: '台北市大安區和平東路',
      size: 25,
      floor: '8F',
      images: ['/images/hero.png'],
      amenities: ['冷氣', '洗衣機', '冰箱', '電子鎖', '光纖寬頻', '獨立衛浴', '陽台'],
      description: '寬敞明亮的大客廳空間，採光絕佳，適合小家庭或注重生活品質的您。社區管理完善，近捷運站與公園。',
    },
  },
  {
    name: '中山區 全新翻修極簡風',
    list_price: 32000,
    active: true,
    type: 'service',
    invoice_policy: 'order',
    custom_data: {
      app_domain: APP_DOMAIN,
      property_type: '一房一廳',
      location: '台北市中山區林森北路',
      size: 15,
      floor: '6F',
      images: ['/images/after.png'],
      amenities: ['冷氣', '洗衣機', '冰箱', '電子鎖', '光纖寬頻', '電磁爐'],
      description: '全新翻修完成，極簡風格設計，乾淨俐落。近中山站商圈，生活機能極佳。',
    },
  },
  {
    name: '中正區 復古風質感洋房',
    list_price: 36000,
    active: true,
    type: 'service',
    invoice_policy: 'order',
    custom_data: {
      app_domain: APP_DOMAIN,
      property_type: '一房一廳',
      location: '台北市中正區重慶南路',
      size: 18,
      floor: '3F',
      images: ['/images/before.png'],
      amenities: ['冷氣', '洗衣機', '冰箱', '瓦斯爐', '有線電視'],
      description: '充滿歷史韻味的質感洋房，高挑天花板與大窗戶帶來通透感。鄰近博愛特區與植物園，文教氣息濃厚。',
    },
  },
];

async function main() {
  console.log(`\n灌入 ${properties.length} 筆房源至 AI GO...`);
  console.log(`API: ${API_BASE}/open/proxy/product_templates`);
  console.log(`Domain: ${APP_DOMAIN}\n`);

  // 先檢查是否已有資料
  const checkRes = await fetch(`${API_BASE}/open/proxy/product_templates/query`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: [
        { column: 'custom_data', op: 'ilike', value: `%app_domain%${APP_DOMAIN}%` },
      ],
      limit: 1,
    }),
  });
  
  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`⚠️ 已存在 ${APP_DOMAIN} 的房源資料，跳過灌入以避免重複。`);
      console.log('如需重新灌入，請先手動刪除現有資料。');
      return;
    }
  }

  for (const prop of properties) {
    try {
      const res = await fetch(`${API_BASE}/open/proxy/product_templates`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(prop),
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log(`  ✅ ${prop.name} → id: ${data.id || data.data?.id || '(created)'}`);
      } else {
        const err = await res.text();
        console.log(`  ❌ ${prop.name}: ${res.status} ${err}`);
      }
    } catch (e) {
      console.error(`  ❌ ${prop.name}: ${e.message}`);
    }
  }

  console.log('\n✅ 灌入完成！');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
