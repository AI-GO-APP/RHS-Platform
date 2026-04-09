// src/js/tenant-listing.js
import { renderNavbar, renderFooter } from './components.js';
import { fetchAllProperties, searchProperties } from './api/properties.js';

renderNavbar('listing');
renderFooter();

const grid = document.getElementById('property-grid');

// ──── 渲染房源卡片 ────
function renderProperties(properties) {
  grid.innerHTML = '';
  if (properties.length === 0) {
    grid.innerHTML = '<p class="text-muted">找不到符合條件的房源。</p>';
    return;
  }
  
  properties.forEach(prop => {
    const card = document.createElement('a');
    card.href = `/tenant-detail.html?id=${prop.id}`;
    card.className = 'card';
    card.style.textDecoration = 'none';
    card.style.color = 'inherit';
    
    card.innerHTML = `
      <div style="height:250px; background:url('${prop.image}') center/cover"></div>
      <div style="padding:var(--space-lg)">
        <h3 style="margin-bottom:var(--space-xs)">${prop.title}</h3>
        <p class="text-muted" style="font-size:0.9rem; margin-bottom:var(--space-md)">${prop.location} • ${prop.size} 坪 • ${prop.type}</p>
        <div class="flex justify-between items-center">
          <span class="text-primary" style="font-weight:bold; font-size:1.25rem;">NT$ ${prop.price.toLocaleString()} / 月</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ──── 載入房源（免登入，走 Open Proxy 中轉）────
async function loadProperties() {
  grid.innerHTML = '<p class="text-muted">載入中...</p>';
  const result = await fetchAllProperties();
  
  if (result.ok) {
    renderProperties(result.data);
  } else {
    grid.innerHTML = '<p class="text-muted">無法載入房源資料，請稍後再試。</p>';
    console.error('[Listing] 載入失敗:', result);
  }
}

// ──── 篩選邏輯 ────
document.getElementById('search-btn').addEventListener('click', async () => {
  const keyword = document.getElementById('search-keyword').value;
  const typeFilter = document.getElementById('search-type').value;
  
  grid.innerHTML = '<p class="text-muted">搜尋中...</p>';
  const result = await searchProperties(keyword, typeFilter);
  
  if (result.ok) {
    renderProperties(result.data);
  } else {
    grid.innerHTML = '<p class="text-muted">搜尋失敗，請稍後再試。</p>';
  }
});

// 初始化
loadProperties();
