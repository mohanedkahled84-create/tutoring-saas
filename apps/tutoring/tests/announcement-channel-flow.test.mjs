import test from 'node:test';
import assert from 'node:assert/strict';
import {registerAnnouncementsActions} from '../../web/src/components/AnnouncementsView.js';

test('publish saves the selected channels and opens review only for WhatsApp', async () => {
  const oldWindow=globalThis.window, oldDocument=globalThis.document;
  try {
    for (const [portal, whatsapp] of [[true,false],[false,true],[true,true]]) {
      const calls=[];
      const title={value:'Test'}, fields={annTitle:title,annPortal:{checked:portal},annWhatsApp:{checked:whatsapp}};
      const control={value:'publish',innerHTML:'Publish',setAttribute(){},removeAttribute(){}};
      const form={querySelector:selector=>fields[selector.slice(1)] || null,querySelectorAll:selector=>selector.includes('button')?[control]:[]};
      globalThis.document={getElementById:id=>({annExpiry:{value:''},annTitle:title,annType:{value:''},annManual:{value:'Message'}}[id]),querySelectorAll:selector=>selector.includes('annGroup')?[{value:'group'}]:selector.includes('annRole')?[{value:'student'}]:[]};
      const app={user:{id:'user',tenant_id:'tenant'},_announcement:{id:'id',status:'draft',values:{}},loadRouteData:async()=>{},closeModal(){this.closed=true},showToast(){},previewAnnouncement:async()=>{app.reviewed=true}};
      globalThis.window={centrlyApp:app,__CENTRLY_DELEGATED_REQUEST__:async (url,options)=>{calls.push({url,options});return url==='/announcements/id'?{announcement:{id:'id',revision:1}}:{};}};
      registerAnnouncementsActions(app);
      app.previewAnnouncement=async()=>{app.reviewed=true};
      await app.saveAnnouncement({preventDefault(){},submitter:control,currentTarget:form});
      assert.equal(calls[0].options.body.publish_on_portal,portal);
      assert.equal(calls[2].url,'/announcements/id/publish');
      assert.equal(Boolean(app.reviewed),whatsapp);
      assert.equal(Boolean(app.closed),!whatsapp);
      assert.equal(control.disabled,false);
    }
  } finally {globalThis.window=oldWindow;globalThis.document=oldDocument;}
});

test('one confirmation records consent before queueing and blocks duplicate submissions', async () => {
 const oldWindow=globalThis.window,oldDocument=globalThis.document,calls=[];let release;
 try{
  const check={checked:true},choice={dataset:{annRecipient:'0'}},button={disabled:false,isConnected:true};
  globalThis.document={getElementById:id=>id==='annSendConfirmed'?check:null,querySelectorAll:selector=>selector==='[data-ann-recipient]:checked'?[choice]:selector==='[data-ann-confirm-send]'?[button]:[]};
  const app={user:{id:'user',tenant_id:'tenant'},_announcement:{id:'ann'},_announcementPreview:{preview_id:'preview',announcement:{revision:2},allowance:{remaining:1,unit_cost_egp:1},rows:[{phone:'201000000000'}]},loadRouteData:async()=>{},showToast(){}};
  globalThis.window={centrlyApp:app,__CENTRLY_DELEGATED_REQUEST__:async (url,options)=>{calls.push({url,options});if(url.endsWith('/consent'))await new Promise(r=>release=r);return {};}};
  registerAnnouncementsActions(app);app.openAnnouncement=async()=>{};
  const first=app.sendAnnouncement('enqueue');await Promise.resolve();await app.sendAnnouncement('enqueue');assert.equal(calls.length,1);release();await first;
  assert.deepEqual(calls.map(call=>call.url),['/announcements/ann/consent','/announcements/ann/enqueue']);assert.equal(calls[0].options.body.confirmed,true);
  check.checked=false;await app.sendAnnouncement('enqueue');assert.equal(calls.length,2);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
