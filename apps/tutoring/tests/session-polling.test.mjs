import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// Execute the real polling method in a browser-like context without loading UI dependencies.
const source=readFileSync(new URL('../../web/src/components/SessionsView.js',import.meta.url),'utf8');
const method=source.slice(source.indexOf('app.pollLiveSessionUpdates ='),source.indexOf('// Session Finalization & Note Choice'));
function harness(request){
 const app={sessionState:{id:'session-a',status:'in_progress',attendanceList:[]},getOfflineAttendanceQueue:()=>[]};
 const document={visibilityState:'visible'},navigator={onLine:true};
 vm.runInNewContext(method,{app,document,navigator,request,Date});
 return {app,document,navigator};
}
test('attendance polling makes no requests in hidden/offline tabs',async()=>{
 let calls=0;const h=harness(async()=>{calls++;});
 h.document.visibilityState='hidden';await h.app.pollLiveSessionUpdates();
 h.document.visibilityState='visible';h.navigator.onLine=false;await h.app.pollLiveSessionUpdates();assert.equal(calls,0);
});
test('attendance polling coalesces focus/timer events and ignores a previous session response',async()=>{
 let calls=0,release;const {app}=harness(()=>{calls++;return new Promise(r=>{release=r;});});
 const first=app.pollLiveSessionUpdates();await app.pollLiveSessionUpdates();assert.equal(calls,1);
 app.sessionState={id:'session-b',status:'in_progress',attendanceList:[]};
 release({session:{status:'ended'}});await first;assert.equal(app.sessionState.status,'in_progress');assert.equal(app._sessionPollInFlight,false);
});
