// A classic script deliberately runs before the asynchronous portal modules.
// Both the lightweight entry and legacy SPA callers use this small renderer.
(function () {
  window.renderPortalOpening = function (root) {
    if (!root) return;
    root.innerHTML = `<style>
      .portal-opening{min-height:100dvh;display:grid;place-items:center;background:#f6f8fb;color:#172d70;padding:24px;box-sizing:border-box;font-family:inherit}
      .portal-opening-inner{display:grid;justify-items:center;gap:24px;width:min(100%,240px)}
      .portal-opening-mark{display:grid;place-items:center;width:72px;height:72px;border-radius:24px;background:#172d70;color:#fff;box-shadow:0 12px 32px #172d7014}
      .portal-opening-line{height:3px;width:112px;border-radius:8px;background:#172d7014;overflow:hidden}
      .portal-opening-line:after{content:'';display:block;width:40%;height:100%;border-radius:inherit;background:#172d70;animation:portal-opening-flow 1.3s ease-in-out infinite alternate}
      @keyframes portal-opening-flow{to{transform:translateX(150%)}}
      @media(prefers-reduced-motion:reduce){.portal-opening-line:after{animation:none;margin:auto}}
    </style><main class="portal-opening" role="status" aria-label="جار تحميل مساحتك التعليمية" aria-busy="true"><div class="portal-opening-inner"><div class="portal-opening-mark" aria-hidden="true"><svg width="38" height="38" viewBox="0 0 40 40" fill="none"><path d="M7 29h25V13h-6v16M19 21v8M12 25v4" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg></div><div class="portal-opening-line" aria-hidden="true"></div></div></main>`;
  };
  window.renderPortalOpening(document.getElementById('app'));
})();
