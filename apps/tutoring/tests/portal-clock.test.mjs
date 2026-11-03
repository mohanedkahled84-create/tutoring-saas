import test from 'node:test';
import assert from 'node:assert/strict';
import {portalCairoClock} from '../../web/src/utils/portalClock.js';
test('quiz availability shows the Cairo calendar day and clock through midnight and daylight saving',()=>{
 assert.deepEqual(portalCairoClock(new Date('2026-11-03T23:30:00Z')),{date:'2026-11-04',time:'01:30'});
 assert.deepEqual(portalCairoClock(new Date('2026-07-03T22:30:00Z')),{date:'2026-07-04',time:'01:30'});
});
