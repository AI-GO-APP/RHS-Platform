// src/js/login.js
import { register, login, isLoggedIn, getUserRole } from './api/auth.js';

// 如果已登入，直接跳轉
if (isLoggedIn()) {
  redirectAfterAuth();
}

// ──── Tab 切換 ────
const tabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`form-${tab.dataset.tab}`).classList.add('active');
    hideError();
  });
});

// ──── 角色選擇 ────
const roleOptions = document.querySelectorAll('.role-option');
roleOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    roleOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  });
});

// ──── 錯誤顯示 ────
const errorDiv = document.getElementById('auth-error');
function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.add('show');
}
function hideError() {
  errorDiv.classList.remove('show');
}

// ──── 按鈕載入狀態 ────
function setLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span class="loading-spinner"></span>處理中...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText;
  }
}

// ──── 登入 ────
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login');

  setLoading(btn, true);
  const result = await login(email, password);
  setLoading(btn, false);

  if (result.ok) {
    redirectAfterAuth();
  } else {
    const detail = result.data?.detail || '登入失敗，請檢查帳號密碼';
    showError(typeof detail === 'string' ? detail : '登入失敗，請檢查帳號密碼');
  }
});

// ──── 註冊 ────
document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const role = document.querySelector('input[name="role"]:checked').value;
  const btn = document.getElementById('btn-register');

  if (password.length < 6) {
    showError('密碼至少需要 6 個字元');
    return;
  }

  setLoading(btn, true);
  const result = await register(email, password, name, role);
  setLoading(btn, false);

  if (result.ok) {
    redirectAfterAuth();
  } else {
    const detail = result.data?.detail || '註冊失敗';
    if (typeof detail === 'string' && detail.includes('已被註冊')) {
      showError('此 Email 已被註冊，請直接登入');
    } else {
      showError(typeof detail === 'string' ? detail : '註冊失敗，請稍後再試');
    }
  }
});

// ──── 跳轉邏輯 ────
function redirectAfterAuth() {
  // 優先使用 redirect 參數
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (redirect) {
    window.location.href = decodeURIComponent(redirect);
    return;
  }

  // 根據角色跳轉
  const role = getUserRole();
  if (role === 'landlord') {
    window.location.href = '/landlord-service.html';
  } else {
    window.location.href = '/tenant-listing.html';
  }
}
