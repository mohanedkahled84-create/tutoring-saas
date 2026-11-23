import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portalRecipientIds} from '../dist/features/students/portalRecipientSelection.js';

test('portal batches require an explicit nonempty student selection', () => {
  for (const input of [undefined, null, [], '', [''], ['student', null]]) {
    assert.equal(portalRecipientIds(input), null);
  }
  const selected = portalRecipientIds([' student-1 ', 'student-1']);
  assert.deepEqual([...selected], ['student-1']);
  assert.equal(selected.has('student-2'), false);
});
