import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderTeacherPlatformBuilderView} from '../../web/src/components/TeacherPlatformBuilderView.js';
test('student preview never embeds parent access tokens',()=>{
 const html=renderTeacherPlatformBuilderView({plan:{is_pro:true},settings:{subdomain:'mr-omar',is_active:true},destination:{origin:'https://mr-omar.centerly-eg.com',presentation:{subdomain:'mr-omar'}}}, {},[{id:'id',name:'Student',code:'123',student_phone:'01012345678',portal_password:'123456',parent_portal_token:'secret-parent-token'}]);
 assert.doesNotMatch(html,/secret-parent-token/);assert.match(html,/https:\/\/mr-omar\.centerly-eg\.com\/login/);
});
test('platform dashboard localizes quiz results and does not read another account’s local submission cache',()=>{
 const prior=globalThis.localStorage;
 globalThis.localStorage={length:1,key:()=> 'centrly_submission_123_other',getItem:key=>key==='centrly_locale'?'en':JSON.stringify({score:10,max_score:10})};
 try {
  const settings={settings:{subdomain:'teacher',is_active:true,display_title:'School',subject_title:'Physics'},plan:{is_pro:true}};
  const student={id:'student-id',name:'Student',code:'123',student_phone:'01012345678'};
  const empty=renderTeacherPlatformBuilderView(settings,{},[student]);
  assert.match(empty,/Not graded yet/);assert.match(empty,/Login details incomplete/);assert.doesNotMatch(empty,/>\s*Excellent\s*</);
  const graded=renderTeacherPlatformBuilderView({...settings,onlineSubmissions:[{student_id:'student-id',score:9,max_score:10,status:'graded'}]}, {},[student]);
  assert.match(graded,/Excellent/);assert.match(graded,/Online quiz/);assert.doesNotMatch(graded,/>\s*ممتاز\s*</);
 } finally {globalThis.localStorage=prior;}
});
test('production site includes the branded login and student dashboard used by its routes',()=>{
 const web=new URL('../../web/',import.meta.url),root=new URL('../../../',import.meta.url);
 for(const file of ['index.html','login.html','teacher_cutout.png'])assert.deepEqual(readFileSync(new URL('teacher-platform-sample/'+file,web)),readFileSync(new URL('teacher-platform-sample/'+file,root)));
 const config=JSON.parse(readFileSync(new URL('vercel.json',web),'utf8'));for(const path of ['/teacher-platform-sample/index.html','/teacher-platform-sample/login.html'])assert.ok(config.routes.some(route=>route.dest===path));
});

test('unverified platform address is never offered as a live login or preview',()=>{
 const html=renderTeacherPlatformBuilderView({plan:{is_pro:true},settings:{subdomain:'pending-address',is_active:true}}, {},[{id:'id',name:'Student',code:'123',student_phone:'01012345678',portal_password:'123456'}]);
 assert.match(html,/https:\/\/centerly-eg\.com\/portal\?role=student/);
 assert.doesNotMatch(html,/https:\/\/pending-address\.centerly-eg\.com/);
 assert.match(html,/الرابط المخصص لم يتأكد تفعيله/);
});

test('branded student routes match teacher subdomains only',()=>{
 const config=JSON.parse(readFileSync(new URL('../../web/vercel.json',import.meta.url),'utf8'));
 for(const path of ['/teacher-platform-sample/index.html','/teacher-platform-sample/login.html']){
  const route=config.routes.find(r=>r.dest===path),host=new RegExp(route.has[0].value);
  assert.ok(host.test('mr-omar.centerly-eg.com'));assert.ok(host.test('new-teacher.centerly-eg.com'));
  assert.ok(!host.test('centerly-eg.com'));assert.ok(!host.test('www.centerly-eg.com'));assert.ok(!host.test('api.centerly-eg.com'));
 }
});
