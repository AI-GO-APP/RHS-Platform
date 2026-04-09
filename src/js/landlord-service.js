// src/js/landlord-service.js — 房東服務頁（含委託表單）
import { renderNavbar, renderFooter } from './components.js';
import { isLoggedIn, requireAuth, getCachedUser } from './api/auth.js';
import { createCommission } from './api/bookings.js';

renderNavbar('landlord');
renderFooter();

// ──── 委託表單邏輯 ────
const form = document.getElementById('commission-form');
if (form) {
  // 預填登入用戶資訊
  if (isLoggedIn()) {
    const user = getCachedUser();
    if (user) {
      const nameInput = document.getElementById('c-name');
      const emailInput = document.getElementById('c-email');
      if (nameInput && user.display_name) nameInput.value = user.display_name;
      if (emailInput && user.email) emailInput.value = user.email;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 檢查登入
    if (!requireAuth()) return;

    const errorDiv = document.getElementById('commission-error');
    const successDiv = document.getElementById('commission-success');
    const btn = document.getElementById('btn-commission');

    const contactName = document.getElementById('c-name').value.trim();
    const phone = document.getElementById('c-phone').value.trim();
    const email = document.getElementById('c-email').value.trim();
    const address = document.getElementById('c-address').value.trim();
    const size = document.getElementById('c-size').value.trim();
    const condition = document.getElementById('c-condition').value;
    const expectedRent = document.getElementById('c-rent').value.trim();

    if (!contactName || !phone || !address) {
      errorDiv.textContent = '請填寫必要欄位';
      errorDiv.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = '送出中...';
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    const result = await createCommission({
      contactName,
      phone,
      email,
      propertyAddress: address,
      propertySize: size ? Number(size) : 0,
      currentCondition: condition,
      expectedRent: expectedRent ? Number(expectedRent) : 0,
    });

    if (result.ok) {
      successDiv.style.display = 'block';
      form.reset();
      btn.disabled = false;
      btn.textContent = '送出委託申請';
    } else {
      btn.disabled = false;
      btn.textContent = '送出委託申請';
      const detail = result.data?.detail || '送出失敗，請稍後再試';
      errorDiv.textContent = typeof detail === 'string' ? detail : '送出失敗';
      errorDiv.style.display = 'block';
    }
  });
}
