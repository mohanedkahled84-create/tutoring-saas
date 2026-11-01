import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionInput,collectionQuery,voidCollectionInput} from '../dist/features/assistants/collectionSchemas.js';
import {assistantCatalog,validateAssistantAccess} from '../dist/features/assistants/access.js';
import {renderCollectionRows,registerCollectionOwnerActions} from '../../web/src/components/CollectionLedger.js';
import {safeAssistantChanges} from '../dist/features/assistants/activity.js';

const valid={group_id:'10000000-0000-4000-8000-000000000001',student_id:'20000000-0000-4000-8000-000000000001',request_id:'30000000-0000-4000-8000-000000000001',amount:125.5,payment_method:'cash'};
test('collection amounts are actual positive money with two decimal places and no forged actor or tenant',()=>{
 assert.equal(collectionInput.parse(valid).amount,125.5);
 for(const amount of [0,-1,NaN,Infinity,1.001,100000001,'5'])assert.throws(()=>collectionInput.parse({...valid,amount}));
 for(const key of ['tenant_id','assistant_id','actor_name','collected_at','status'])assert.throws(()=>collectionInput.parse({...valid,[key]:'forged'}));
 assert.throws(()=>collectionInput.parse({...valid,request_id:'invalid'}));assert.throws(()=>voidCollectionInput.parse({reason:'x'}));assert.throws(()=>collectionQuery.parse({page:0}));assert.throws(()=>collectionQuery.parse({from:'2026-02-30'}));
});
test('owner receipt amounts respect optional number masking without an extra password',()=>{
 let unlocked=0,notices=0;
 const app={hideFinancialNumbers:true,hasSecurityPin:true,isFinancialUnlocked:false,promptUnlockFinancials(){unlocked++;},showToast(){notices++;},showModal(){throw new Error('must not show concealed amounts');}};
 registerCollectionOwnerActions(app);app.openCollectionLedger();assert.equal(unlocked,0);
 app.isFinancialUnlocked=true;app.hideFinancialNumbers=true;app.openCollectionLedger();assert.equal(notices,2);
});
test('collection access is closed by default and never offers assistant edit/delete authority',()=>{
 assert.equal(validateAssistantAccess({}).permissions['collections.view'],undefined);
 assert.deepEqual([...assistantCatalog.find(p=>p.key==='collections').actions],['view','create']);
 assert.throws(()=>validateAssistantAccess({permissions:{'collections.create':true}}));assert.throws(()=>validateAssistantAccess({permissions:{'collections.view':true,'collections.edit':true}}));
});
test('receipt history escapes personal text and exposes void controls only to the owner',()=>{
 const rows=[{id:'receipt',student_name:'<img src=x>',actor_name:'<script>bad</script>',amount:125.5,payment_method:'cash',collected_at:'2026-11-01T00:00:00Z',status:'active'}];
 assert.ok(!renderCollectionRows(rows).includes('<img'));assert.ok(!renderCollectionRows(rows).includes('<script>'));assert.ok(!renderCollectionRows(rows).includes('data-void='));assert.ok(renderCollectionRows(rows,true).includes('data-void="receipt"'));
 assert.ok(!renderCollectionRows([{...rows[0],status:'void',void_reason:'تصحيح'}],true).includes('data-void='));
 assert.deepEqual(safeAssistantChanges('collections.create',{after:{amount:125.5,payment_method:'cash',password_hash:'secret',actor_user_id:'private'}}),{before:{},after:{amount:125.5,payment_method:'cash'}});
});
