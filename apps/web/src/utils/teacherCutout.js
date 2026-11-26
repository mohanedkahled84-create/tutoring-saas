import {localize as t} from './language.js?v=9.99.7';
// Validate decoded alpha, rather than trusting the extension or MIME label.
export function transparentPixels(data){let clear=0,visible=0;for(let i=3;i<data.length;i+=4){if(data[i]<=16)clear++;if(data[i]>0)visible++;}return visible>0 && clear>=Math.max(1,(data.length/4)*.05);}
export async function prepareTeacherCutout(source){
 const img=new Image();img.crossOrigin='anonymous';
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error(t('تعذر فحص الصورة. ارفع الملف من جهازك بدل الرابط.','Could not inspect the image. Upload the file instead of using a URL.')));img.src=source;});
 if(!img.naturalWidth || img.naturalWidth>4096 || img.naturalHeight>4096)throw new Error(t('اختر صورة بأبعاد تصل إلى 4096 × 4096.','Choose an image up to 4096 × 4096 pixels.'));
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
 let pixels;try{pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;}catch{throw new Error(t('رابط الصورة لا يسمح بالفحص. ارفع الملف من جهازك.','This URL does not allow image inspection. Upload the file instead.'));}
 if(!transparentPixels(pixels))throw new Error(t('الصورة لها خلفية. احذف الخلفية أولًا ثم ارفع PNG شفافًا؛ تغيير الصيغة وحده لا يحذف الخلفية.','This image has a background. Remove it first and upload a transparent PNG. Converting the format does not remove the background.'));
 const output=canvas.toDataURL('image/png');if(output.length>6500000)throw new Error(t('الصورة بعد التحويل كبيرة. صغّرها ثم حاول مجددًا.','The converted image is too large. Resize it and try again.'));return output;
}
