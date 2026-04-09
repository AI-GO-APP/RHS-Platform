// src/js/tenant-detail.js
import { renderNavbar, renderFooter } from './components.js';
import { fetchPropertyById } from './api/properties.js';
import { createBooking } from './api/bookings.js';
import { isLoggedIn, requireAuth, getCachedUser } from './api/auth.js';

renderNavbar();
renderFooter();

// ──── 從 URL 取得物件 ID ────
const params = new URLSearchParams(window.location.search);
const propertyId = params.get('id');

const detailContainer = document.getElementById('property-detail');
const heroEl = document.querySelector('.property-hero');

let currentProperty = null;

// ──── 載入物件詳情（免登入，走 Open Proxy）────
async function loadPropertyDetail() {
  if (!propertyId) {
    detailContainer.innerHTML = '<p class="text-muted">未指定物件 ID。</p>';
    return;
  }

  const result = await fetchPropertyById(propertyId);
  if (!result.ok || !result.data) {
    detailContainer.innerHTML = '<p class="text-muted">找不到此物件，可能已下架。</p>';
    return;
  }

  currentProperty = result.data;
  renderDetail(currentProperty);
}

// ──── 渲染物件詳情 ────
function renderDetail(prop) {
  // 更新頁面標題
  document.title = `${prop.title} - 示範包租代管`;

  // 更新英雄圖
  if (heroEl) {
    heroEl.style.backgroundImage = `url('${prop.image}')`;
  }

  detailContainer.innerHTML = `
    <div class="container grid" style="grid-template-columns: 2fr 1fr; gap:var(--space-2xl);">
      <!-- 左側詳情 -->
      <div>
        <h1 style="font-size:2.5rem; margin-bottom:var(--space-sm)">${prop.title}</h1>
        <p class="text-muted" style="margin-bottom:var(--space-xl)">${prop.location}</p>
        
        <div class="flex gap-lg" style="margin-bottom:var(--space-xl); border-top:1px solid var(--color-border); border-bottom:1px solid var(--color-border); padding:var(--space-md) 0;">
          <div>
            <span class="text-muted" style="font-size:0.9rem">坪數</span><br>
            <strong>${prop.size} 坪</strong>
          </div>
          <div>
            <span class="text-muted" style="font-size:0.9rem">格局</span><br>
            <strong>${prop.type}</strong>
          </div>
          <div>
            <span class="text-muted" style="font-size:0.9rem">樓層</span><br>
            <strong>${prop.floor || '-'}</strong>
          </div>
        </div>

        ${prop.description ? `
          <h3 style="margin-bottom:var(--space-md)">房屋介紹</h3>
          <p class="text-muted" style="margin-bottom:var(--space-xl); line-height:1.8;">${prop.description}</p>
        ` : ''}

        ${prop.amenities.length > 0 ? `
          <h3 style="margin-bottom:var(--space-md)">提供設備</h3>
          <ul class="grid grid-cols-2 gap-sm text-muted">
            ${prop.amenities.map(a => `<li>✓ ${a}</li>`).join('')}
          </ul>
        ` : ''}
      </div>

      <!-- 右側預約表單 -->
      <div>
        <div class="card" style="position:sticky; top:100px; padding:var(--space-xl)">
          <div style="font-size:1.5rem; font-weight:bold; color:var(--color-primary); margin-bottom:var(--space-md)">NT$ ${prop.price.toLocaleString()} / 月</div>
          <p class="text-muted" style="font-size:0.9rem; margin-bottom:var(--space-lg)">含管理費・最短租期 1 年</p>

          <h3 style="margin-bottom:var(--space-md)">線上預約賞屋</h3>
          <form id="booking-form">
            <input type="text" id="b-name" class="input" placeholder="您的姓名" style="margin-bottom:var(--space-md)" required>
            <input type="tel" id="b-phone" class="input" placeholder="聯絡電話" style="margin-bottom:var(--space-md)" required>
            <input type="email" id="b-email" class="input" placeholder="電子郵件" style="margin-bottom:var(--space-md)">
            <select id="b-time" class="input" style="margin-bottom:var(--space-md)">
              <option value="">希望賞屋時段</option>
              <option value="平日白天">平日白天</option>
              <option value="平日晚上">平日晚上</option>
              <option value="假日">假日</option>
            </select>
            <div id="booking-error" class="text-muted" style="color:#DC2626; font-size:0.9rem; margin-bottom:var(--space-md); display:none;"></div>
            <button type="submit" id="btn-booking" class="btn btn-primary" style="width:100%">送出預約申請</button>
          </form>
          <p class="text-muted" style="font-size:0.8rem; margin-top:var(--space-sm); text-align:center;">送出後您可在「我的預約進度」看板隨時查看審核與安排時間。</p>
        </div>
      </div>
    </div>
  `;

  // 預填登入用戶資訊
  if (isLoggedIn()) {
    const user = getCachedUser();
    if (user) {
      const emailInput = document.getElementById('b-email');
      const nameInput = document.getElementById('b-name');
      if (emailInput && user.email) emailInput.value = user.email;
      if (nameInput && user.display_name) nameInput.value = user.display_name;
    }
  }

  // 綁定預約表單事件
  setupBookingForm();
}

// ──── 預約表單送出 ────
function setupBookingForm() {
  const form = document.getElementById('booking-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 檢查登入狀態
    if (!isLoggedIn()) {
      requireAuth();
      return;
    }

    const errorDiv = document.getElementById('booking-error');
    const btn = document.getElementById('btn-booking');
    
    const name = document.getElementById('b-name').value.trim();
    const phone = document.getElementById('b-phone').value.trim();
    const email = document.getElementById('b-email').value.trim();
    const time = document.getElementById('b-time').value;

    // 簡易驗證
    if (!name || !phone) {
      errorDiv.textContent = '請填寫姓名與電話';
      errorDiv.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = '送出中...';
    errorDiv.style.display = 'none';

    const result = await createBooking({
      propertyId: currentProperty.id,
      propertyTitle: currentProperty.title,
      contactName: name,
      phone,
      email,
      preferredTime: time,
    });

    if (result.ok) {
      window.location.href = '/tenant-portal.html';
    } else {
      btn.disabled = false;
      btn.textContent = '送出預約申請';
      const detail = result.data?.detail || '送出失敗，請稍後再試';
      errorDiv.textContent = typeof detail === 'string' ? detail : '送出失敗，請稍後再試';
      errorDiv.style.display = 'block';
    }
  });
}

// 初始化
loadPropertyDetail();
