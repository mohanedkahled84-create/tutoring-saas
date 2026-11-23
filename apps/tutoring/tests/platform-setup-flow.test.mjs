import {test} from 'node:test';
import assert from 'node:assert/strict';
test('new Pro platform setup collects and publishes details; existing platforms remain on dashboard',async()=>{
 const saved={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage,fetch:globalThis.fetch};
 const data=new Map([['centrly_token','fixture-token']]);globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))};globalThis.sessionStorage={getItem:()=>null};
 globalThis.window={location:{hostname:'localhost'},teacherPlatformActions:null};
 const nodes=Object.fromEntries(Object.entries({builderTitleInput:'My school',builderSubjectInput:'Physics',builderSubdomainInput:'my-school',builderHeadlineInput:'Welcome',builderSubtitleInput:'Study together',builderCutoutInput:''}).map(([key,value])=>[key,{value,focus(){}}]));
 nodes.btnPublishPlatform={innerHTML:'Publish',disabled:false};nodes.platformSetupReview={innerHTML:''};nodes.platformSetupProgress={textContent:''};nodes.platformSetupProgressBar={value:0};
 const sections=[0,1,2,3].map(n=>({dataset:{platformStep:String(n)},style:{},hidden:true}));
 globalThis.document={documentElement:{},addEventListener(){},getElementById:id=>nodes[id]||null,querySelector:selector=>selector==='.platform-setup'?{}:null,querySelectorAll:selector=>selector==='[data-platform-step]'?sections:[]};
 let payload, renders=0, notifications=[];globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({settings:{...payload,is_active:true}})};};
 try{
  const {renderTeacherPlatformBuilderView,renderPlatformSetup,registerTeacherPlatformActions}=await import('../../web/src/components/TeacherPlatformBuilderView.js');
  const fresh=renderTeacherPlatformBuilderView({settings:null,plan:{is_pro:true,is_active:true}},{name:'Teacher'},[]);assert.match(fresh,/data-platform-step="0"/);assert.doesNotMatch(fresh,/tracking-student-row/);
  const prior=renderTeacherPlatformBuilderView({settings:{subdomain:'existing',is_active:true,display_title:'Existing'},plan:{is_pro:true}},{name:'Teacher'},[]);assert.doesNotMatch(prior,/data-platform-step="0"/);assert.match(prior,/existing\.centerly-eg\.com/);
  const app={user:{id:'u',tenant_id:'t'},platformBuilderState:{settings:null,plan:{is_pro:true}},showToast:m=>notifications.push(m),navigateTo(){},saveCache(){},renderMainContent(){renders++}};registerTeacherPlatformActions(app);
  const actions=window.teacherPlatformActions;actions.setupGo(1);nodes.builderSubdomainInput.value='ab';actions.setupGo(2);assert.equal(sections[1].hidden,false);assert.equal(payload,undefined);nodes.builderSubdomainInput.value='my-school';actions.setupGo(2);assert.equal(sections[2].hidden,false);assert.equal(app.platformBuilderState.setupDraft.title,'My school');
  actions.setupGo(3);assert.match(nodes.platformSetupReview.innerHTML,/my-school/);assert.equal(payload,undefined);
  await actions.savePlatformSettings();assert.equal(payload.subdomain,'my-school');assert.equal(payload.display_title,'My school');assert.equal(payload.subject_title,'Physics');assert.equal(payload.headline_text,'Welcome');assert.equal(payload.subtitle_text,'Study together');assert.equal(app.platformBuilderState.settings.subdomain,'my-school');assert.equal(app.platformBuilderState.setupDraft,undefined);assert.equal(renders,1);
  assert.match(renderPlatformSetup({step:2,title:'<script>'},{}),/&lt;script&gt;/);
 }finally{for(const [k,v] of Object.entries(saved))globalThis[k]=v;}
});
