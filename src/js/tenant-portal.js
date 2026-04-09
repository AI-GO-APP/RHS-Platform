// src/js/tenant-portal.js
import { renderNavbar, renderFooter } from './components.js';
import { requireAuth } from './api/auth.js';
import { fetchMyBookings } from './api/bookings.js';

renderNavbar('portal');
renderFooter();

// 需登入才能查看
if (!requireAuth()) {
  // requireAuth 會自動跳轉到登入頁，此處不再執行
} else {
  initPortal();
}

async function initPortal() {
  const activeBookingsContainer = document.getElementById('active-bookings');
  const timelineContainer = document.getElementById('timeline-detail');

  // 移除靜態 demo 資料
  const demoBooking = document.getElementById('demo-booking');
  if (demoBooking) demoBooking.remove();

  // 載入預約資料
  activeBookingsContainer.innerHTML = '<h3 style="margin-bottom:var(--space-lg)">進行中的案件</h3><p class="text-muted">載入中...</p>';

  const result = await fetchMyBookings();

  if (!result.ok) {
    activeBookingsContainer.innerHTML = '<h3 style="margin-bottom:var(--space-lg)">進行中的案件</h3><p class="text-muted">載入失敗，請稍後再試。</p>';
    return;
  }

  const bookings = result.data;
  
  // 清空並重建
  activeBookingsContainer.innerHTML = '<h3 style="margin-bottom:var(--space-lg)">進行中的案件</h3>';

  if (bookings.length === 0) {
    activeBookingsContainer.innerHTML += '<p class="text-muted">目前沒有進行中的案件</p>';
    return;
  }

  // 渲染案件列表
  bookings.forEach((booking, index) => {
    const statusMap = {
      pending: { label: '預約確認中', class: 'status-processing' },
      confirmed: { label: '已確認', class: 'status-success' },
      viewed: { label: '已看房', class: 'status-success' },
      signed: { label: '已簽約', class: 'status-success' },
    };
    const status = statusMap[booking.bookingStatus] || statusMap.pending;
    const createdDate = new Date(booking.createdAt).toLocaleString('zh-TW', { hour12: false });

    const cardHTML = `
      <div class="card booking-card" data-index="${index}" style="padding:var(--space-md); margin-bottom:var(--space-md); border-color:${index === 0 ? 'var(--color-primary)' : 'var(--color-border)'}; cursor:pointer;">
        <div class="flex justify-between items-center" style="margin-bottom:var(--space-sm)">
          <span class="status-badge ${status.class}">${status.label}</span>
          <span class="text-muted" style="font-size:0.8rem">${booking.id.substring(0, 8)}</span>
        </div>
        <h4 style="margin-bottom:4px">${booking.propertyTitle || booking.name}</h4>
        <p class="text-muted" style="font-size:0.9rem">賞屋預約 ${booking.preferredTime ? `(${booking.preferredTime})` : ''} - ${booking.contactName}</p>
        <p class="text-muted" style="font-size:0.8rem; margin-top:4px">申請時間：${createdDate}</p>
      </div>
    `;
    activeBookingsContainer.insertAdjacentHTML('beforeend', cardHTML);
  });

  // 預設顯示第一筆的時間軸
  if (bookings.length > 0 && timelineContainer) {
    renderTimeline(bookings[0], timelineContainer);
  }

  // 點擊切換時間軸
  document.querySelectorAll('.booking-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index);
      if (timelineContainer && bookings[idx]) {
        renderTimeline(bookings[idx], timelineContainer);
      }
    });
  });
}

function renderTimeline(booking, container) {
  const createdDate = new Date(booking.createdAt).toLocaleString('zh-TW', { hour12: false });
  
  container.innerHTML = `
    <div class="card" style="padding:var(--space-xl)">
      <h2 style="margin-bottom:var(--space-md)">案件進度追蹤：賞屋預約</h2>
      <p class="text-muted">物件：${booking.propertyTitle || booking.name}</p>
      
      <div class="tracking-timeline">
        <div class="track-item">
          <div class="track-date">即將進行</div>
          <div class="track-title text-muted">業務帶看賞屋</div>
          <p class="text-muted" style="font-size:0.9rem">待時間確認後安排專屬顧問帶您參觀。</p>
        </div>
        <div class="track-item active">
          <div class="track-date">處理中</div>
          <div class="track-title">客服審核預約時間</div>
          <p class="text-muted" style="font-size:0.9rem">我們正在與屋主及顧問協調您偏好的「${booking.preferredTime || '未指定'}」時段，預計 24 小時內通知您。</p>
        </div>
        <div class="track-item">
          <div class="track-date">${createdDate}</div>
          <div class="track-title">線上送出預約申請</div>
          <p class="text-muted" style="font-size:0.9rem">系統已成功接收您的賞屋預約單。</p>
        </div>
      </div>

      <div style="margin-top:var(--space-xl); padding-top:var(--space-lg); border-top:1px solid var(--color-border)">
        <h4 style="margin-bottom:var(--space-sm)">專屬顧問聯絡資訊</h4>
        <p class="text-muted" style="font-size:0.9rem">林專員 (0912-345-678)</p>
      </div>
    </div>
  `;
}
