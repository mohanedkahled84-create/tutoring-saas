// Provider challenge URLs contain credentials; OTP submissions must never enter telemetry.
export function redactPhoneAuthTelemetry<T>(value:T):T {
 const visit=(item:any):any=>{
  if(typeof item==='string'){
   if(item.length<200000 && /^\s*[\[{]/.test(item)){
    try{return JSON.stringify(visit(JSON.parse(item)));}catch{/* Non-JSON text still gets URL/secret filtering below. */}
   }
   let text=item.replace(/([?&](?:APIKey|access_token)=)[^&#\s"']*/gi,'$1[Filtered]');
   const secret=process.env.AKEDLY_API_KEY;if(secret && secret.length>8)text=text.split(secret).join('[Filtered]');
   return text;
  }
  if(Array.isArray(item))return item.map(visit);
  if(item && typeof item==='object')return Object.fromEntries(Object.entries(item).map(([key,entry])=>[key,/^(?:APIKey|api_key|AKEDLY_API_KEY|otp|code|password|turnstileToken|challengeToken|ticket|invitation|proof)$/i.test(key)?'[Filtered]':visit(entry)]));
  return item;
 };
 return visit(value);
}
