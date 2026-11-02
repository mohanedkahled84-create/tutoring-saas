import {z} from 'zod';

const basics=z.object({
 subject:z.string().trim().min(1,'اكتب المادة التي تدرّسها').max(100),
 education_stages:z.array(z.enum(['primary','preparatory','secondary','other'])).min(1,'اختر مرحلة دراسية واحدة على الأقل').max(4),
 other_stage:z.string().trim().max(100).default(''),
}).superRefine((value,ctx)=>{
 if(value.education_stages.includes('other') && !value.other_stage)ctx.addIssue({code:'custom',path:['other_stage'],message:'وضّح المرحلة الدراسية الأخرى'});
});
export function registrationBasics(input:any){
 // Old cached clients keep their existing registration route. The current
 // form explicitly opts into the required, atomic teaching-profile contract.
 if(input.registration_version!==2 && input.education_stages===undefined)return {};
 const result=basics.safeParse(input);
 if(!result.success)throw Object.assign(new Error(result.error.issues[0].message),{code:'INVALID_REGISTRATION_BASICS'});
 return {...result.data,education_stages:[...new Set(result.data.education_stages)],other_stage:result.data.education_stages.includes('other')?result.data.other_stage:''};
}
