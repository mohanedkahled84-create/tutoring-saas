import test from 'node:test';
import assert from 'node:assert/strict';
import {studentDiscount} from '../../web/src/utils/studentDiscount.js';
import {renderStudentsView,renderStudentDetails} from '../../web/src/components/StudentsView.js';
import {SessionsService} from '../dist/features/sessions/service.js';
import {createStudentSchema,updateStudentSchema} from '../dist/shared/middleware/validation.js';

test('Discount uses the final session fee, with cents and full exemption supported',()=>{
 assert.deepEqual(studentDiscount(100,20),{fee:80,discount:20,fee_override:80,exempt:false});
 assert.equal(studentDiscount(100,'20.25').fee_override,79.75);
 assert.deepEqual(studentDiscount(100,100),{fee:0,discount:100,fee_override:null,exempt:true});
 assert.deepEqual(studentDiscount(100,''),{fee:100,discount:0,fee_override:null,exempt:false});
 for(const value of [-1,101,'bad',Infinity,0.001])assert.throws(()=>studentDiscount(100,value));
});
test('Saved discount fields pass student API validation and drive actual session revenue',()=>{
 const pricing=studentDiscount(100,20),{fee,discount,...payload}=pricing;
 const create=createStudentSchema.parse({name:'طالب اختبار',parent_phone:'01000000000',student_phone:'01100000000',...payload});
 const edit=updateStudentSchema.parse(payload);
 assert.equal(create.fee_override,80);assert.equal(edit.fee_override,80);
 const service=new SessionsService({});
 const group={id:'g1',name:'المجموعة',price:100};
 const summary=service.calculateFinancialSummary('session',group,[{students:{id:'student',name:'طالب',...edit},attended:true}]);
 assert.equal(summary.financials.total_revenue,80);
 assert.equal(summary.breakdown[0].fee_charged,80);
 const full=studentDiscount(100,100),{fee:f,discount:d,...free}=full;
 const exempt=updateStudentSchema.parse(free);
 assert.equal(service.calculateFinancialSummary('session',group,[{students:{id:'student',...exempt}}]).financials.total_revenue,0);
 const clear=studentDiscount(100,0),{fee:f2,discount:d2,...reset}=clear;
 assert.equal(service.calculateFinancialSummary('session',group,[{students:{id:'student',...updateStudentSchema.parse(reset)}}]).financials.total_revenue,100);
});
test('Roster stays compact; popup keeps actions and permission-gated masked passwords',()=>{
 const student={id:'s1',name:'طالب',code:'1',group_id:'g1',fee_override:80,portal_password:'secret'};
 const groups=[{id:'g1',name:'المجموعة',price:100}];
 const roster=renderStudentsView([student],groups);
 assert.ok(!roster.includes('roster-detail-panel'));
 assert.ok(roster.includes('خصم 20'));assert.ok(!roster.includes('secret'));
 const owner=renderStudentDetails(student,groups,{});
 assert.ok(owner.includes('student-password-toggle'));assert.ok(!owner.includes('secret'));
 for(const handler of ['editStudent','openStudentTransfer','openStudentClassroomHistory','archiveClassroomRecord','openParentNoteModal','copyStudentLink','copyParentLink'])assert.ok(owner.includes(handler));
 const assistant=renderStudentDetails(student,groups,{delegation:{permissions:{'students.send':false}}});
 assert.ok(!assistant.includes('student-password-toggle'));
});
