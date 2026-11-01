import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantAccessRouter,validateAssistantAccess} from '../dist/features/assistants/access.js';
import {safeAssistantChanges} from '../dist/features/assistants/activity.js';
import {renderAssistantActivity} from '../../web/src/components/AssistantActivityView.js';

test('quiz setup does not implicitly grant grade access and grade editing requires its own view permission',()=>{
 const access=validateAssistantAccess({permissions:{'quizzes.view':true,'quizzes.edit':true}});
 assert.equal(access.permissions['grades.view'],undefined);assert.equal(access.permissions['grades.edit'],undefined);
 assert.throws(()=>validateAssistantAccess({permissions:{'grades.edit':true}}));
 assert.deepEqual(validateAssistantAccess({permissions:{'grades.view':true,'grades.edit':true}}).permissions,{'grades.view':true,'grades.edit':true});
});

test('grade API rejects malformed scores, owner metadata and unsupported create operations before accessing records',async()=>{
 const route=assistantAccessRouter.stack.find(layer=>layer.route?.path==='/data/:resource/:action').route.stack.at(-1).handle;
 const valid={quiz_id:'10000000-0000-4000-8000-000000000001',student_id:'20000000-0000-4000-8000-000000000001',score:0,note:''};
 for(const body of [{...valid,score:'5'},{...valid,score:-1},{...valid,score:NaN},{...valid,score:Infinity},{...valid,max_score:100},{...valid,tenant_id:'other'},{...valid,student_id:'invalid'}]){
  const res={status(code){this.code=code;return this;},json(body){this.body=body;}};
  await route({params:{resource:'grades',action:'edit'},body},res);assert.equal(res.code,400);
 }
 const res={status(code){this.code=code;return this;},json(){}};
 await route({params:{resource:'grades',action:'create'},body:valid},res);assert.equal(res.code,403);
});

test('grade history shows the real zero before correction and excludes unrelated private fields',()=>{
 const changes=safeAssistantChanges('grades.edit',{before:{score:0,note:'قبل',password_hash:'secret'},after:{score:7.5,note:'<script>bad</script>',file_url:'https://private'}});
 assert.deepEqual(changes.before,{score:0,note:'قبل'});assert.ok(!JSON.stringify(changes).includes('private'));
 const html=renderAssistantActivity([{actor_type:'assistant',actor_name:'مساعد',action:'grades.edit',target_name:'طالب',created_at:'2026-11-01T00:00:00Z',changes}]);
 assert.match(html,/رصد أو صحح درجة/);assert.match(html,/قبل:<\/span> 0/);assert.match(html,/7.5/);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('secret'));
});
