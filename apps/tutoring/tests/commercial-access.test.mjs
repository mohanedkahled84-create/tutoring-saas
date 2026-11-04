import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialRequestDecision} from '../dist/shared/middleware/commercialAccess.js';
const now=Date.parse('2026-11-04T12:00:00Z');
const paid={legacy:false,active:true,teaching_platform:false,period_end:new Date(now+86400000).toISOString()};
test('Basic keeps management available and restricts online teaching features',()=>{
 for(const path of ['/api/students','/api/groups','/api/sessions','/api/announcements'])assert.equal(commercialRequestDecision(paid,'POST',path,{},now),null);
 for(const path of ['/api/platform','/api/quizzes/publish-online'])assert.equal(commercialRequestDecision(paid,'POST',path,{},now).code,'PLAN_FEATURE_REQUIRED');
 assert.equal(commercialRequestDecision(paid,'POST','/api/materials',{type:'video'},now).code,'PLAN_FEATURE_REQUIRED');
 assert.equal(commercialRequestDecision(paid,'POST','/api/materials',{type:'pdf'},now),null);
 assert.equal(commercialRequestDecision(paid,'POST','/api/quizzes/rich',{exam_mode:'paper'},now),null);
 assert.equal(commercialRequestDecision(paid,'GET','/api/quizzes/rich',{},now),null);
 assert.equal(commercialRequestDecision(paid,'GET','/api/quizzes/submissions',{},now),null);
 assert.equal(commercialRequestDecision(paid,'POST','/api/quizzes/rich',{exam_mode:'online'},now).code,'PLAN_FEATURE_REQUIRED');
 assert.equal(commercialRequestDecision({...paid,teaching_platform:true},'POST','/api/platform',{},now),null);
});
test('expired plan permits reads and exports for seven days, never writes',()=>{
 const expired={...paid,active:false,period_end:new Date(now-86400000).toISOString()};
 assert.equal(commercialRequestDecision(expired,'GET','/api/reports',{},now),null);
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(commercialRequestDecision(expired,method,'/api/students',{},now).code,'SUBSCRIPTION_EXPIRED');
 assert.equal(commercialRequestDecision({...expired,period_end:new Date(now-8*86400000).toISOString()},'GET','/api/reports',{},now).code,'SUBSCRIPTION_EXPIRED');
 assert.equal(commercialRequestDecision({...expired,period_end:null},'GET','/api/students',{},now).code,'SUBSCRIPTION_EXPIRED');
});
test('suspended and deleted workspaces cannot reuse the paid grace period',()=>{
 assert.equal(commercialRequestDecision({...paid,suspended:true},'GET','/api/students',{},now).code,'SUBSCRIPTION_SUSPENDED');
});
test('legacy accounts retain their feature access until an explicit plan migration',()=>{
 assert.equal(commercialRequestDecision({legacy:true},'GET','/api/platform',{},now),null);
});
