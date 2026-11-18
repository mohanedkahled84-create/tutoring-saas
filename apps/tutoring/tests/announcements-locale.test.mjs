import assert from 'node:assert/strict';
import test from 'node:test';
import { renderAnnouncementsView, registerAnnouncementsActions } from '../../web/src/components/AnnouncementsView.js';

test('announcement navigation, wallet, and composer follow the selected language', async () => {
  let language = 'en';
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => language } });
  const app = { announcementsData: { catalog: [] }, showModal(title, body) { this.modal = title + body; } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { centrlyApp: app } });

  try {
    registerAnnouncementsActions(app);
    const data = { wallet: { paid_piasters: 100, gift_piasters: 0 } };
    for (const locale of ['en', 'ar']) {
      language = locale;
      const page = renderAnnouncementsView(data, app);
      await app.openAnnouncement();
      assert.match(page, locale === 'en' ? /Messages and announcements/ : /الرسائل والإعلانات/);
      assert.match(page, locale === 'en' ? /Wallet/ : /المحفظة/);
      assert.match(app.modal, locale === 'en' ? /Save draft/ : /حفظ المسودة/);
      if (locale === 'en') assert.doesNotMatch(page + app.modal, /\p{Script=Arabic}/u);
    }
  } finally {
    for (const [key, descriptor] of [['localStorage', previousStorage], ['window', previousWindow]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
