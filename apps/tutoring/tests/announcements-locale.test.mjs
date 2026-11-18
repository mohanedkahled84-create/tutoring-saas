import assert from 'node:assert/strict';
import test from 'node:test';
import { announcementClasses, renderAnnouncementsView, registerAnnouncementsActions } from '../../web/src/components/AnnouncementsView.js';

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


test('a saved class can be picked before choosing a group, including a two-day timetable', () => {
  const groups = [{ id: 'group', name: 'Physics', day_of_week: 'الأحد، الأربعاء', session_time: '04:00 م / 06:30 م' }];
  const rows = [
    { id: 'class', group_id: 'group', session_date: '2026-11-18' },
    { id: 'unknown', group_id: 'another-group', session_date: '2026-11-18' },
  ];
  assert.deepEqual(announcementClasses(rows, groups), [
    { id: 'class', groupId: 'group', topic: 'Physics', datetime: '2026-11-18T18:30' },
  ]);
});
