import test from 'node:test';
import assert from 'node:assert/strict';
import { StudentsService } from '../dist/features/students/service.js';

test('duplicate phone reports all existing memberships without creating a record', async () => {
  let created = false;
  const repo = {
    findByPhone: async () => ({ id: 'student', name: 'Student', group_id: 'primary', group_ids: ['primary', 'second'], archived_at: null }),
    create: async () => { created = true; },
  };
  const service = new StudentsService(repo);
  await assert.rejects(service.createStudent('tenant', { name: 'Student', student_phone: '01012345678', parent_phone: '01012345679' }), error => {
    assert.equal(error.existingStudent.id, 'student');
    assert.deepEqual(error.existingStudent.group_ids, ['primary', 'second']);
    return true;
  });
  assert.equal(created, false);
});
