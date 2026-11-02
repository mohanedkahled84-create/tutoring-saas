import test from 'node:test';
import assert from 'node:assert/strict';
import { payPeriod, scheduledDays, calculatePay, validatePay, cairoDate, attachPayroll } from '../dist/features/assistants/payroll.js';
import { assistantPay } from '../../web/src/utils/assistantPay.js';
import { renderAssistantPayFields } from '../../web/src/components/AssistantPayFields.js';

const period = payPeriod(11, 2026);
const daily = { status: 'active', salary_model: 'per_day', salary: 150, work_weekdays: [0, 2, 4], pay_start_date: '2026-11-01' };

test('automatic daily pay uses actual weekdays in the full selected month without attendance', () => {
  const result = calculatePay(daily, period);
  assert.equal(result.units, 13); // five Sundays, four Tuesdays, four Thursdays
  assert.equal(result.amount, 1950);
  assert.equal(result.basis, 'scheduled_days');
});

test('first month counts start date inclusively and excludes earlier weekdays', () => {
  const result = calculatePay({ ...daily, pay_start_date: '2026-11-15' }, period);
  assert.equal(result.units, 7);
  assert.equal(result.amount, 1050);
  assert.equal(result.from, '2026-11-15');
});

test('future start dates do not create pay before employment', () => {
  for (const salary_model of ['per_day', 'monthly', 'per_session']) {
    assert.equal(calculatePay({ ...daily, salary_model, pay_start_date: '2026-12-01' }, period).amount, 0);
  }
});

test('leap year and calendar months are not approximated as four weeks', () => {
  const all = [0, 1, 2, 3, 4, 5, 6];
  assert.equal(scheduledDays(payPeriod(2, 2028), all, '2028-02-01'), 29);
  assert.equal(scheduledDays(payPeriod(2, 2027), all, '2027-02-01'), 28);
  assert.equal(scheduledDays(payPeriod(10, 2026), all, '2026-10-01'), 31);
  assert.equal(scheduledDays(period, [0, 0], '2026-11-01'), 5);
});

test('Cairo day/month boundary is independent of server or browser timezone', () => {
  assert.equal(cairoDate(new Date('2026-10-31T22:30:00Z')), '2026-11-01');
  assert.equal(payPeriod(undefined, undefined, new Date('2026-10-31T22:30:00Z')).month, 11);
});

test('inactive assistants do not add payroll', () => {
  for (const status of ['inactive']) assert.equal(calculatePay({ ...daily, status }, period).amount, 0);
});

test('monthly legacy rate remains fixed and is not prorated or migrated', () => {
  assert.equal(calculatePay({ salary: '1000', salary_model: 'monthly' }, period).amount, 1000);
});

test('session pay counts unique ended sessions at this teacher/group in this month', () => {
  const assistant = { status: 'active', salary_model: 'per_session', salary: 70.25, teacher_id: 't1', group_id: 'g1', pay_start_date: '2026-11-03' };
  const session = { id: 's1', group_id: 'g1', teacher_id: 't1', session_date: '2026-11-03', status: 'ended' };
  const rows = [session, session, { ...session, id: 's2' },
    { ...session, id: 'early', session_date: '2026-11-02' },
    { ...session, id: 'otherMonth', session_date: '2026-12-03' },
    { ...session, id: 'otherTeacher', teacher_id: 't2' },
    { ...session, id: 'otherGroup', group_id: 'g2' },
    { ...session, id: 'cancelled', status: 'cancelled' },
    { ...session, id: 'scheduled', status: 'scheduled' }];
  assert.equal(calculatePay(assistant, period, rows).units, 2);
  assert.equal(calculatePay(assistant, period, rows).amount, 140.5);
});

test('invalid rates, dates, schedules and models are rejected instead of silently saved as zero', () => {
  for (const salary of [-1, 'abc', Infinity, NaN, '', true, 1.234]) assert.throws(() => validatePay({ salary }));
  for (const work_weekdays of [[], [7], [-1], [1, 1], ['1'], null]) {
    assert.throws(() => validatePay({ ...daily, work_weekdays }));
  }
  for (const pay_start_date of ['2026-02-30', '2026-2-3', '', null, 'before']) assert.throws(() => validatePay({ ...daily, pay_start_date }));
  assert.throws(() => validatePay({ salary_model: 'other' }));
  for (const [month, year] of [[0, 2026], [13, 2026], [1.2, 2026], [1, 2], ['bad', 2026], [[], 2026]]) assert.throws(() => payPeriod(month, year));
});

