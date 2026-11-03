// No browser clock or local grade is authoritative. The server owns the
// deadline and saved answers; performance.now keeps the displayed clock steady.
export async function openQuizAttempt(transport,token,materialId,onStatus=()=>{}){
 const opened=await transport('start',{token,material_id:materialId});
 if(opened.submitted)return {submitted:opened.result,definition:opened.definition,answers:opened.answers || {},materialId:opened.material_id};
 if(!opened.attempt_id || !opened.definition?.questions?.length || !Number.isFinite(Date.parse(opened.expires_at)) || !Number.isFinite(Date.parse(opened.server_now)))throw new Error('تعذر بدء الامتحان؛ حدّث الصفحة وحاول مجددًا');
 const now=()=>globalThis.performance.now(),deadline=now()+Math.max(0,Date.parse(opened.expires_at)-Date.parse(opened.server_now));
 let revision=opened.revision,dirty=false,pending=null,flight=null,timer=null,disposed=false,frozen=false,failures=0;
 const answers={...opened.answers};
 const state={id:opened.attempt_id,materialId:opened.material_id,definition:{...opened.definition,questions:opened.definition.questions.map((q,i)=>({...q,id:String(q.id ?? i)}))},answers,
  remaining:()=>Math.max(0,Math.ceil((deadline-now())/1000)),
  setAnswer(key,value){if(disposed || frozen || state.remaining()<=0)return false;answers[key]=value;dirty=true;onStatus('saving');clearTimeout(timer);timer=setTimeout(()=>void state.flush().catch(()=>{}),700);return true;},
  flush(){
   if(disposed)return Promise.reject(new Error('انتهت جلسة الامتحان'));
   if(flight)return flight;
   clearTimeout(timer);
   flight=(async()=>{
    while((dirty || pending) && state.remaining()>0){
     if(!pending){pending={token,attempt_id:state.id,answers:JSON.parse(JSON.stringify(answers)),revision};dirty=false;}
     try{
      const saved=await transport('save',pending);
      if(saved.submitted){state.submitted=saved.result;pending=null;dirty=false;frozen=true;onStatus('submitted');return;}
      revision=saved.revision;pending=null;failures=0;onStatus(dirty?'saving':'saved');
     }catch(error){onStatus('error',error.message);if(!disposed && !frozen && (!error.status || error.status>=500)){clearTimeout(timer);timer=setTimeout(()=>void state.flush().catch(()=>{}),Math.min(30000,2000*2**failures++));}throw error;}
    }
   })().finally(()=>{flight=null;});return flight;
  },
  async submit(extra={}){
   frozen=true;clearTimeout(timer);
   await state.flush();
   if(state.submitted)return state.submitted;
   const saved=await transport('submit',{token,material_id:state.materialId,answers:{...answers},...extra});
   if(saved.success!==true)throw new Error('تعذر تأكيد التسليم؛ حاول مجددًا');
   state.submitted=saved;state.dispose();return saved;
  },
  dispose(){disposed=true;frozen=true;clearTimeout(timer);},
 };
 return state;
}
