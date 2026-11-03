import {z} from 'zod';

const fieldSchema=z.object({key:z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),label:z.string().trim().min(1).max(80),type:z.enum(['text','date','datetime','choice','teacher','group','portal','contact']),options:z.array(z.string().trim().min(1).max(80)).min(2).max(10).optional()}).strict();
export const announcementDefinitionSchema=z.object({key:z.string().regex(/^[a-z][a-z0-9_]{2,49}$/),name:z.string().regex(/^centerly_[a-z0-9_]{3,70}$/),title:z.string().trim().min(1).max(100),body:z.string().min(80).max(1024),fields:z.array(fieldSchema).min(3).max(10)}).strict().superRefine((value,ctx)=>{
 const indices=[...new Set([...value.body.matchAll(/\{\{(\d+)\}\}/g)].map(match=>Number(match[1])))].sort((a,b)=>a-b);
 if(indices.length!==value.fields.length || indices.some((n,i)=>n!==i+1))ctx.addIssue({code:'custom',message:'كل متغير في القالب يحتاج حقلًا محددًا بالترتيب'});
 if(/\{\{|\}\}/.test(value.body.replace(/\{\{\d+\}\}/g,'')))ctx.addIssue({code:'custom',message:'صيغة متغيرات القالب غير صالحة'});
 if(new Set(value.fields.map(field=>field.key)).size!==value.fields.length)ctx.addIssue({code:'custom',message:'أسماء الحقول يجب أن تكون مختلفة'});
 for(const type of ['teacher','group','contact'])if(!value.fields.some(field=>field.type===type))ctx.addIssue({code:'custom',message:'يلزم تحديد المدرس والمجموعة ورقم التواصل من الحساب'});
 for(const field of value.fields){if(field.type==='choice' && !field.options || field.type!=='choice' && field.options)ctx.addIssue({code:'custom',message:'راجع اختيارات الحقول'});if(field.type==='text' && /^(body|message|free_text|content)$/i.test(field.key))ctx.addIssue({code:'custom',message:'استخدم حقولًا محددة للحدث بدل نص رسالة عام'});}
 if(value.body.replace(/\{\{\d+\}\}/g,'').trim().length<60)ctx.addIssue({code:'custom',message:'اكتب وصفًا ثابتًا وواضحًا للحدث الدراسي'});
});
export const announcementTypeSchema=announcementDefinitionSchema.safeExtend({id:z.string().regex(/^\d{5,30}$/)});
export type AnnouncementType=z.infer<typeof announcementTypeSchema>;
export type AnnouncementContext={teacher:string;group:string;portal:string;contact:string};
const automatic=new Set(['teacher','group','portal','contact']);

