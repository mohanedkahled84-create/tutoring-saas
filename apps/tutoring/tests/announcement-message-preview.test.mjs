import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderAnnouncementMessagePreview} from '../../web/src/components/AnnouncementsView.js';
test('announcement preview follows selected recipients without repeating identical group messages',()=>{
 const old=globalThis.localStorage;globalThis.localStorage={getItem:()=> 'en'};
 try{
  const rows=[{phone:'1',rendered_body:'Class A',group_names:['Group A']},{phone:'2',rendered_body:'Class A',group_names:['Group A']},{phone:'3',rendered_body:'Class B',group_names:['Group B']}];
  const a=renderAnnouncementMessagePreview(rows,['1','2']);assert.match(a,/Class A/);assert.doesNotMatch(a,/Class B/);assert.equal((a.match(/Class A/g)||[]).length,1);
  const both=renderAnnouncementMessagePreview(rows,['1','3']);assert.match(both,/Class A/);assert.match(both,/Class B/);assert.match(both,/Other messages for the selected groups/);
  const example=renderAnnouncementMessagePreview(rows);assert.match(example,/Example message/);
  assert.match(renderAnnouncementMessagePreview([{phone:'4',rendered_body:'<script>',group_names:['<group>']}],['4']),/&lt;script&gt;/);
 }finally{globalThis.localStorage=old;}
});
