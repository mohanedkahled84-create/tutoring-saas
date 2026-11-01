export async function preparePhoneProof(requestChallenge,isCurrent=()=>true){
 const challenge=await requestChallenge();if(!isCurrent())throw new Error('تم إغلاق تأكيد الرقم');
 const {AkedlyShield,getTurnstileToken}=await import('./phoneShieldBundle.js');
 let nonce;
 if(challenge.challengeRequired){
  const solver=new AkedlyShield({useWorker:true});let timer;
  try{nonce=(await Promise.race([solver.solve(challenge.challenge,challenge.difficulty),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('استغرق فحص الإرسال وقتًا طويلًا؛ حاول مجددًا.')),45000);})])).nonce;}
  finally{clearTimeout(timer);solver.terminate();}
 }
 if(!isCurrent())throw new Error('تم إغلاق تأكيد الرقم');
 const turnstileToken=challenge.turnstile?.required?await getTurnstileToken(challenge.turnstile.siteKey,{size:'compact'}):undefined;
 if(!isCurrent())throw new Error('تم إغلاق تأكيد الرقم');
 return {context:challenge.context,...(nonce===undefined?{}:{nonce}),...(turnstileToken?{turnstileToken}:{})};
}
