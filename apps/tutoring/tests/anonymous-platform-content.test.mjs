import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {publicPlatformRouter} from '../dist/features/platform-builder/routes.js';
import {SupabasePlatformBuilderRepository} from '../dist/features/platform-builder/repository.js';

test('anonymous content route refuses access without querying private material or leaking quiz keys', async t => {
  const app=express(); app.use('/api/platform',publicPlatformRouter);
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/platform/public/mr-teacher/content`);
  assert.equal(response.status,401); assert.equal(response.headers.get('cache-control'),'no-store');
  const body=await response.json(); assert.equal(body.error.code,'STUDENT_SESSION_REQUIRED');
  assert.equal(body.materials,undefined);
  const forbiddenClient={from(){throw new Error('Anonymous request must not query privileged content');}};
  const repository=new SupabasePlatformBuilderRepository(forbiddenClient,forbiddenClient);
  assert.deepEqual(await repository.getPublicMaterials('private-workspace'),[]);
});
