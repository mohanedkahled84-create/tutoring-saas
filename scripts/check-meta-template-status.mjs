// Read-only provider check; never sends messages or prints connection credentials.
import {config} from '../apps/tutoring/dist/shared/config/index.js';
const required=new Set(['centerly','centerly_student','centerly_assistant_account_added_v1']);
if(!config.meta.accessToken || !config.meta.wabaId)throw Error('Meta connection is not configured');
let after;const found=[];
for(let page=0;page<10;page++){
 const url=new URL(`https://graph.facebook.com/v22.0/${config.meta.wabaId}/message_templates`);
 url.searchParams.set('fields','name,status,category,language');url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);
 const response=await fetch(url,{headers:{Authorization:`Bearer ${config.meta.accessToken}`},signal:AbortSignal.timeout(10000)});
 if(!response.ok){console.log(JSON.stringify({providerStatus:response.status}));process.exitCode=1;break;}
 const data=await response.json();
 for(const row of data.data || [])if(required.has(row.name))found.push({name:row.name,status:row.status,category:row.category,language:row.language});
 if(!data.paging?.next)break;
 const next=data.paging?.cursors?.after;if(!next || next===after){process.exitCode=1;break;}after=next;
}
console.log(JSON.stringify({templates:found,webhookSecretConfigured:Boolean(config.meta.appSecret)}));
