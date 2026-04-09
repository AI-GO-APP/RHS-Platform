// src/js/i18n.js

export const dictionary = {
  'zh-TW': {
    'brand_name': 'SERENITY 示範包租代管',
    'gateway_title': '您的最佳資產管理與居住體驗',
    'gateway_desc': '我們重新定義台灣的租賃市場，結合科技與美學，為房東與租客創造雙贏的質感生活。',
    'gateway_landlord': '我是房東',
    'gateway_landlord_desc': '了解八大託管服務，讓您的資產完美升級，輕鬆創造穩定收益。',
    'gateway_landlord_btn': '進入託管服務',
    'gateway_tenant': '我是租客',
    'gateway_tenant_desc': '尋找精選質感好房，線上預約賞屋與進度追蹤，享受舒適生活。',
    'gateway_tenant_btn': '尋找理想居所',
    'nav_landlord': '房東委託',
    'nav_tenant': '尋找好房',
    'nav_portal': '我的預約進度',
    'footer_copyright': '© 2026 示範包租代管 (SERENITY). 本平台為展示用開發專案。',
    'nav_process': '服務流程',
    'nav_compare': '成效對比',
    'nav_contact': '立即諮詢',
    'nav_login': '登入 / 註冊',
    'auth_login': '登入',
    'auth_register': '註冊',
    'auth_logout': '登出',
    'role_landlord': '房東',
    'role_tenant': '租客'
  },
  'en-US': {
    'brand_name': 'SERENITY Property Mgmt',
    'gateway_title': 'Ultimate Asset Management & Living',
    'gateway_desc': 'Redefining the rental market in Taiwan by combining technology with aesthetics for a win-win lifestyle.',
    'gateway_landlord': 'I am a Landlord',
    'gateway_landlord_desc': 'Discover our 8-step management service to upgrade your assets and generate stable income.',
    'gateway_landlord_btn': 'Management Services',
    'gateway_tenant': 'I am a Tenant',
    'gateway_tenant_desc': 'Find premium curated homes, book viewings online, and track your application progress.',
    'gateway_tenant_btn': 'Find Ideal Home',
    'nav_landlord': 'Landlord Service',
    'nav_tenant': 'Find Homes',
    'nav_portal': 'My Bookings',
    'footer_copyright': '© 2026 Serenity Property Management. A showcase prototype.',
    'nav_process': 'Services Flow',
    'nav_compare': 'Comparisons',
    'nav_contact': 'Contact Us',
    'nav_login': 'Login / Register',
    'auth_login': 'Login',
    'auth_register': 'Register',
    'auth_logout': 'Logout',
    'role_landlord': 'Landlord',
    'role_tenant': 'Tenant'
  }
};

let currentLang = localStorage.getItem('site_lang') || 'zh-TW';

export function getLang() {
  return currentLang;
}

export function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('site_lang', lang);
  updateDOM();
}

export function toggleLanguage() {
  const newLang = currentLang === 'zh-TW' ? 'en-US' : 'zh-TW';
  setLanguage(newLang);
}

export function t(key) {
  return dictionary[currentLang][key] || key;
}

export function updateDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dictionary[currentLang][key]) {
      el.textContent = dictionary[currentLang][key];
    }
  });

  // Update language switcher text
  const switchers = document.querySelectorAll('.lang-switcher-text');
  switchers.forEach(el => {
    el.textContent = currentLang === 'zh-TW' ? 'EN' : '中文';
  });
}
