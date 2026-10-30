import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarWeekRange,calendarDateKey} from '../../web/src/utils/calendarDateRange.js';

test('Calendar fetches the selected Saturday-Friday week across month/year boundaries',()=>{
  const anchor=new Date(2026,9,30,12);
  assert.deepEqual(calendarWeekRange(0,anchor),{from:'2026-10-24',to:'2026-10-30'});
  assert.deepEqual(calendarWeekRange(1,anchor),{from:'2026-10-31',to:'2026-11-06'});
  assert.deepEqual(calendarWeekRange(-1,anchor),{from:'2026-10-17',to:'2026-10-23'});
  assert.deepEqual(calendarWeekRange(0,new Date(2026,11,31,12)),{from:'2026-12-26',to:'2027-01-01'});
  assert.equal(calendarDateKey(anchor),'2026-10-30','Range calculation must not mutate its anchor');
});
