/**
 * AI GO 認證模組（參照 Booking Platform）
 * 使用 Independent 模式的 Custom App User 認證
 * 
 * 端點透過 Vite proxy 中轉：
 * - 註冊：POST /api/custom-app-auth/{slug}/register
 * - 登入：POST /api/custom-app-auth/{slug}/login
 * - 用戶：GET  /api/custom-app-auth/{slug}/me
 * - 刷新：POST /api/custom-app-auth/{slug}/refresh
 * - 登出：POST /api/custom-app-auth/{slug}/logout
 */
import { apiRequest, AUTH_PREFIX, EXT_PROXY_PREFIX } from './config.js';

// ──── localStorage key 常數 ────
const TOKEN_KEY = 'rhs_access_token';
const REFRESH_KEY = 'rhs_refresh_token';
const USER_KEY = 'rhs_user';
const EXPIRES_KEY = 'rhs_token_expires';

// ──── 內部工具 ────
function saveTokens(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  // 記錄到期時間（提前 60 秒失效以確保安全）
  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  localStorage.setItem(EXPIRES_KEY, String(expiresAt));
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

/** 發送 Auth 變更事件給 Navbar 等 UI 元件 */
export function dispatchAuthEvent() {
  window.dispatchEvent(new Event('authChange'));
}

// ──── 公開 API ────

/**
 * 刷新 Token（Token Rotation：舊 refresh_token 立即失效）
 */
export async function refreshToken() {
  const refreshTk = localStorage.getItem(REFRESH_KEY);
  if (!refreshTk) {
    clearTokens();
    return false;
  }
  const r = await apiRequest('POST', `${AUTH_PREFIX}/refresh`, {
    refresh_token: refreshTk,
  });
  if (r.ok) {
    saveTokens(r.data);
    return true;
  } else {
    clearTokens();
    return false;
  }
}

/**
 * 取得當前有效的 Token（若即將過期自動刷新）
 */
export async function getValidToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const expStr = localStorage.getItem(EXPIRES_KEY);
  if (expStr && Date.now() > parseInt(expStr, 10)) {
    console.debug('[Auth] Token 即將過期，自動刷新...');
    const refreshed = await refreshToken();
    return refreshed ? localStorage.getItem(TOKEN_KEY) : null;
  }
  return token;
}

/**
 * 註冊新用戶
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @param {string} role - 'landlord' 或 'tenant'
 */
export async function register(email, password, displayName, role = 'tenant') {
  const r = await apiRequest('POST', `${AUTH_PREFIX}/register`, {
    email,
    password,
    display_name: displayName,
  });
  if (r.ok) {
    saveTokens(r.data);
    // 將角色資訊寫入 user 快取
    if (r.data.user) {
      r.data.user.extra_data = { ...r.data.user.extra_data, role };
      localStorage.setItem(USER_KEY, JSON.stringify(r.data.user));
    }
    dispatchAuthEvent();
  }
  return r;
}

/**
 * 用戶登入
 */
export async function login(email, password) {
  const r = await apiRequest('POST', `${AUTH_PREFIX}/login`, { email, password });
  if (r.ok) {
    saveTokens(r.data);
    dispatchAuthEvent();
  }
  return r;
}

/**
 * 取得當前用戶資訊並更新快取
 */
export async function getMe() {
  const token = await getValidToken();
  if (!token) return { ok: false, status: 401, data: null };
  const r = await apiRequest('GET', `${AUTH_PREFIX}/me`, null, {
    'Authorization': `Bearer ${token}`,
  });
  if (r.ok) {
    localStorage.setItem(USER_KEY, JSON.stringify(r.data));
  } else if (r.status === 401) {
    clearTokens();
    dispatchAuthEvent();
  }
  return r;
}

/**
 * 登出
 */
export async function logout() {
  const token = localStorage.getItem(TOKEN_KEY);
  const refreshTk = localStorage.getItem(REFRESH_KEY);
  if (token && refreshTk) {
    try {
      await apiRequest('POST', `${AUTH_PREFIX}/logout`, {
        refresh_token: refreshTk,
      }, {
        'Authorization': `Bearer ${token}`,
      });
    } catch (e) {
      console.warn('Logout API failed, continuing local clear', e);
    }
  }
  clearTokens();
  dispatchAuthEvent();
}

/**
 * 檢查是否已登入
 */
export function isLoggedIn() {
  return !!localStorage.getItem(TOKEN_KEY);
}

/**
 * 取得快取的用戶資訊（不發 API）
 */
export function getCachedUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * 取得用戶角色
 * @returns {'landlord'|'tenant'|null}
 */
export function getUserRole() {
  const user = getCachedUser();
  return user?.extra_data?.role || null;
}

/**
 * 帶 Bearer Token 的 API 請求（支援自動刷新）
 */
export async function authedRequest(method, path, body = null) {
  let token = await getValidToken();
  if (!token) {
    return { ok: false, status: 401, data: { detail: '未登入或登入已過期' } };
  }

  let res = await apiRequest(method, path, body, { 'Authorization': `Bearer ${token}` });

  // Token 仍失效，強制再次刷新
  if (res.status === 401) {
    console.debug('[Auth] API 401，嘗試強制刷新 Token');
    const refreshed = await refreshToken();
    if (refreshed) {
      token = localStorage.getItem(TOKEN_KEY);
      res = await apiRequest(method, path, body, { 'Authorization': `Bearer ${token}` });
    } else {
      return { ok: false, status: 401, data: { detail: '登入過期，請重新登入' } };
    }
  }
  return res;
}

/**
 * 要求登入，若未登入則跳轉至登入頁
 * @param {string} [redirectUrl] - 登入後跳轉的目標 URL
 * @returns {boolean} 是否已登入
 */
export function requireAuth(redirectUrl) {
  if (isLoggedIn()) return true;
  const redirect = redirectUrl || window.location.pathname + window.location.search;
  window.location.href = `/login.html?redirect=${encodeURIComponent(redirect)}`;
  return false;
}