function localDate(value:string,withTime:boolean):string{
 const pattern=withTime?/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/:/^(\d{4})-(\d{2})-(\d{2})$/;
 const parts=value.match(pattern);if(!parts)throw new Error('راجع التاريخ والوقت');
 const [year,month,day,hour=0,minute=0]=parts.slice(1).map(Number);
 const date=new Date(Date.UTC(year,month-1,day,hour,minute));
 if(year<2000 || year>2100 || date.getUTCFullYear()!==year || date.getUTCMonth()!==month-1 || date.getUTCDate()!==day || date.getUTCHours()!==hour || date.getUTCMinutes()!==minute)throw new Error('التاريخ أو الوقت غير صالح');
 // Input is a Cairo wall-clock time. UTC here formats those same clock digits,
 // rather than silently converting them using the server's local timezone.
 return new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',...(withTime?{timeStyle:'short' as const}:{}),timeZone:'UTC'}).format(date)+(withTime?' بتوقيت القاهرة':'');
}
export function renderAnnouncement(template:AnnouncementType,input:Record<string,string>,context:AnnouncementContext){
 const parsed=announcementTypeSchema.parse(template),editable=parsed.fields.filter(field=>!automatic.has(field.type));
 if(Object.keys(input).some(key=>!editable.some(field=>field.key===key)))throw new Error('بعض الحقول غير متاحة لهذا النوع');
 if(parsed.key==='class_rescheduled' && input.old_time===input.new_time || parsed.key==='homework_deadline' && input.old_due===input.new_due)throw new Error('الموعد الجديد مطابق للموعد السابق');
 if(parsed.key==='study_break' && input.break_start>input.break_end)throw new Error('موعد استئناف الدراسة يسبق بداية التوقف');
 const parameters=parsed.fields.map(field=>{
  const raw=automatic.has(field.type)?context[field.type as keyof AnnouncementContext]:input[field.key];
  const value=String(raw || '').trim();if(!value || /[\r\n\t\u0000-\u001f]/u.test(value))throw new Error('أكمل '+field.label+' في سطر واحد');
  if(field.type==='portal'){
   let url;try{url=new URL(value);}catch{throw new Error('رابط بوابة الدراسة غير صالح');}
   if(url.protocol!=='https:' || url.username || url.password || value.length>300)throw new Error('رابط بوابة الدراسة غير صالح');
  }else if(field.type==='contact'){if(!/^\+?\d{10,15}$/.test(value))throw new Error('أضف رقم التواصل الصحيح في الإعدادات');}
  else if(field.type==='teacher' || field.type==='group'){if(value.length>(field.type==='group'?500:100))throw new Error('راجع اسم المدرس والمجموعة');}
  else if(field.type==='date' || field.type==='datetime')return localDate(value,field.type==='datetime');
  else if(value.length>160 || field.type==='choice' && !field.options?.includes(value))throw new Error('راجع '+field.label);
  return value;
 });
 const text=parsed.body.replace(/\{\{(\d+)\}\}/g,(_,index)=>parameters[Number(index)-1]);
 if(text.length>4096)throw new Error('الرسالة أطول من الحد المسموح');
 return {text,parameters,expected:{id:parsed.id,body:parsed.body,parameterCount:parameters.length}};
}

