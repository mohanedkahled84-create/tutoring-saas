import {z} from 'zod';
import {isPayDate} from './payroll.js';
import {familyPhone} from '../../shared/utils/parentFamily.js';
const date=z.string().refine(isPayDate);
export const followupQuery=z.object({group_id:z.uuid().optional(),student_id:z.uuid().optional(),from:date.optional(),to:date.optional(),q:z.string().trim().max(100).optional(),page:z.coerce.number().int().min(1).max(10000).optional()}).strict();
export const followupPrepare=z.object({group_id:z.uuid(),student_id:z.uuid(),from:date,to:date,recipient:z.enum(['parent','student'])}).strict();
export function whatsappFollowup(report:any,recipient:string){
 const phone=familyPhone(report.phone);
 if(!phone)throw Object.assign(new Error(recipient==='parent'?'لا يوجد رقم صحيح لولي الأمر؛ راجع بيانات الطالب':'لا يوجد رقم صحيح للطالب؛ راجع بيانات الطالب'),{status:400});
 const clean=(v:unknown)=>String(v ?? '').replace(/[\r\n\u0000-\u001f\u007f]/g,' ').trim();
 const a=report.attendance,g=report.grades,h=report.homework;
 const lines=[`تقرير متابعة الطالب: ${clean(report.student_name)}`,`المعلم: ${clean(report.teacher_name)}`,`المجموعة: ${clean(report.group_name)}`,`الفترة: ${report.from} إلى ${report.to}`,'',a.total?`الحضور للحصص المنتهية: ${a.present} حاضر، ${a.absent} غائب، ${a.unrecorded} لم يُرصد بعد.`:'لا توجد حصص منتهية في هذه الفترة.',g.total?`الاختبارات: ${g.recorded} نتيجة مسجلة، ${g.unrecorded} لم تُرصد بعد.`:'لا توجد اختبارات في هذه الفترة.'];
 if(g.latest)lines.push(`آخر نتيجة مسجلة: ${clean(g.latest.title)} — ${g.latest.score} / ${g.latest.max_score}`);
 lines.push(h.total?`الواجبات المنشورة في الفترة: ${h.total}، سُلّم منها ${h.submitted} (${h.on_time} في الموعد، ${h.late} متأخر، ${h.without_deadline} بدون موعد محدد)، لم يُسلّم ${h.not_submitted} منها ${h.overdue} فات موعده.`:'لا توجد واجبات منشورة في هذه الفترة.');
 const message=lines.join('\n');const {phone:_phone,...data}=report;
 return {...data,recipient,recipient_phone:phone,message,whatsapp_url:`https://wa.me/${phone}?text=${encodeURIComponent(message)}`};
}
