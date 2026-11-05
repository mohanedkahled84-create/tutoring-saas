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
      .portal-opening{min-height:100dvh;display:grid;place-items:center;background:#f6f8fb;color:#172d70;padding:24px;box-sizing:border-box;font-family:inherit}
      .portal-opening-inner{display:grid;justify-items:center;gap:24px;width:min(100%,240px)}
      .portal-opening-mark{display:block;width:72px;height:72px;border-radius:18px}
      .portal-opening-line{height:3px;width:112px;border-radius:8px;background:#172d7014;overflow:hidden}
      .portal-opening-line:after{content:'';display:block;width:40%;height:100%;border-radius:inherit;background:#172d70;animation:portal-opening-flow 1.3s ease-in-out infinite alternate}
      @keyframes portal-opening-flow{to{transform:translateX(150%)}}
      @media(prefers-reduced-motion:reduce){.portal-opening-line:after{animation:none;margin:auto}}
    </style><main class="portal-opening" role="status" aria-label="جار تحميل مساحتك التعليمية" aria-busy="true"><div class="portal-opening-inner"><img class="portal-opening-mark" src="/favicon-192x192.png" width="72" height="72" alt="سنترلي"><div class="portal-opening-line" aria-hidden="true"></div></div></main>`;
    clearTimeout(openingTimer);
    openingTimer = setTimeout(window.showPortalOpeningFailure, 35000);
  };
  window.renderPortalOpening(document.getElementById('app'));
})();
