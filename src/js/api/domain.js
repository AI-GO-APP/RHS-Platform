/**
 * App Domain 隔離常數與工具（參照 Booking Platform）
 * 
 * 所有共用系統表的寫入與查詢都必須使用 app_domain 標籤
 * 以避免同一租戶下多個 App 的資料互相污染
 */

/** RHS 包租代管平台 App Domain 識別碼 */
export const APP_DOMAIN = 'rhs-platform';

/**
 * 將 app_domain 注入 custom_data
 * @param {object} customData - 原始 custom_data 物件
 * @returns {object} 含 app_domain 的 custom_data
 */
export function withDomain(customData = {}) {
  return { app_domain: APP_DOMAIN, ...customData };
}

/**
 * 產生 app_domain 過濾條件（用於 Proxy query 的 filters）
 * AI GO 以 ilike 操作符對 JSONB 欄位做文字匹配
 * @returns {{ column: string, op: string, value: string }}
 */
export function domainFilter() {
  return {
    column: 'custom_data',
    op: 'ilike',
    value: `%app_domain%${APP_DOMAIN}%`,
  };
}
