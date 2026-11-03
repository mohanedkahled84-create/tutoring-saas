import "./instrument.js";
import { app } from "./app.js";
import { config } from "./shared/config/index.js";
import {getServiceSupabaseClient} from './supabase.js';
import {MetaCloudService,HttpMetaCloudGateway,SupabaseMetaPortalQueueRepository} from './features/whatsapp-notifications/index.js';
import {createMetaPortalWorker} from './features/whatsapp-notifications/meta-portal-worker.js';

import {createAccountDeletionWorker} from './features/auth/accountDeletionWorker.js';
import {createAnnouncementWorker} from './features/announcements/worker.js';

const server = app.listen(config.port, () => {
  console.log(`[Tutoring SaaS Backend] Server running on port ${config.port}`);
});

// Configure server timeouts to accommodate large file uploads (up to 100MB) on variable mobile networks
server.requestTimeout = 900000; // 15 minutes (matches Railway proxy max stream limit)
server.headersTimeout = 120000; // 2 minutes
server.keepAliveTimeout = 65000; // 65 seconds

if(config.nodeEnv==='production' && config.supabaseServiceRoleKey){
 const deletion=createAccountDeletionWorker(getServiceSupabaseClient(),()=>console.warn('[Account cleanup] Will retry.'));
 const deletionInterval=setInterval(()=>void deletion.tick(),30_000);deletionInterval.unref();
 server.once('close',()=>{deletion.stop();clearInterval(deletionInterval);});
}

if(config.nodeEnv==='production' && config.meta.accessToken && config.meta.phoneNumberId && config.meta.wabaId && config.supabaseServiceRoleKey){
 const announcements=createAnnouncementWorker(getServiceSupabaseClient(),new HttpMetaCloudGateway(config.meta.phoneNumberId,config.meta.accessToken,config.meta.wabaId),()=>console.warn('[Announcements] Processing deferred.'));
 const announcementInterval=setInterval(()=>void announcements.tick(),15_000);announcementInterval.unref();
 server.once('close',()=>{announcements.stop();clearInterval(announcementInterval);});
 const worker=createMetaPortalWorker(new MetaCloudService(new SupabaseMetaPortalQueueRepository(getServiceSupabaseClient()),new HttpMetaCloudGateway(config.meta.phoneNumberId,config.meta.accessToken,config.meta.wabaId),config.meta.dailyLimit),()=>console.warn('[Meta portal queue] Processing deferred; will check again.'));
 const interval=setInterval(()=>void worker.tick(),5*60*1000);interval.unref();
 const initial=setTimeout(()=>void worker.tick(),60*1000);initial.unref();
 server.once('close',()=>{worker.stop();clearInterval(interval);clearTimeout(initial);});
}

export default server;
