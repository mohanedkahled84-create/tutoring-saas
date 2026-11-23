import test from 'node:test';
import assert from 'node:assert/strict';
import {announcementListPage,renderAnnouncementList} from '../../web/src/components/AnnouncementsView.js';
test('announcement list filters and paginates without calling queued messages delivered',()=>{
 const data={announcements:Array.from({length:19},(_,i)=>({id:String(i),title:'Class '+i,status:i===1?'draft':'published',type_key:'cancel',group_ids:['g'],delivery:i===0?{delivered:1,queued:2}:{}})),catalog:[{key:'cancel',title:'إلغاء حصة'}]};
 const page=announcementListPage(data,{page:2});assert.equal(page.total,19);assert.equal(page.rows.length,8);assert.equal(page.pages,3);
 assert.equal(announcementListPage(data,{query:'Class 1',status:'draft'}).total,1);assert.equal(announcementListPage(data,{query:'missing'}).total,0);
 const html=renderAnnouncementList(data,{},{});assert.ok(html.includes('تم التسليم 1'));assert.ok(html.includes('في الانتظار 2'));assert.ok(!html.includes('Class 8'));
});
