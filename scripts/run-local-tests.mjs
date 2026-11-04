// Default development/PR checks never contact the shared Supabase quota.
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const cwd=fileURLToPath(new URL('../apps/tutoring/',import.meta.url));
const legacyLive=new Set(['audit-c01-rls.test.mjs','audit-c02-rpcs.test.mjs','security-lockdown-verification.test.mjs']);
const files=readdirSync(new URL('../apps/tutoring/tests/',import.meta.url)).filter(name=>name.endsWith('.test.mjs')&&!name.endsWith('-live.test.mjs')&&!legacyLive.has(name));
const env={...process.env,NODE_OPTIONS:'',NODE_ENV:'test',SUPABASE_URL:'http://127.0.0.1:9',SUPABASE_ANON_KEY:'local-tests-placeholder-anon',SUPABASE_SERVICE_ROLE_KEY:'',INTERNAL_API_SECRET:'local-tests-internal-secret-token',SUPABASE_TEST_URL:'',SUPABASE_TEST_ANON_KEY:'',SUPABASE_TEST_SERVICE_ROLE_KEY:'',REQUIRE_LIVE_SUPABASE_TESTS:'false',EVOLUTION_API_URL:'',EVOLUTION_API_KEY:'',META_ACCESS_TOKEN:'',RESEND_API_KEY:'',N8N_ADMIN_ALERT_WEBHOOK_URL:'http://127.0.0.1:9/webhook/centrly-admin-alerts',SENTRY_DSN:''};
const result=spawnSync(process.execPath,['--require',fileURLToPath(new URL('../apps/tutoring/tests/helpers/local-network-guard.cjs',import.meta.url)),'--test','--test-reporter=tap','--test-concurrency=1',...files.map(name=>'tests/'+name)],{cwd,env,stdio:'inherit'});
if(result.error)console.error(result.error.message);
process.exitCode=result.status??1;
