import test from 'node:test';
import assert from 'node:assert/strict';
import {announcementTypeSchema,announcementTemplateSeeds,renderAnnouncement} from '../dist/features/announcements/catalog.js';
const context={teacher:'أحمد حسن',group:'مجموعة الأحد',portal:'https://centerly-eg.com/portal?role=student',contact:'201000000000'};
test('all twelve submitted templates retain consecutive parameter mappings and server-owned teacher/group/contact context',()=>{
 assert.equal(announcementTemplateSeeds.length,12);
 for(const template of announcementTemplateSeeds){
  assert.equal(announcementTypeSchema.safeParse(template).success,true,template.name);
  const values=Object.fromEntries(template.fields.filter(field=>['text','choice','date','datetime'].includes(field.type)).map(field=>[field.key,field.type==='choice'?field.options[0]:field.type==='date'?'2026-11-04':field.type==='datetime'?'2026-11-04T18:00':'المحتوى الدراسي']));
  if(values.old_time)values.old_time='2026-11-03T18:00';if(values.old_due)values.old_due='2026-11-03';
  const result=renderAnnouncement(template,values,context);assert.equal(result.parameters.length,template.fields.length);assert.equal(result.expected.id,template.id);assert.ok(result.text.includes(context.teacher));assert.ok(result.text.includes(context.group));assert.ok(!result.text.includes('{{'));
  assert.throws(()=>renderAnnouncement(template,{...values,teacher:'اسم من خارج الحساب'},context));
 }
});
test('announcement fields reject invalid dates, arbitrary message bodies, forged portal links and unapproved choice values',()=>{
 const notice=announcementTemplateSeeds.find(row=>row.key==='class_reminder'),fields={topic:'الفيزياء',event_time:'2026-11-03T18:00',location:'القاعة الأولى'};
 for(const event_time of ['2026-02-30T18:00','2026-11-03T25:00','03/11/26'])assert.throws(()=>renderAnnouncement(notice,{...fields,event_time},context));
 assert.throws(()=>renderAnnouncement(notice,{...fields,topic:'x'.repeat(161)},context));assert.throws(()=>renderAnnouncement(notice,{...fields,message:'رسالة مفتوحة'},context));
 const homework=announcementTemplateSeeds.find(row=>row.key==='homework_assigned');assert.throws(()=>renderAnnouncement(homework,{homework_title:'واجب',due:'2026-11-03'},{...context,portal:'javascript:alert(1)'}));
 const content=announcementTemplateSeeds.find(row=>row.key==='study_content');assert.throws(()=>renderAnnouncement(content,{content_type:'عرض تسويقي',content_title:'عرض'},context));
 assert.equal(announcementTypeSchema.safeParse({...notice,body:notice.body+' {{99}}'}).success,false);
});
