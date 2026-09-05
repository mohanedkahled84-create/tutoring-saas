import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('DEV-85: services/api.js targets /api endpoint prefix', () => {
  const apiPath = path.resolve(process.cwd(), '../../apps/web/src/services/api.js');
  const content = fs.readFileSync(apiPath, 'utf8');
  assert.ok(content.includes("http://localhost:3000/api'"));
  assert.ok(!content.includes("http://localhost:3000/api/v1'"));
});

test('DEV-85: TeacherCalendar renders clean Arabic empty state when sessions are empty (no mock data)', async () => {
  const { renderTeacherCalendar } = await import('../../../apps/web/src/components/TeacherCalendar.js');
  const emptyHtml = renderTeacherCalendar({ view: 'day', sessions: [] });
  assert.ok(emptyHtml.includes('لا توجد حصص مجدولة لهذا اليوم'));
  // Ensure hardcoded default mock sessions are NOT present
  assert.ok(!emptyHtml.includes('sess-cal-1'));
  assert.ok(!emptyHtml.includes('أولى ثانوي لغات - سنتر النخبة'));
});

test('DEV-85: CenterOwnerDashboard renders clean Arabic empty state when rollup/rooms are empty', async () => {
  const { renderCenterOwnerDashboard } = await import('../../../apps/web/src/components/CenterOwnerDashboard.js');
  const emptyHtml = renderCenterOwnerDashboard({ activeTab: 'teachers', rollup: null, rooms: [] });
  assert.ok(emptyHtml.includes('لا توجد بيانات تسويات مالية لهذا الشهر بعد'));
  assert.ok(!emptyHtml.includes('٣٨,000'));
  assert.ok(!emptyHtml.includes('أ. طارق حسام'));

  const emptyRoomsHtml = renderCenterOwnerDashboard({ activeTab: 'rooms', rooms: [] });
  assert.ok(emptyRoomsHtml.includes('لا توجد قاعات مضافة حتى الآن'));
  assert.ok(!emptyRoomsHtml.includes('قاعة أينشتاين'));
});

test('DEV-85: StudentsView renders clean Arabic empty state when student list is empty', async () => {
  const { renderStudentsView } = await import('../../../apps/web/src/components/StudentsView.js');
  const emptyHtml = renderStudentsView([], []);
  assert.ok(emptyHtml.includes('لا يوجد طلاب مسجلون حتى الآن'));
  assert.ok(!emptyHtml.includes('أحمد محمود'));
  assert.ok(!emptyHtml.includes('سارة خالد'));
});

test('DEV-85: GroupsView renders clean Arabic empty state when groups are empty', async () => {
  const { renderGroupsView } = await import('../../../apps/web/src/components/GroupsView.js');
  const emptyHtml = renderGroupsView([], { role: 'teacher' });
  assert.ok(emptyHtml.includes('لا توجد مجاميع دراسية مسجلة حتى الآن'));
  assert.ok(!emptyHtml.includes('تانية ثانوي - سنتر الأوائل'));
});

test('DEV-85: TeacherDashboard zero-defaults when no stats or data provided', async () => {
  const { renderTeacherDashboard } = await import('../../../apps/web/src/components/TeacherDashboard.js');
  const html = renderTeacherDashboard({});
  assert.ok(html.includes('0 <span style="font-size: 0.85rem; font-weight: 500;">طالب</span>'));
  assert.ok(html.includes('لا توجد مؤشرات خطر حالياً'));
  assert.ok(html.includes('لا توجد بيانات متفوقين بعد'));
  assert.ok(!html.includes('142'));
  assert.ok(!html.includes('كريم أحمد'));
});

test('DEV-85: SessionsView renders empty state without fake attendance roster', async () => {
  const { renderSessionsView } = await import('../../../apps/web/src/components/SessionsView.js');
  const html = renderSessionsView({}, { role: 'teacher' });
  assert.ok(html.includes('لم يتم تسجيل أي حضور حتى الآن'));
  assert.ok(!html.includes('أحمد محمود'));
  assert.ok(!html.includes('سارة خالد'));
});

test('DEV-85: MessageLogsView renders empty state without fake logs', async () => {
  const { renderMessageLogsView } = await import('../../../apps/web/src/components/MessageLogsView.js');
  const html = renderMessageLogsView([]);
  assert.ok(html.includes('لا توجد سجلات رسائل بعد'));
  assert.ok(!html.includes('01012345678'));
});

test('DEV-85: ParentPortalView renders explicit error screen when token or data is invalid', async () => {
  const { renderParentPortalView } = await import('../../../apps/web/src/components/ParentPortalView.js');
  const errorHtml = renderParentPortalView({ error: 'الرابط غير صالح' });
  assert.ok(errorHtml.includes('رابط غير صالح أو منتهي الصلاحية'));
  assert.ok(!errorHtml.includes('أحمد محمود'));
});

test('DEV-85: OnboardingWizard starts with empty values instead of pre-filled demo data', async () => {
  const { renderOnboardingWizard } = await import('../../../apps/web/src/components/OnboardingWizard.js');
  const html = renderOnboardingWizard(1, {});
  assert.ok(!html.includes('value="مجموعة الثانوية العامة - السبت والثلاثاء"'));
  assert.ok(!html.includes('value="أحمد محمود"'));
});

test('DEV-85: app.js contains no silent success or fake fallback patterns in catch blocks', () => {
  const appPath = path.resolve(process.cwd(), '../../apps/web/src/app.js');
  const content = fs.readFileSync(appPath, 'utf8');

  // Verify that silent success and fake fallback patterns have been removed
  assert.ok(!content.includes('demo-parent-token-'), 'Should never copy fake demo token to clipboard');
  assert.ok(!content.includes('تم حفظ بيانات المدرس في وضع عدم الاتصال'), 'Should not alert offline success on failure');
  assert.ok(!content.includes('تم حفظ بيانات المساعد'), 'Should not alert success on assistant failure');
  assert.ok(!content.includes('simulate successful signup'), 'Should not simulate fake user on signup error');
  assert.ok(!content.includes('تمت إعادة جدولة إرسال الرسالة'), 'Should not alert resend success on error');

  // Verify loadRouteData exists and is wired in navigate and init
  assert.ok(content.includes('loadRouteData'), 'app.js must implement loadRouteData');
  assert.ok(content.includes('this.loadRouteData(route)'), 'navigate must call loadRouteData');
});
