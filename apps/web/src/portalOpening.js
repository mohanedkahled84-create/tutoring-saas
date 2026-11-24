// A classic script deliberately runs before the asynchronous portal modules.
// Both the lightweight entry and legacy SPA callers use this small renderer.
(function () {
  let openingTimer;

  window.showPortalOpeningFailure = function () {
    const root = document.getElementById('app');
    if (!root?.querySelector('.portal-opening[aria-busy="true"]')) return;
    clearTimeout(openingTimer);
    root.innerHTML = `<main role="alert" dir="rtl" style="padding:3rem 1rem;text-align:center">
      <p>تعذر فتح الصفحة. جرّب إعادة التحميل.</p>
      <button type="button" class="btn btn-primary" style="min-height:44px">إعادة المحاولة</button>
    </main>`;
    root.querySelector('button').addEventListener('click', () => window.location.reload());
  };

  window.renderPortalOpening = function (root) {
    if (!root) return;
    root.innerHTML = `<style>
      .portal-opening{min-height:100dvh;background:#f6f8fb;padding:24px;box-sizing:border-box}
      .portal-opening-inner{max-width:1100px;margin:auto;display:grid;gap:24px}
      .portal-opening-skeleton{background:linear-gradient(90deg,#e2e8f0,#f1f5f9,#e2e8f0);background-size:200% 100%;border-radius:16px;animation:portal-shimmer 1.5s linear infinite}
      .portal-opening-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}
      @keyframes portal-shimmer{to{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.portal-opening-skeleton{animation:none}}
    </style><main class="portal-opening" role="status" aria-label="جار تحميل مساحتك التعليمية" aria-busy="true"><div class="portal-opening-inner" aria-hidden="true"><div class="portal-opening-skeleton" style="height:64px"></div><div class="portal-opening-skeleton" style="height:180px"></div><div class="portal-opening-cards"><div class="portal-opening-skeleton" style="height:220px"></div><div class="portal-opening-skeleton" style="height:220px"></div><div class="portal-opening-skeleton" style="height:220px"></div></div></div></main>`;
    clearTimeout(openingTimer);
    openingTimer = setTimeout(window.showPortalOpeningFailure, 35000);
  };
  window.renderPortalOpening(document.getElementById('app'));
})();
