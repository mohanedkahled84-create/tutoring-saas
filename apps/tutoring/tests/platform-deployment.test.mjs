import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderTeacherPlatformBuilderView} from '../../web/src/components/TeacherPlatformBuilderView.js';
test('student preview never embeds parent access tokens',()=>{
 const html=renderTeacherPlatformBuilderView({plan:{is_pro:true},settings:{subdomain:'mr-omar',is_active:true}}, {},[{id:'id',name:'Student',code:'123',student_phone:'01012345678',portal_password:'123456',parent_portal_token:'secret-parent-token'}]);
 assert.doesNotMatch(html,/secret-parent-token/);assert.match(html,/https:\/\/mr-omar\.centerly-eg\.com\/login/);
});
test('production site includes the branded login and student dashboard used by its routes',()=>{
 const web=new URL('../../web/',import.meta.url),root=new URL('../../../',import.meta.url);
 for(const file of ['index.html','login.html','teacher_cutout.png'])assert.deepEqual(readFileSync(new URL('teacher-platform-sample/'+file,web)),readFileSync(new URL('teacher-platform-sample/'+file,root)));
 const config=JSON.parse(readFileSync(new URL('vercel.json',web),'utf8'));for(const path of ['/teacher-platform-sample/index.html','/teacher-platform-sample/login.html'])assert.ok(config.routes.some(route=>route.dest===path));
});
