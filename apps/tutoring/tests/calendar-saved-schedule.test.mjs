import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarMonthRange,calendarToday,calendarSessionOnDate} from '../../web/src/utils/calendarDateRange.js';
import {SupabaseSessionsRepository} from '../dist/features/sessions/repository.js';
test('calendar uses actual Cairo date, real month length and dated exceptions instead of repeating them weekly',()=>{
 assert.equal(calendarToday(new Date('2026-11-03T22:30:00Z')).getDate(),4);
 assert.deepEqual(calendarMonthRange(0,new Date(2028,1,12,12)),{from:'2028-02-01',to:'2028-02-29'});
 assert.deepEqual(calendarMonthRange(1,new Date(2026,11,12,12)),{from:'2027-01-01',to:'2027-01-31'});
 const weekly={is_recurring:true,group_id:'g',day_name:'الأحد'},moved={group_id:'g',session_date:'2026-11-01',original_session_date:'2026-11-01',date:'2026-11-03',status:'rescheduled'},extra={is_extra:true,group_id:'g',date:'2026-11-08',status:'cancelled'};
 assert.equal(calendarSessionOnDate(weekly,'2026-11-01',[weekly,moved]),false);
 assert.equal(calendarSessionOnDate(moved,'2026-11-03'),true);assert.equal(calendarSessionOnDate(moved,'2026-11-10'),false);
 assert.equal(calendarSessionOnDate(weekly,'2026-11-08',[weekly,moved,extra]),true,'A cancelled extra must not cancel the normal weekly class');
});
test('calendar range query includes moved-in classes and refuses malformed dates before building filters',async()=>{
 const calls=[];let failure=null;const chain={select(){return this;},eq(k,v){calls.push([k,v]);return this;},or(v){calls.push(['or',v]);return this;},order(){return this;},then(resolve){resolve(failure?{error:failure}:{data:[]});}};
 const repo=new SupabaseSessionsRepository({from:()=>chain});await repo.getSessionsByDateRange('trusted-tenant','2026-11-01','2026-11-30');assert.deepEqual(calls[0],['tenant_id','trusted-tenant']);assert.match(calls[1][1],/rescheduled_to_date.gte.2026-11-01/);assert.match(calls[1][1],/original_session_date.gte.2026-11-01/);
 const count=calls.length;for(const range of [['2026-02-30','2026-03-02'],['2026-11-01),tenant_id.eq.other','2026-11-30'],['2026-11-02','2026-11-01']])await assert.rejects(()=>repo.getSessionsByDateRange('trusted-tenant',...range),/INVALID_CALENDAR_RANGE/);assert.equal(calls.length,count);
 failure={message:'database unavailable'};await assert.rejects(()=>repo.getSessionsByDateRange('trusted-tenant','2026-11-01','2026-11-30'),/database unavailable/);
});
