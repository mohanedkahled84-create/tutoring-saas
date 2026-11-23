import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StudentsService,FakeStudentsRepository} from '../dist/features/students/index.js';
import {portalLoginTenant} from '../dist/shared/utils/portalDestination.js';

test('branded login resolves an active verified teacher domain and rejects stale bindings',async()=>{
 const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{tenant_id:'teacher-b'}})})})}),rpc:async()=>({data:{platform:{subdomain:'teacher-b',is_active:true},bound_subdomain:'teacher-b'}})};
 assert.equal(await portalLoginTenant(db,'https://teacher-b.centerly-eg.com'),'teacher-b');
 await assert.rejects(()=>portalLoginTenant(db,'https://teacher-a.centerly-eg.com'),/INVALID_CREDENTIALS/);
 assert.equal(await portalLoginTenant(db,'https://centerly-eg.com'),undefined);
});
test('repeated student codes and passwords remain scoped to the selected teacher',async()=>{
 const repo=new FakeStudentsRepository(),service=new StudentsService(repo);
 for(const tenant of ['teacher-a','teacher-b'])await repo.create(tenant,{name:tenant,code:'1001',student_code:'1001',portal_password:'123456'});
 const result=await service.authenticatePortalUser({identifier:'1001',password:'123456',role:'student'},'teacher-b');
 assert.equal(result.student.name,'teacher-b');
 await assert.rejects(()=>service.authenticatePortalUser({identifier:'1001',password:'wrong',role:'student'},'teacher-b'),/INVALID_CREDENTIALS/);
 await assert.rejects(()=>service.authenticatePortalUser({identifier:'1001',password:'123456',role:'student'},'teacher-c'),/INVALID_CREDENTIALS/);
});