test('editing other fields retains configured daily schedule and supports explicitly clearing after model change', () => {
  const saved = validatePay({}, daily);
  assert.equal(saved.salary, 150);
  assert.deepEqual(saved.work_weekdays, [0, 2, 4]);
  assert.equal(saved.pay_start_date, '2026-11-01');
  assert.equal(validatePay({ salary_model: 'monthly', work_weekdays: [], pay_start_date: null }, daily).pay_start_date, null);
});

test('paginated session reads are tenant scoped, cover more than API cap and surface failures', async () => {
  const calls = [];
  const db = { from(table) {
    assert.equal(table, 'sessions');
    const q = { select() { return q; }, eq(...args) { calls.push(args); return q; }, gte() { return q; }, lte() { return q; }, order() { return q; }, async range(start) {
      return { data: Array.from({ length: start === 0 ? 500 : 1 }, (_, i) => ({ id: `s${start + i}`, session_date: '2026-11-01', status: 'ended' })), error: null };
    } }; return q;
  } };
  const [row] = await attachPayroll(db, 'tenant-a', [{ status: 'active', salary_model: 'per_session', salary: 1 }], period);
  assert.equal(row.payroll.amount, 501);
  assert.ok(calls.some(a => a[0] === 'tenant_id' && a[1] === 'tenant-a'));
  const bad = { from() { const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, lte() { return q; }, order() { return q; }, range() { return { error: new Error('unavailable') }; } }; return q; } };
  await assert.rejects(attachPayroll(bad, 'tenant-a', [{ status: 'active', salary_model: 'per_session' }], period), /unavailable/);
});

test('daily pay does not read session or attendance tables', async () => {
  const db = { from() { throw new Error('daily pay must not query attendance or sessions'); } };
  const [row] = await attachPayroll(db, 'tenant-a', [daily], period);
  assert.equal(row.payroll.amount, 1950);
});

test('session pay follows the new access scope and includes legacy sessions owned by this tenant',()=>{
 const assistant={status:'active',salary_model:'per_session',salary:50,teacher_id:'teacher-a',access:{all_groups:false,group_ids:['g1']}};
 const sessions=[{id:'s1',group_id:'g1',teacher_id:null,session_date:'2026-11-01',status:'ended'},{id:'s2',group_id:'g2',teacher_id:null,session_date:'2026-11-01',status:'ended'}];
 assert.equal(calculatePay(assistant,period,sessions).amount,50);
 assert.equal(calculatePay({...assistant,access:{all_groups:false,group_ids:[]}},period,sessions).amount,0);
});

test('financial views do not reuse an amount belonging to another selected report month', () => {
  const row = { ...daily, payroll: calculatePay(daily, period) };
  assert.equal(assistantPay(row, { month: 11, year: 2026 }).amount, 1950);
  assert.equal(assistantPay(row, { month: 10, year: 2026 }).available, false);
  assert.equal(assistantPay(daily).available, false);
  assert.match(assistantPay(row).basis, /يوم عمل مجدول/);
});

test('daily form restores saved weekdays/date and explains automatic calculation', () => {
  const html = renderAssistantPayFields('pay', daily);
  assert.match(html, /value="2026-11-01"/);
  assert.match(html, /value="0" checked/);
  assert.match(html, /value="2" checked/);
  assert.match(html, /value="4" checked/);
  assert.match(html, /لا يحتاج تسجيل حضور/);
  assert.match(html, /step="0.01"/);
});

test('pending account acceptance does not zero the configured daily or monthly work pay',()=>{
 const result=calculatePay({...daily,status:'invited',salary:250,work_weekdays:[1,4,6],pay_start_date:'2026-02-13'},period);
 assert.equal(result.units,13);assert.equal(result.amount,3250);
 assert.equal(calculatePay({...daily,status:'invited',salary_model:'monthly',salary:3500},period).amount,3500);
 assert.equal(calculatePay({...daily,status:'inactive'},period).amount,0);
});

test('permission page names match teacher navigation, with distinct quiz setup and score explanations',async()=>{
 const {teacherPageTitles}=await import('../../web/src/utils/teacherPageTitles.js');const {renderSidebar}=await import('../../web/src/components/Sidebar.js');const {assistantPages,renderAssistantAccessFields}=await import('../../web/src/components/AssistantAccessFields.js');
 const sidebar=renderSidebar('sessions',{role:'teacher'});for(const key of ['groups','students','sessions','attendance','homework','materials','quizzes','grades','reports'])assert.ok(sidebar.includes(teacherPageTitles[key]),key);
 for(const [key,label] of assistantPages)assert.equal(label,teacherPageTitles[key]);
 const html=renderAssistantAccessFields('test');assert.match(html,/إعداد الكويز/);assert.match(html,/رصد درجات الكويزات/);
});
