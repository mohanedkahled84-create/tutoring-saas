import {localize as t} from './language.js?v=9.99.10';
import {escapeHtml as e} from './escapeHtml.js?v=9.99.10';

export const CUTOUT_SUPPORT_WHATSAPP_URL = 'https://wa.me/201123671177?text=' + encodeURIComponent('مرحبًا، أواجه مشكلة في تجهيز الصورة الشفافة (PNG) لصفحة منصتي على سنترلي وأحتاج مساعدة.');

export function renderCutoutHelpBox() {
  return `<div data-cutout-help style="margin-top:.5rem;padding:.75rem .9rem;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:.79rem;line-height:1.7;color:#334155;display:grid;gap:.4rem">
    <div><strong>${t('ملاحظة مهمة للصورة:','Photo requirement:')}</strong> ${t('لازم تكون بصيغة <b>PNG بخلفية شفافة (مفرغة)</b> — تقدر تفرّغ صورتك مجاناً في ثواني من <a href="https://www.remove.bg/" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:800;text-decoration:underline">remove.bg</a> وتحفظها PNG وترفعها هنا.','Must be a <b>transparent PNG (cutout)</b>. You can remove the background for free in seconds at <a href="https://www.remove.bg/" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:800;text-decoration:underline">remove.bg</a>, download as PNG, and upload it here.')}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;padding-top:.25rem;border-top:1px dashed #e2e8f0">
      <span>${t('لو بتواجه مشكلة في عمل الصورة الشفافة، تواصل معنا وهنحللك المشكلة فوراً:','Having trouble preparing your transparent image? Contact us and we will fix it for you:')}</span>
      <a href="${CUTOUT_SUPPORT_WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;background:#16a34a;color:#fff;font-weight:800;font-size:.76rem;text-decoration:none;white-space:nowrap">${t('تواصل معنا على واتساب','Contact us on WhatsApp')}</a>
    </div>
  </div>`;
}

export function renderCutoutErrorHtml(message) {
  return `<div style="margin-top:.5rem;padding:.75rem .9rem;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:.82rem;line-height:1.7;display:grid;gap:.45rem">
    <div><strong>${t('لم يتم قبول الصورة:','Image not accepted:')}</strong> ${e(message)}</div>
    <div style="color:#7f1d1d">${t('طريقة التجهيز السريعة: ارفع صورتك على <a href="https://www.remove.bg/" target="_blank" rel="noopener noreferrer" style="color:#b91c1c;font-weight:800;text-decoration:underline">remove.bg</a> لحذف الخلفية وحمّلها بصيغة <b>PNG</b>. ولو لسه بتواجه مشكلة في عمل الصورة، ابعتها لنا على الواتساب وهنجهزهالك:','Quick fix: remove the background at <a href="https://www.remove.bg/" target="_blank" rel="noopener noreferrer" style="color:#b91c1c;font-weight:800;text-decoration:underline">remove.bg</a> and download as <b>PNG</b>. Still having trouble? Send it to us on WhatsApp and we will prepare it for you:')}</div>
    <div><a href="${CUTOUT_SUPPORT_WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:#16a34a;color:#fff;font-weight:800;font-size:.78rem;text-decoration:none">${t('حل المشكلة عبر واتساب سنترلي','Get help on Centerly WhatsApp')}</a></div>
  </div>`;
}

export function validateCutoutFile(file) {
  if (!file) return;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const isPng = type === 'image/png' || (!type && name.endsWith('.png'));
  if (!isPng) {
    throw new Error(t(
      'الصورة مرفوضة لأنها ليست بصيغة PNG شفافة (صيغ مثل JPG لا تدعم الخلفية الشفافة). احذف الخلفية واحفظها بصيغة PNG ثم ارفعها.',
      'Image rejected: only transparent PNG files are allowed (formats like JPG do not support transparency). Remove the background, save as PNG, and upload again.'
    ));
  }
  if (Number(file.size) > 5 * 1024 * 1024) {
    throw new Error(t('حجم الصورة يجب ألا يتعدى ٥ ميجابايت.', 'PNG image size must be 5 MB or smaller.'));
  }
}

export function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(t('تعذر قراءة ملف الصورة من جهازك.', 'Could not read the image file from your device.')));
    reader.readAsDataURL(file);
  });
}

// Validate decoded alpha, rather than trusting the extension or MIME label.
export function transparentPixels(data){let clear=0,visible=0;for(let i=3;i<data.length;i+=4){if(data[i]<=16)clear++;if(data[i]>0)visible++;}return visible>0 && clear>=Math.max(1,(data.length/4)*.05);}
export async function prepareTeacherCutout(source){
 const isInline=/^(?:data|blob):/i.test(String(source || ''));
 const img=new Image();
 if(!isInline)img.crossOrigin='anonymous';
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error(isInline?t('تعذر فحص ملف الصورة. تأكد أنه ملف PNG سليم وغير تالف، أو أرسله لنا على واتساب لنجهزه لك.','Could not read this image file. Make sure it is a valid PNG, or send it to us on WhatsApp and we will prepare it for you.'):t('تعذر فحص رابط الصورة مباشرة. نزّل الصورة على جهازك بصيغة PNG وارفعها من زر الاختيار.','Could not inspect this image URL. Download it as PNG to your device and upload the file instead.')));img.src=source;});
 if(!img.naturalWidth || img.naturalWidth>4096 || img.naturalHeight>4096)throw new Error(t('اختر صورة بأبعاد تصل إلى 4096 × 4096 بكسل.','Choose an image up to 4096 × 4096 pixels.'));
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
 let pixels;try{pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;}catch{throw new Error(t('رابط الصورة لا يسمح بالفحص. ارفع ملف PNG من جهازك.','This URL does not allow image inspection. Upload a PNG file from your device instead.'));}
 if(!transparentPixels(pixels))throw new Error(t('تم رفض الصورة لأنها تحتوي على خلفية غير شفافة. امسح الخلفية أولاً (مثلاً عبر remove.bg) ثم ارفع ملف PNG الشفاف.','Image rejected: this PNG still has a solid background. Remove the background first (e.g. via remove.bg) and upload the transparent PNG.'));
 const output=canvas.toDataURL('image/png');if(output.length>6500000)throw new Error(t('الصورة بعد التحويل كبيرة. صغّرها ثم حاول مجددًا.','The converted image is too large. Resize it and try again.'));return output;
}
