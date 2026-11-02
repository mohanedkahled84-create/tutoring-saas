import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: Google onboarding RPC is service-only and editable user metadata cannot forge a Google identity',{timeout:90000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),password='isolated-Google-fixture-2026';let user;
 t.after(async()=>{if(user)assert.equal((await db.auth.admin.deleteUser(user.id)).error,null);});
 const created=await db.auth.admin.createUser({email:`google-identity-${randomUUID()}@isolated.invalid`,password,email_confirm:true,user_metadata:{provider:'google',role:'admin',email_verified:true}});
 assert.equal(created.error,null);user=created.data.user;
 const denied=await db.rpc('google_teacher_profile',{p_user:user.id,p_data:null});
 assert.notEqual(denied.error?.code,'PGRST202','The real migration must be installed');assert.match(denied.error?.message || '',/GOOGLE_IDENTITY_REQUIRED/);
 assert.equal((await anonClient.rpc('google_teacher_profile',{p_user:user.id,p_data:null})).error?.code,'42501');
 const signed=await anonClient.auth.signInWithPassword({email:user.email,password});assert.equal(signed.error,null);
 const scoped=createClient(process.env.SUPABASE_TEST_URL,process.env.SUPABASE_TEST_ANON_KEY,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+signed.data.session.access_token}}});
 assert.equal((await scoped.rpc('google_teacher_profile',{p_user:user.id,p_data:null})).error?.code,'42501');
 assert.equal((await db.from('users').select('id').eq('id',user.id)).data.length,0,'Forged metadata did not create a teacher profile');
});
