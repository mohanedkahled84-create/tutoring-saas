import test from 'node:test';
import assert from 'node:assert/strict';
import {portalPreferencesSchema,resolvePortalPreferences} from '../dist/shared/utils/portalPreferences.js';
import {renderPortalHomeSummary} from '../../web/src/components/PortalHomeSummary.js';
test('portal preferences accept independent ranks, safe text and late policy, rejecting rejected settings and malformed values',()=>{
 assert.equal(portalPreferencesSchema.safeParse({show_parent_rank:false,show_student_rank:true,accept_late_homework:false,welcome_message:'أهلاً'}).success,true);
 for(const input of [{show_results:true},{show_dues:true},{accept_late_homework:'false'},{welcome_message:'x'.repeat(501)}])assert.equal(portalPreferencesSchema.safeParse(input).success,false);
 assert.equal(resolvePortalPreferences({accept_late_homework:false}).accept_late_homework,false);
});
test('parents see their own rank only; disabled sections and HTML in teacher text cannot leak into home',()=>{
 const data={preferences:{show_parent_rank:true,show_student_rank:false,show_student_leaderboard:true,show_upcoming_sessions:false,show_announcements:false,welcome_message:'<img src=x onerror=alert(1)>'},summary:{student_rank:2,group_size:10},leaderboard:{entries:[{name:'PRIVATE-PEER',position:1}]},upcoming_sessions:[{group_name:'HIDDEN-SESSION'}],announcements:[{title:'HIDDEN-NOTICE'}]};
 const parent=renderPortalHomeSummary(data,'parent');assert.ok(parent.includes('المركز 2 من 10'));for(const hidden of ['PRIVATE-PEER','HIDDEN-SESSION','HIDDEN-NOTICE','<img'])assert.ok(!parent.includes(hidden));assert.ok(parent.includes('&lt;img'));
 const student=renderPortalHomeSummary(data);assert.ok(student.includes('PRIVATE-PEER'));assert.ok(!student.includes('المركز 2 من 10'));
});
