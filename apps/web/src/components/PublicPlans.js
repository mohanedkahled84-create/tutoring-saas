import {request} from '../services/api.js?v=9.46.0';
import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.46.0';
let cached=null,loadedAt=0;
const money=n=>(Number(n)/100).toLocaleString('ar-EG',{maximumFractionDigits:2})+' ج.م';
export function renderPublicPricing(){
 return `<section id="pricing" style="padding:4rem 1.25rem;background:var(--brand-cream)" dir="rtl"><div style="max-width:1100px;margin:auto"><h2 style="text-align:center;font-size:1.8rem">باقة تناسب شغلك ومساحة تكبر معاك</h2><p style="text-align:center;line-height:1.8">ابدأ بتجربة ٧ أيام. الأسعار شهرية، والرسائل من محفظة مستقلة تشحنها وقت ما تحتاج.</p><div id="publicCommercialPlans" style="min-height:220px">${cached?cards(cached):'<p role="status">جار قراءة الباقات الحالية…</p>'}</div></div></section>`;
}
function cards(plans){
 return `<style>.public-plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin-top:1.5rem}.public-plan{background:var(--brand-surface);border:1px solid var(--brand-line);border-radius:18px;padding:1.5rem;display:flex;flex-direction:column;gap:.7rem;min-width:0}.public-plan ul{line-height:2;padding-inline-start:1.2rem}.public-plan button{min-height:44px;margin-top:auto}@media(max-width:800px){.public-plan-grid{grid-template-columns:1fr}}</style><div class="public-plan-grid">${plans.map(p=>`<article class="public-plan" ${p.rank===3?'style="border:2px solid var(--brand-blue)"':''}><h3>${e(p.name)}</h3><strong style="font-size:2rem">${money(p.price_piasters)} <small style="font-size:.8rem">/ ٣٠ يومًا</small></strong><span>اشتراك شهري · كل أدوات الإدارة</span><ul><li>${Number(p.students).toLocaleString('ar-EG')} طالب نشط</li><li>${Number(p.storage_bytes/1e9).toLocaleString('ar-EG')} جيجا ملفات</li><li>${Number(p.assistants).toLocaleString('ar-EG')} مساعدين بصلاحيات</li><li>الحضور والتحصيل والماليات ومتابعة الأسرة</li><li>الإدارة على مجموعات متعددة وإعادة الاستخدام</li>${p.teaching_platform?'<li>منصة بهوية المدرس ورابط فرعي</li><li>مذكرات وروابط فيديو وتسليم واجبات</li><li>اختبارات أونلاين</li>':'<li>بوابة متابعة سنترلي للطالب وولي الأمر</li>'}${p.initial_gift_piasters?`<li>هدية أول اشتراك ${money(p.initial_gift_piasters)}</li>`:''}${p.renewal_gift_piasters?`<li>رصيد ${money(p.renewal_gift_piasters)} مع كل تجديد بعد الأول</li>`:''}</ul><p>المقعد الإضافي ${money(p.student_piasters)} شهريًا</p><button class="btn btn-primary" onclick="window.centrlyApp.renderAuth('signup')">ابدأ تجربة ٧ أيام</button></article>`).join('')}</div><p style="line-height:1.8;margin-top:1rem">مساعد إضافي ٥٠ جنيهًا/شهر، و٥ جيجا إضافية ٥٠ جنيهًا/شهر. الإضافات بنسبة باقي الدورة؛ حد أول دورة للمقعد الإضافي ٦٠ قرشًا. الهدية لا تترحل. الفيديوهات بروابط خارجية، وليست استضافة فيديو مباشرة.</p>`;
}
export async function hydratePublicPricing(){
 const host=document.getElementById('publicCommercialPlans');if(!host)return;
 if(cached && Date.now()-loadedAt<60000){host.innerHTML=cards(cached);return;}
 try{
  const data=await request('/public/plans');
  if(!Array.isArray(data.plans) || data.plans.length!==3 || data.plans.some(p=>!['basic_v1','pro_v1','max_v1'].includes(p.id) || !Number.isSafeInteger(p.price_piasters) || p.price_piasters<=0 || !Number.isSafeInteger(p.reference_piasters) || p.reference_piasters<p.price_piasters))throw Error('تعذر قراءة الأسعار');
  cached=data.plans;loadedAt=Date.now();if(document.getElementById('publicCommercialPlans')===host)host.innerHTML=cards(cached);
 }catch{if(document.getElementById('publicCommercialPlans')===host && !cached)host.innerHTML='<p role="status">تعذر تحديث الباقات الآن. أعد فتح الصفحة أو تواصل معنا قبل الدفع.</p>';}
}
