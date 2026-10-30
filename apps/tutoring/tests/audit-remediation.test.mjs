import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { SupabaseStudentsRepository } from '../dist/features/students/repository.js';
import { StudentsService } from '../dist/features/students/service.js';
import { studentsRouter } from '../dist/features/students/routes.js';
import { calculateStudentSummary, rankStudents, formatStudentReportMessage } from '../dist/features/reports/calculation.js';
import { ReportsService } from '../dist/features/reports/service.js';
import { homeworkObject, ownsHomeworkObject, signHomeworkFile, HOMEWORK_MAX_BYTES } from '../dist/features/homework/files.js';
import { config } from '../dist/shared/config/index.js';
import { renderTeacherPlatformBuilderView } from '../../web/src/components/TeacherPlatformBuilderView.js';
import { renderSidebar } from '../../web/src/components/Sidebar.js';
import { renderStudentReportsView } from '../../web/src/components/StudentReportsView.js';
import { renderAuthScreens } from '../../web/src/components/AuthScreens.js';
import { authService } from '../../web/src/services/auth.js';

function database(rows, { failJoin = false } = {}) {
  const calls = [];
  return { calls, from(table) {
    const filters = []; let update; let selected = ''; let deleted = false;
    const query = {
      select(fields) { selected = fields; return this; },
      eq(column, value) { filters.push([column, value]); return this; },
      or(value) { calls.push({ search: value }); return this; },
      order() { return this; }, limit() { return this; },
      update(value) { update = value; return this; },
      delete() { deleted = true; return this; },
      async maybeSingle() { return execute(true); },
      then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject); },
    };
    function execute(single) {
      calls.push({ table, filters: [...filters], update, deleted });
      if (failJoin && selected.includes('group_students(')) return { data: null, error: { message: 'relationship unavailable' } };
      const matches = rows.filter(row => filters.every(([key, value]) => row[key] === value));
      if (update) matches.forEach(row => Object.assign(row, update));
      return { data: single ? matches[0] || null : matches, error: null };
    }
    return query;
  }};
}
const row = (tenant, id = tenant) => ({ id, tenant_id: tenant, name: tenant, parent_phone: '01000000000', portal_password: '123456' });

test('tenant A cannot read or update tenant B through the real privileged repository', async () => {
  const rows = [row('tenant-a'), row('tenant-b')];
  const scoped = database([]); const privileged = database(rows);
  const service = new StudentsService(new SupabaseStudentsRepository(scoped, privileged, 'tenant-a'));
  assert.equal(await service.getStudent('tenant-b'), null);
  assert.equal(await service.updateStudent('tenant-b', { name: 'unauthorized' }), null);
  assert.equal(rows[1].name, 'tenant-b');
  assert.equal((await service.getStudent('tenant-a')).tenant_id, 'tenant-a');
  assert.equal((await service.updateStudent('tenant-a', { name: 'authorized' })).name, 'authorized');
  assert.ok(privileged.calls.every(call => call.filters.some(([key, value]) => key === 'tenant_id' && value === 'tenant-a')));
});

test('missing tenant context never falls back to a privileged ID lookup', async () => {
  const privileged = database([row('tenant-b')]);
  const repo = new SupabaseStudentsRepository(database([]), privileged);
  assert.equal(await repo.findById('tenant-b'), null);
  assert.equal(await repo.update('tenant-b', { name: 'unauthorized' }), null);
  assert.equal(privileged.calls.length, 0);
});

test('relationship fallback keeps explicit tenant, group and search filters', async () => {
  const db = database([row('tenant-a'), row('tenant-b')], { failJoin: true });
  await new SupabaseStudentsRepository(db).list('tenant-a', 'search', 'group-a');
  const fallback = db.calls.filter(call => call.table === 'students').at(-1);
  assert.ok(fallback.filters.some(([key, value]) => key === 'tenant_id' && value === 'tenant-a'));
  assert.ok(fallback.filters.some(([key, value]) => key === 'group_id' && value === 'group-a'));
  assert.equal(db.calls.filter(call => call.search?.includes('search')).length, 2);
});

