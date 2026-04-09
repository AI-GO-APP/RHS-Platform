// src/js/components.js — 全域共用元件（含登入狀態）
import { t, toggleLanguage, updateDOM } from './i18n.js';
import { isLoggedIn, getCachedUser, getUserRole, logout, dispatchAuthEvent } from './api/auth.js';

export function renderNavbar(activeMenu = '') {
  const user = getCachedUser();
  const loggedIn = isLoggedIn();
  const role = getUserRole();

  // 角色標籤
  const roleLabels = { landlord: '房東', tenant: '租客' };
  const roleLabel = role ? roleLabels[role] || '' : '';

  // 用戶區塊
  const userSection = loggedIn && user
    ? `<div class="nav-user-info">
        <span class="nav-user-name">${user.display_name || user.email}</span>
        ${roleLabel ? `<span class="nav-role-badge">${roleLabel}</span>` : ''}
        <button id="btn-logout" class="btn-logout">登出</button>
      </div>`
    : `<a href="/login.html" class="btn btn-primary" style="padding:8px 18px; font-size:0.9rem;">登入 / 註冊</a>`;

  const navHTML = `
    <nav class="navbar">
      <div class="container flex justify-between items-center" style="width:100%">
        <a href="/index.html" class="nav-link"><h2 class="text-primary"><span data-i18n="brand_name" class="en">SERENITY</span></h2></a>
        
        <!-- Mobile hamburger toggle -->
        <div class="menu-toggle" id="mobile-menu-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </div>

        <div class="nav-links" id="nav-menu">
          ${activeMenu === 'landlord' ? `
            <a href="#process" data-i18n="nav_process" class="nav-link">服務流程</a>
            <a href="#transformation" data-i18n="nav_compare" class="nav-link">成效對比</a>
            <a href="#commission-form" data-i18n="nav_contact" class="btn btn-primary" style="padding:8px 18px; font-size:0.9rem;">立即委託</a>
          ` : `
            <a href="/landlord-service.html" data-i18n="nav_landlord" class="nav-link ${activeMenu === 'landlord-link' ? 'active' : ''}">房東委託</a>
            <a href="/tenant-listing.html" data-i18n="nav_tenant" class="nav-link ${activeMenu === 'listing' ? 'active' : ''}">尋找好房</a>
            <a href="/tenant-portal.html" data-i18n="nav_portal" class="nav-link ${activeMenu === 'portal' ? 'active' : ''}">我的預約進度</a>
          `}
          <div id="btn-lang-toggle-nav" style="font-weight:bold; cursor:pointer;" class="lang-switcher-text nav-link text-primary">EN</div>
          ${userSection}
        </div>
      </div>
    </nav>
  `;
  document.body.insertAdjacentHTML('afterbegin', navHTML);

  // Mobile menu logic
  const menuBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.getElementById('nav-menu');
  if (menuBtn && navMenu) {
    menuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('nav-active');
    });
  }

  // Lang toggle event
  const langToggle = document.getElementById('btn-lang-toggle-nav');
  if (langToggle) {
    langToggle.addEventListener('click', toggleLanguage);
  }

  // 登出按鈕
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      window.location.href = '/index.html';
    });
  }

  // 監聽認證變化事件，重新渲染 Navbar
  window.addEventListener('authChange', () => {
    const existingNav = document.querySelector('.navbar');
    if (existingNav) existingNav.remove();
    renderNavbar(activeMenu);
  });
}

export function renderFooter() {
  const footerHTML = `
    <footer class="bg-surface" style="padding:var(--space-2xl) 0; border-top:1px solid var(--color-border); margin-top:auto;">
      <div class="container text-center text-muted" data-i18n="footer_copyright">
        &copy; 2026 示範包租代管 (SERENITY). 本平台為展示用開發專案。
      </div>
    </footer>
  `;
  document.body.insertAdjacentHTML('beforeend', footerHTML);

  // Trigger translation for injected components
  updateDOM();
}
