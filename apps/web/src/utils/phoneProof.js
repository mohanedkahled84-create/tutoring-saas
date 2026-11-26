export async function preparePhoneProof(requestChallenge,isCurrent=()=>true,{turnstileHost,onProgress=()=>{}}={}){
 onProgress('جار تجهيز فحص الأمان…');
 const challenge=await requestChallenge();if(!isCurrent())throw new Error('تم إغلاق تأكيد الرقم');
 const {AkedlyShield,renderTurnstile}=await import('./phoneShieldBundle.js?v=9.99.7');
 let nonce;
 if(challenge.challengeRequired){
  onProgress('جار إكمال فحص الأمان…');
  const solver=new AkedlyShield({useWorker:true});let timer;
  try{nonce=(await Promise.race([solver.solve(challenge.challenge,challenge.difficulty),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('استغرق فحص الإرسال وقتًا طويلًا؛ حاول مجددًا.')),45000);})])).nonce;}
  finally{clearTimeout(timer);solver.terminate();}
 }
 if(!isCurrent())throw new Error('تم إغلاق تأكيد الرقم');
 let turnstileToken;
 if(challenge.turnstile?.required){
  if(!turnstileHost?.isConnected)throw new Error('افتح تأكيد الرقم مجددًا لإكمال فحص الأمان.');
  const widget=document.createElement('div');widget.style.cssText='min-height:70px;margin:12px 0;display:flex;justify-content:center';turnstileHost.replaceChildren(widget);onProgress('أكمل فحص الأمان الظاهر قبل إرسال الكود.');let timer;
  try{turnstileToken=await Promise.race([renderTurnstile(challenge.turnstile.siteKey,widget,{size:'compact'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('لم يكتمل فحص الأمان. حاول مجددًا.')),90000);})]);}
  finally{clearTimeout(timer);if(globalThis.window?.turnstile)try{window.turnstile.remove(widget);}catch{}widget.remove();}
 }
 onProgress('جار طلب إرسال الكود…');
 if(!isCurrent())throw new Error('تم إغلاق تأكيد الرقم');
 return {context:challenge.context,...(nonce===undefined?{}:{nonce}),...(turnstileToken?{turnstileToken}:{})};
}