test('real student HTTP router returns 404 across tenants, including parent links and update', async t => {
  const rows = [row('tenant-a'), row('tenant-b')];
  const students = new StudentsService(new SupabaseStudentsRepository(database([]), database(rows), 'tenant-a'));
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { tenant_id: 'tenant-a', role: 'owner' }; req.services = { students }; next(); });
  app.use('/students', studentsRouter);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/students`;
  for (const suffix of ['/tenant-b', '/tenant-b/parent-link']) assert.equal((await fetch(base + suffix)).status, 404);
  const denied = await fetch(`${base}/tenant-b`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name: 'unauthorized'}) });
  assert.equal(denied.status, 404);
  const allowed = await fetch(`${base}/tenant-a`);
  assert.equal(allowed.status, 200); assert.equal((await allowed.json()).student.tenant_id, 'tenant-a');
  assert.equal(rows[1].name, 'tenant-b');
});

test('homework file signing validates origin, tenant, assignment and student', async () => {
  let signed = 0;
  const client = { storage: { from(bucket) { return { async createSignedUrl(path, ttl) { signed++; assert.equal(ttl,900); return { data: {signedUrl: `https://signed.invalid/${bucket}/${path}`}, error:null }; }}; }}};
  const path = 'tenant-a/material-a/student-a_123_file.pdf';
  const legacy = `${config.supabaseUrl}/storage/v1/object/public/homework-submissions/${path}`;
  assert.equal(homeworkObject(legacy).bucket, 'homework-submissions');
  assert.equal(homeworkObject(path).bucket, 'homework-private');
  assert.ok(await signHomeworkFile(client, path, 'tenant-a', 'material-a', 'student-a'));
  assert.equal(await signHomeworkFile(client, legacy, 'tenant-b'), null);
  assert.equal(await signHomeworkFile(client, path, 'tenant-a', 'material-b'), null);
  assert.equal(await signHomeworkFile(client, path, 'tenant-a', 'material-a', 'student-b'), null);
  assert.equal(homeworkObject(`https://untrusted.invalid/storage/v1/object/public/homework-submissions/${path}`), null);
  assert.equal(homeworkObject('tenant-a/../student-a_file.pdf'), null);
  assert.equal(homeworkObject('tenant-a/%2e%2e/student-a_file.pdf'), null);
  assert.equal(ownsHomeworkObject('tenant-a/material-a/student-a-other_file.pdf','tenant-a','material-a','student-a'),false);
  assert.equal(signed,1); assert.equal(HOMEWORK_MAX_BYTES,26214400);
});

const raw = (id, attendances = [], grades = []) => ({student:{id,name:id,code:id,parent_phone:'01000000000'},attendances,grades});
test('unrecorded results differ from genuine zero, and no-data students are unranked', () => {
  const empty = calculateStudentSummary(raw('empty'));
  assert.equal(empty.attendance_rate,0); assert.equal(empty.overall_score,0);
  const zero = calculateStudentSummary(raw('zero', [], [{score:0,max_score:10}]));
  assert.equal(zero.total_quizzes,1); assert.equal(zero.average_score,0);
  const absentGrades = calculateStudentSummary(raw('unrecorded',[],[{score:null,max_score:10},{score:NaN,max_score:10}]));
  assert.equal(absentGrades.total_quizzes,0);
  const ranked = rankStudents([empty,zero]);
  assert.equal(ranked.find(s=>s.student_id==='empty').rank,0);
  assert.equal(ranked.find(s=>s.student_id==='zero').rank,1);
  assert.match(formatStudentReportMessage(empty),/لا توجد بيانات/);
  assert.doesNotMatch(formatStudentReportMessage(empty),/100%|المركز 0/);
});
test('report averages exclude unrecorded students while retaining recorded zero', async () => {
  const service = new ReportsService({ async getStudentsWithPerformanceData() {return [raw('empty'), raw('real',[{attended:true}],[{score:0,max_score:10}])];} });
  const summary = await service.getMonthlyLeaderboard('tenant-a',10,2026);
  assert.equal(summary.average_attendance_rate,100); assert.equal(summary.average_score,0);
  assert.equal(summary.attendance_students,1); assert.equal(summary.graded_students,1);
});

test('builder renders saved branding without local cache or injected demo students', () => {
  const html = renderTeacherPlatformBuilderView({settings:{theme_preset:'purple',subject_title:'خبير اللغة الإنجليزية',display_title:'My Teacher'},plan:{is_pro:true}}, {tenant_id:'tenant-a',name:'مدرس جديد'}, []);
  assert.match(html,/خبير اللغة الإنجليزية/); assert.doesNotMatch(html,/مهند خالد|01123671177/);
  assert.doesNotThrow(()=>renderTeacherPlatformBuilderView({}, {tenant_id:'tenant-b',name:'مدرس آخر'}, []));
});
test('ordinary teachers can discover platform routes and no-data reports render honestly', () => {
  const nav = renderSidebar('sessions',{role:'owner',tenant_id:'new-tenant',name:'مدرس جديد'});
  assert.match(nav,/platform-builder/); assert.match(nav,/video-lessons/);
  const summary = calculateStudentSummary(raw('empty'));
  const html = renderStudentReportsView({leaderboard:[summary],total_students:1,attendance_students:0,graded_students:0});
  assert.match(html,/لا توجد بيانات/); assert.match(html,/لم تسجل درجات/); assert.doesNotMatch(html,/#0|0% \(0\/0\)/);
  const auth = renderAuthScreens(); assert.match(auth, /for="loginEmail"/); assert.match(auth,/for="signupPassword"/); assert.doesNotMatch(auth,/تلقي OTP/);
});

test('cached identity never rewrites the server tenant or role based on email', () => {
  const old=globalThis.localStorage;
  const profile={tenant_id:'server-tenant',role:'owner',name:'server-name',email:'mohanedabdulhalim@gmail.com',subject:'server-subject'};
  globalThis.localStorage={getItem(key){return key==='centrly_user'?JSON.stringify(profile):null;}};
  try {assert.deepEqual(authService.getUser(),profile);} finally {if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});
