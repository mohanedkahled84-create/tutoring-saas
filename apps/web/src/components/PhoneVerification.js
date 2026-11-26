import {preparePhoneProof} from '../utils/phoneProof.js?v=9.99.8';
import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.99.8';
// Keep challenge material within this mounted, disposable verification flow.
export function mountPhoneVerification(host,{info,requestCode,requestChallenge,verifyCode,onVerified,onStageChange=()=>{},initialChallenge=null,onChallengeChange=()=>{}}){
 let disposed=false,busy=false,challenge=null,retryAt=0,expiresAt=0,stage='phone';
 if(initialChallenge && /^[\w-]{36}$/.test(initialChallenge.challenge_id || '') && Number.isFinite(initialChallenge.expires_at) && initialChallenge.expires_at>Date.now() && initialChallenge.expires_at<=Date.now()+600000){challenge=initialChallenge.challenge_id;expiresAt=initialChallenge.expires_at;retryAt=Number(initialChallenge.retry_at)||0;}
 const sms=info.otp_channel==='sms';
 host.innerHTML=`<style>.phone-verify-panel[hidden]{display:none!important}.phone-verify-panel{min-width:0}.phone-verify-panel button{min-height:48px;font:inherit;border-radius:10px}.phone-verify-panel input{width:100%;box-sizing:border-box;min-height:50px;padding:12px;border:1px solid #cbd5e1;border-radius:10px;font:inherit}.phone-verify-panel .phone-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}.phone-verify-panel .phone-actions button{flex:1}.phone-verify-panel .phone-back{background:white;color:#334155;border:1px solid #cbd5e1;padding:10px 16px}</style><section class="phone-verify-panel" data-phone-stage><div class="field form-group"><label for="verification-phone">${info.is_phone_change?'الرقم الجديد':'رقم الموبايل'}${info.recovery?' · استعادة الحساب':''}</label><input class="form-input" id="verification-phone" type="tel" dir="ltr" value="${e(info.phone)}" readonly required aria-describedby="verification-help"><p class="helper" id="verification-help">${info.is_phone_change?'لن يتغير رقم حسابك إلا بعد تأكيد الكود.':'سنرسل كودًا لتأكيد ملكية الرقم المسجل.'}</p></div><div data-phone-proof></div><button type="button" class="btn btn-primary primary" id="request-phone-code" style="width:100%">تأكيد</button></section><section class="phone-verify-panel" data-otp-stage hidden><p style="line-height:1.8;margin-top:0">اكتب كود التأكيد المرسل إلى <bdi>${e(info.phone)}</bdi></p><form id="phone-code-form" style="display:grid;gap:12px"><label for="phone-code">كود التأكيد</label><input class="form-input" id="phone-code" type="text" dir="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required style="font-size:24px;letter-spacing:.35em;text-align:center"><button class="btn btn-primary primary" type="submit">تأكيد</button></form><div class="phone-actions"><button type="button" class="phone-back" data-phone-back>رجوع</button><button type="button" class="phone-back" data-phone-resend>إعادة إرسال الكود</button></div><div data-otp-proof></div></section><p id="phone-code-status" role="status" aria-live="polite" style="line-height:1.8;overflow-wrap:anywhere"></p><p id="phone-code-error" role="alert" class="error" style="color:#a82532;line-height:1.8"></p>`;
 const phone=host.querySelector('[data-phone-stage]'),otp=host.querySelector('[data-otp-stage]'),send=host.querySelector('#request-phone-code'),resend=host.querySelector('[data-phone-resend]'),form=host.querySelector('form'),code=host.querySelector('#phone-code'),status=host.querySelector('#phone-code-status'),error=host.querySelector('#phone-code-error');
 const setStage=value=>{stage=value;phone.hidden=value!=='phone';otp.hidden=value!=='otp';onStageChange(value);if(value==='otp')code.focus();};
 const update=()=>{
  if(disposed)return;const wait=Math.max(0,Math.ceil((retryAt-Date.now())/1000));
  for(const button of [send,resend]){button.disabled=busy || info.otp_available===false || wait>0;button.setAttribute('aria-busy',String(busy));}
  send.innerHTML=busy?'جارٍ تجهيز التأكيد…<progress aria-label="جار تجهيز التأكيد" style="display:block;width:100%;height:4px;margin-top:6px"></progress>':wait?`المحاولة متاحة بعد ${wait} ثانية`:'تأكيد';
  resend.textContent=busy?'جارٍ تجهيز الكود…':wait?`إعادة الإرسال بعد ${wait} ثانية`:'إعادة إرسال الكود';
  form.querySelector('button').disabled=busy || !challenge || Date.now()>=expiresAt;host.querySelector('[data-phone-back]').disabled=busy;
  if(challenge && Date.now()>=expiresAt && !busy)status.textContent='انتهت صلاحية الكود. اطلب كودًا جديدًا.';
 };
 async function request(){
  if(busy || (stage==='phone'?send:resend).disabled)return;busy=true;error.textContent='';status.textContent='جار تجهيز التأكيد الآمن…';update();
  try{
   const proof=sms?await preparePhoneProof(requestChallenge,()=>!disposed && host.isConnected,{turnstileHost:host.querySelector(stage==='phone'?'[data-phone-proof]':'[data-otp-proof]'),onProgress:message=>{if(!disposed)status.textContent=message;}}):undefined;
   const result=await requestCode(proof?{proof}:{});if(disposed || !host.isConnected)return;
   if(!result.challenge_id || !Number.isFinite(result.expires_in) || result.expires_in<=0)throw new Error('لم يتأكد طلب الكود. حاول مجددًا.');
   challenge=result.challenge_id;retryAt=Date.now()+Math.max(0,Number(result.retry_after)||60)*1000;expiresAt=Date.now()+result.expires_in*1000;code.value='';onChallengeChange({challenge_id:challenge,expires_at:expiresAt,retry_at:retryAt});status.textContent=result.message || 'تم قبول طلب الإرسال. اكتب الكود عند وصوله.';setStage('otp');
  }catch(err){if(!disposed){error.textContent=err.message || 'تعذر إرسال الكود. حاول مجددًا.';status.textContent='لم يكتمل طلب إرسال الكود.';retryAt=Date.now()+(err.status===429?60000:10000);}}
  finally{busy=false;update();}
 }
 send.onclick=request;resend.onclick=request;
 host.querySelector('[data-phone-back]').onclick=()=>{challenge=null;onChallengeChange(null);setStage('phone');update();};
 form.onsubmit=async event=>{event.preventDefault();if(busy || !challenge || Date.now()>=expiresAt)return;busy=true;error.textContent='';update();try{const result=await verifyCode({challenge_id:challenge,code:code.value});if(disposed || !host.isConnected)return;code.value='';await onVerified(result);}catch(err){if(!disposed)error.textContent=err.message;}finally{busy=false;update();}};
 const timer=setInterval(()=>{if(!host.isConnected){dispose();return;}update();},1000);
 function dispose(){disposed=true;clearInterval(timer);code.value='';challenge=null;}
 if(info.otp_available===false)status.textContent='التأكيد غير متاح حاليًا. حاول لاحقًا.';setStage(challenge?'otp':'phone');update();return dispose;
}
