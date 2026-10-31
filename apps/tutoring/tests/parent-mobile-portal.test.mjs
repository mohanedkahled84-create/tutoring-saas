import test from 'node:test';
import assert from 'node:assert/strict';
import {renderParentPortalView, parentHomeworkTiming, parentPortalSnapshot} from '../../web/src/components/ParentPortalView.js';

test('parent homework deadlines respect Cairo calendar days and never invent missing timestamps',()=>{
 assert.equal(parentHomeworkTiming({submitted_at:'2026-10-31T21:59:00Z',due_date:'2026-10-31'}),'في الموعد');
 assert.equal(parentHomeworkTiming({submitted_at:'2026-10-31T22:01:00Z',due_date:'2026-10-31'}),'متأخر');
 assert.equal(parentHomeworkTiming({submitted_at:'2026-10-31T10:01:00Z',due_date:'2026-10-31T10:00:00Z'}),'متأخر');
 for(const h of [{due_date:'2026-10-31'}, {submitted_at:'bad',due_date:'2026-10-31'}, {submitted_at:'2026-10-31T11:00:00Z',due_date:'2026-10-31T10:00:00'}]) assert.equal(parentHomeworkTiming(h),'');
});
test('parent monitoring contains only status and timing; no exercise details, URLs, private files, fabricated contact or switchers',()=>{
 const html=renderParentPortalView({student:{name:'<script>bad</script>',teacher_name:'مدرس'},materials:[{type:'homework',title:'الواجب الأول',description:'PRIVATE-DESCRIPTION',book_name:'PRIVATE-BOOK',questions:'PRIVATE-QUESTIONS',url:'PRIVATE-URL',submission_url:'PRIVATE-FILE',submitted_at:'2026-10-31T10:00:00Z',due_date:'2026-10-31',submission_status:'pending'}]},'homework');
 for(const secret of ['PRIVATE-DESCRIPTION','PRIVATE-BOOK','PRIVATE-QUESTIONS','PRIVATE-URL','PRIVATE-FILE','01010979708','<script>bad</script>','محدّث لحظياً']) assert.ok(!html.includes(secret),secret);
 assert.ok(html.includes('تم التسليم')); assert.ok(html.includes('في الموعد')); assert.ok(html.includes('وقت التسليم'));
 assert.ok(!html.includes('wa.me/')); assert.ok(!html.includes('تبديل الابن')); assert.ok(html.includes('aria-selected="true"'));
});

test('parent cache excludes exercise contents, answers and signed file URLs',()=>{
 const data=parentPortalSnapshot({student:{id:'child',tenant_id:'tenant'},materials:[{type:'homework',title:'واجب',description:'PRIVATE',questions:'PRIVATE',submission_url:'PRIVATE',submission_status:'pending'}],quizzes:[{title:'كويز',score:8,max_score:10,questions:'PRIVATE'}]});
 assert.ok(!JSON.stringify(data).includes('PRIVATE'));
 assert.equal(data.materials[0].submission_status,'pending');
});
