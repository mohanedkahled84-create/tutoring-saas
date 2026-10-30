/**
 * Copy/verify before changing a reference. Default is a read-only inventory.
 * Run only after 20261030173319 and the signing-capable backend are deployed.
 * No files or SQL history are deleted by this script. Public copies are removed
 * only with the additional --remove-public-copies flag, after byte verification.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../apps/tutoring/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedRef = process.env.HOMEWORK_MIGRATION_PROJECT_REF;
if (!url || !key || !expectedRef || new URL(url).hostname !== `${expectedRef}.supabase.co`) {
  throw new Error('Provide an explicit matching HOMEWORK_MIGRATION_PROJECT_REF and server credentials');
}
const apply = process.argv.includes('--apply');
const remove = process.argv.includes('--remove-public-copies');
if (remove && !apply) throw new Error('--remove-public-copies requires --apply');
const backupDir = process.env.HOMEWORK_MIGRATION_BACKUP_DIR;
const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
const backupRelative = backupDir ? relative(repository, resolve(backupDir)) : '';
if (apply && (!backupDir || (!isAbsolute(backupRelative) && !backupRelative.startsWith('..')))) {
  throw new Error('Provide HOMEWORK_MIGRATION_BACKUP_DIR outside the repository');
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const source = 'homework-submissions';
const destination = 'homework-private';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objectPaths = [];
async function list(prefix = '', depth = 0) {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(source).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const item of data || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id && depth < 2 && uuid.test(item.name)) await list(path, depth + 1);
      else if (item.id && depth === 2 && uuid.test(item.name.slice(0, 36)) && item.name[36] === '_') objectPaths.push(path);
    }
    if (!data || data.length < 100) break;
  }
}
await list();
const { data: rows, error } = await client.from('homework_submissions').select('id,tenant_id,material_id,student_id,file_url').not('file_url', 'is', null);
if (error) throw error;
function sourcePath(value) {
  try {
    const parsed = new URL(value);
    if (parsed.origin !== new URL(url).origin) return null;
    const prefix = `/storage/v1/object/public/${source}/`;
    return parsed.pathname.startsWith(prefix) ? decodeURIComponent(parsed.pathname.slice(prefix.length)) : null;
  } catch { return null; }
}
const references = (rows || []).filter(row => sourcePath(row.file_url));
for (const row of references) {
  const path = sourcePath(row.file_url);
  if (!path.startsWith(`${row.tenant_id}/${row.material_id}/${row.student_id}_`)) throw new Error('Submission path does not match its owner; stopped');
  if (!objectPaths.includes(path)) throw new Error('Referenced source file is missing; stopped without changing references');
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'inventory', privateFiles: objectPaths.length, references: references.length, removePublicCopies: remove }));
if (!apply) process.exit(0);
const { data: bucket, error: bucketError } = await client.storage.getBucket(destination);
if (bucketError || !bucket || bucket.public) throw new Error('Verified private destination bucket is required');
await mkdir(backupDir, { recursive: true });
await writeFile(join(backupDir, 'original-submission-references.json'), JSON.stringify(references, null, 2), { flag: 'wx' });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = [];
for (const path of objectPaths) {
  const old = await client.storage.from(source).download(path);
  if (old.error || !old.data) throw new Error('Unable to back up a source file');
  const bytes = Buffer.from(await old.data.arrayBuffer());
  const hash = sha(bytes);
  // Back up actual bytes before modifying any reference or public copy.
  await writeFile(join(backupDir, `${manifest.length}-${hash}.bin`), bytes, { flag: 'wx' });
  const uploaded = await client.storage.from(destination).upload(path, bytes, { contentType: old.data.type || 'application/octet-stream', upsert: false });
  if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) throw new Error('Copy to private storage failed');
  const copied = await client.storage.from(destination).download(path);
  if (copied.error || !copied.data || sha(Buffer.from(await copied.data.arrayBuffer())) !== hash) throw new Error('Private copy checksum mismatch');
  const signed = await client.storage.from(destination).createSignedUrl(path, 60);
  if (signed.error || !signed.data?.signedUrl) throw new Error('Private file signing failed');
  const check = await fetch(signed.data.signedUrl);
  if (!check.ok || sha(Buffer.from(await check.arrayBuffer())) !== hash) throw new Error('Signed file read verification failed');
  for (const row of references.filter(row => sourcePath(row.file_url) === path)) {
    const saved = await client.from('homework_submissions').update({ file_url: path }).eq('id', row.id).eq('tenant_id', row.tenant_id).eq('file_url', row.file_url).select('id');
    if (saved.error || saved.data?.length !== 1) throw new Error('Concurrent submission change; stopped without deleting its old file');
  }
  manifest.push({ path, sha256: hash, bytes: bytes.length, referenceIds: references.filter(row => sourcePath(row.file_url) === path).map(row => row.id) });
  await writeFile(join(backupDir, 'verified-manifest.json'), JSON.stringify(manifest, null, 2));
}
// Delete only after ALL copies, backups, signatures and reference updates succeed.
if (remove) {
  for (const entry of manifest) {
    const { count, error } = await client.from('homework_submissions').select('id', { count: 'exact', head: true }).eq('file_url', `${url}/storage/v1/object/public/${source}/${entry.path}`);
    if (error || count !== 0) throw new Error('A public reference remains; stopped cleanup');
    const deleted = await client.storage.from(source).remove([entry.path]);
    if (deleted.error) throw new Error('Cleanup failed; private data and backup retained');
  }
}
console.log(JSON.stringify({ verifiedFiles: manifest.length, referencesUpdated: references.length, publicCopiesRemoved: remove ? manifest.length : 0 }));
