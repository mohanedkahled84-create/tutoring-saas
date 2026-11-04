// This deployment permits UTILITY templates only. Recheck live metadata before every send;
// approval alone is insufficient because Meta can recategorize an existing template.
export type ExpectedTemplate={id:string;body:string;parameterCount:number};
export function matchesUtilityTemplate(template:any,options:{name:string;language:string;expected?:ExpectedTemplate}):boolean{
 if(template?.name!==options.name || template.language!==options.language || template.status!=='APPROVED' || template.category!=='UTILITY')return false;
 if(!options.expected)return true;
 const body=template.components?.find((component:any)=>component.type==='BODY')?.text;
 const normalize=(value:unknown)=>typeof value==='string'?value.replace(/\s+/gu,' ').trim():'';
 return String(template.id)===options.expected.id && normalize(body)===normalize(options.expected.body) && new Set((String(body || '').match(/\{\{\d+\}\}/g) || [])).size===options.expected.parameterCount;
}
export async function approvedUtilityTemplate(options:{baseUrl:string;accessToken?:string;wabaId?:string;name:string;language:string;expected?:ExpectedTemplate}):Promise<boolean> {
 if(!options.accessToken || !options.wabaId)return false;
 try {
  const fields=options.expected?'name,status,language,category,id,components':'name,status,language,category';
  const response=await fetch(`${options.baseUrl}/${options.wabaId}/message_templates?name=${encodeURIComponent(options.name)}&fields=${fields}`,{
   headers:{Authorization:`Bearer ${options.accessToken}`},signal:AbortSignal.timeout(3000),
  });
  const result:any=await response.json();
  return response.ok && Array.isArray(result?.data) && result.data.some((template:any)=>matchesUtilityTemplate(template,options));
 }catch{return false;}
}
