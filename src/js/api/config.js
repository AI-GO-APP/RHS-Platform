/**
 * AI GO API 基礎設定
 * 所有環境變數從 Vite 的 import.meta.env 讀取，嚴禁硬編碼
 * 
 * 前端呼叫走 Vite dev proxy 中轉：
 * - /api/open/*  → AI GO Open Proxy（Vite proxy 自動注入 X-API-Key）
 * - /api/ext/*   → AI GO Ext Proxy（前端自行帶 Bearer Token）
 * - /api/custom-app-auth/* → AI GO Custom App Auth（公開端點）
 */

// API 路徑前綴（走 Vite proxy，使用相對路徑）
export const OPEN_PROXY_PREFIX = '/api/open/proxy';
export const EXT_PROXY_PREFIX = '/api/ext/proxy';
export const AUTH_PREFIX = `/api/custom-app-auth/${import.meta.env.VITE_AIGO_APP_SLUG}`;

/**
 * 通用 fetch 封裝
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} method
 * @param {string} path - 完整相對路徑（以 / 開頭）
 * @param {object|null} body
 * @param {object} extraHeaders
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export async function apiRequest(method, path, body = null, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(path, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error(`[API] ${method} ${path} 網路錯誤:`, err);
    return { ok: false, status: 0, data: { detail: '網路連線失敗' } };
  }
}