// Seeded from the actual Utility templates submitted in WhatsApp Manager.
// Review status is always fetched live; this catalog does not enable sending.
export const announcementTemplateSeeds:AnnouncementType[]=[
  {
    "key": "class_rescheduled",
    "name": "centerly_class_rescheduled_v1",
    "id": "1663107042276982",
    "body": "تم تعديل موعد حصة {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} الموعد السابق: {{4}} الموعد الجديد: {{5}} التغيير يخص هذه الحصة فقط، وباقي الجدول كما هو. رقم المدرس للاستفسار: {{6}} يرجى اعتماد الموعد الجديد لهذه الحصة.",
    "title": "تغيير موعد حصة",
    "fields": [
      {
        "key": "topic",
        "label": "اسم الحصة",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "old_time",
        "label": "الموعد السابق",
        "type": "datetime"
      },
      {
        "key": "new_time",
        "label": "الموعد الجديد",
        "type": "datetime"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "class_cancelled",
    "name": "centerly_class_cancelled_v1",
    "id": "2133950004161317",
    "body": "تم إلغاء حصة {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} موعد الحصة الملغاة: {{4}} هذه الحصة لن تعقد في الموعد المذكور. سيظهر أي موعد تعويضي بعد تحديده في جدول مجموعتك. رقم المدرس للاستفسار: {{5}} يرجى مراجعة جدول الدراسة لمعرفة مواعيدك الحالية.",
    "title": "إلغاء حصة",
    "fields": [
      {
        "key": "topic",
        "label": "اسم الحصة",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "cancelled_time",
        "label": "موعد الحصة الملغاة",
        "type": "datetime"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "class_location",
    "name": "centerly_class_location_v1",
    "id": "29425294190428157",
    "body": "تم تعديل مكان حصة {{1}} المسجلة مع {{2}} لمجموعة {{3}}. تاريخ وموعد الحصة: {{4}} المكان السابق: {{5}} المكان الجديد أو رابط الحضور: {{6}} رقم المدرس للاستفسار: {{7}} يرجى استخدام المكان الجديد لهذه الحصة فقط.",
    "title": "تغيير مكان الحصة",
    "fields": [
      {
        "key": "topic",
        "label": "اسم الحصة",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "event_time",
        "label": "موعد الحصة أو الاختبار",
        "type": "datetime"
      },
      {
        "key": "old_location",
        "label": "المكان السابق",
        "type": "text"
      },
      {
        "key": "location",
        "label": "المكان أو رابط الحضور",
        "type": "text"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "study_content",
    "name": "centerly_study_content_v1",
    "id": "1879333159920353",
    "body": "أصبح محتوى {{1}} متاحًا ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} اسم المحتوى: {{4}} رابط فتحه في حسابك: {{5}} رقم المدرس للاستفسار: {{6}} هذا المحتوى مخصص للمجموعة المسجلة، ويخضع لصلاحيات حسابك.",
    "title": "محتوى دراسي جديد",
    "fields": [
      {
        "key": "content_type",
        "label": "نوع المحتوى",
        "type": "choice",
        "options": [
          "فيديو شرح",
          "مذكرة",
          "ملف تدريبي"
        ]
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "content_title",
        "label": "اسم المحتوى",
        "type": "text"
      },
      {
        "key": "portal",
        "label": "رابط الدراسة",
        "type": "portal"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "homework_assigned",
    "name": "centerly_homework_assigned_v1",
    "id": "2298159074058540",
    "body": "تم إسناد واجب {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} آخر موعد للتسليم: {{4}} رابط الواجب في حسابك: {{5}} رقم المدرس للاستفسار: {{6}} يرجى مراجعة تعليمات الواجب وسياسة التسليم الموضحة في حسابك.",
    "title": "واجب جديد",
    "fields": [
      {
        "key": "homework_title",
        "label": "عنوان الواجب",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "due",
        "label": "موعد التسليم",
        "type": "date"
      },
      {
        "key": "portal",
        "label": "رابط الدراسة",
        "type": "portal"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "homework_deadline",
    "name": "centerly_homework_deadline_v1",
    "id": "1128524159554873",
    "body": "تم تعديل آخر موعد لتسليم واجب {{1}} المسند لمجموعتك لدى {{2}}. المجموعة: {{3}} الموعد السابق: {{4}} الموعد الجديد: {{5}} رابط مراجعة الواجب: {{6}} رقم المدرس للاستفسار: {{7}} يسري الموعد الجديد على هذا الواجب فقط.",
    "title": "تغيير موعد تسليم واجب",
    "fields": [
      {
        "key": "homework_title",
        "label": "عنوان الواجب",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "old_due",
        "label": "موعد التسليم السابق",
        "type": "date"
      },
      {
        "key": "new_due",
        "label": "موعد التسليم الجديد",
        "type": "date"
      },
      {
        "key": "portal",
        "label": "رابط الدراسة",
        "type": "portal"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "exam_schedule",
    "name": "centerly_exam_schedule_v1",
    "id": "1647625423688941",
    "body": "تم تحديد موعد اختبار {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} التاريخ والوقت المعتمدان: {{4}} المكان أو رابط الاختبار: {{5}} رقم المدرس للاستفسار: {{6}} هذا إشعار بموعد الاختبار الحالي؛ يرجى مراجعة تعليماته في حسابك.",
    "title": "موعد اختبار",
    "fields": [
      {
        "key": "exam_title",
        "label": "عنوان الاختبار",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "event_time",
        "label": "موعد الحصة أو الاختبار",
        "type": "datetime"
      },
      {
        "key": "location",
        "label": "المكان أو رابط الحضور",
        "type": "text"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "exam_results",
    "name": "centerly_exam_results_v1",
    "id": "1294236969504465",
    "body": "تم رصد نتيجة اختبار {{1}} ضمن الدراسة المسجلة لدى {{2}}. المجموعة: {{3}} تاريخ الاختبار: {{4}} رابط مراجعة الدرجة وملاحظات التصحيح: {{5}} رقم المدرس للاستفسار: {{6}} هذا إشعار بتحديث سجل الدرجات الدراسي لهذا الاختبار.",
    "title": "رصد نتائج اختبار",
    "fields": [
      {
        "key": "exam_title",
        "label": "عنوان الاختبار",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "exam_date",
        "label": "تاريخ الاختبار",
        "type": "date"
      },
      {
        "key": "portal",
        "label": "رابط الدراسة",
        "type": "portal"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "class_reminder",
    "name": "centerly_class_reminder_v1",
    "id": "2363014131126382",
    "body": "تذكير بموعد حصة {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} التاريخ والوقت: {{4}} المكان أو رابط الحضور: {{5}} رقم المدرس للاستفسار: {{6}} يمكنك مراجعة جدول مجموعتك من بوابة الدراسة الخاصة بك.",
    "title": "تذكير بموعد حصة",
    "fields": [
      {
        "key": "topic",
        "label": "اسم الحصة",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "event_time",
        "label": "موعد الحصة أو الاختبار",
        "type": "datetime"
      },
      {
        "key": "location",
        "label": "المكان أو رابط الحضور",
        "type": "text"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "class_added",
    "name": "centerly_class_added_v1",
    "id": "1798796771372099",
    "body": "أُضيفت حصة {{1}} إلى جدول دراستك المسجلة مع {{2}}. المجموعة: {{3}} نوع الحصة: {{4}} الموعد: {{5}} المكان أو رابط الحضور: {{6}} رقم المدرس للاستفسار: {{7}} هذه الحصة تخص المجموعة المسجلة بالفعل، ويمكن مراجعتها في جدول الدراسة.",
    "title": "حصة إضافية أو تعويضية",
    "fields": [
      {
        "key": "topic",
        "label": "اسم الحصة",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "class_kind",
        "label": "نوع الحصة",
        "type": "choice",
        "options": [
          "إضافية",
          "تعويضية"
        ]
      },
      {
        "key": "event_time",
        "label": "موعد الحصة أو الاختبار",
        "type": "datetime"
      },
      {
        "key": "location",
        "label": "المكان أو رابط الحضور",
        "type": "text"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "homework_reminder",
    "name": "centerly_homework_reminder_v1",
    "id": "1879336746562144",
    "body": "تذكير بآخر موعد لتسليم واجب {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} موعد التسليم: {{4}} رابط الواجب وتعليماته: {{5}} رقم المدرس للاستفسار: {{6}} هذا تذكير بالواجب المسند لمجموعتك، ولا يغيّر حالة أي تسليم سابق.",
    "title": "تذكير بموعد واجب",
    "fields": [
      {
        "key": "homework_title",
        "label": "عنوان الواجب",
        "type": "text"
      },
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "due",
        "label": "موعد التسليم",
        "type": "date"
      },
      {
        "key": "portal",
        "label": "رابط الدراسة",
        "type": "portal"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  },
  {
    "key": "study_break",
    "name": "centerly_study_break_v1",
    "id": "1051468604575035",
    "body": "تم تسجيل فترة توقف للحصص ضمن دراستك مع {{1}}. المجموعة: {{2}} بداية توقف الحصص: {{3}} موعد استئناف الدراسة: {{4}} رقم المدرس للاستفسار: {{5}} التحديث يخص جدول المجموعة المسجلة فقط؛ يرجى مراجعة مواعيدها عند استئناف الدراسة.",
    "title": "توقف الحصص واستئنافها",
    "fields": [
      {
        "key": "teacher",
        "label": "اسم المدرس",
        "type": "teacher"
      },
      {
        "key": "group",
        "label": "المجموعة",
        "type": "group"
      },
      {
        "key": "break_start",
        "label": "بداية توقف الحصص",
        "type": "date"
      },
      {
        "key": "break_end",
        "label": "استئناف الدراسة",
        "type": "date"
      },
      {
        "key": "contact",
        "label": "رقم المدرس",
        "type": "contact"
      }
    ]
  }
];
