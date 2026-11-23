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
  let after:string | undefined;
  for(let page=0;page<10;page++){
   const url=new URL(`${options.baseUrl}/${options.wabaId}/message_templates`);
   url.searchParams.set('name',options.name);url.searchParams.set('fields',fields);url.searchParams.set('limit','100');
   if(after)url.searchParams.set('after',after);
   const response=await fetch(url.toString(),{headers:{Authorization:`Bearer ${options.accessToken}`},signal:AbortSignal.timeout(3000)});
   const result:any=await response.json();
   if(!response.ok || !Array.isArray(result?.data))return false;
   if(result.data.some((template:any)=>matchesUtilityTemplate(template,options)))return true;
   const cursor=result?.paging?.cursors?.after;
   if(!result?.paging?.next || typeof cursor!=='string' || !cursor || cursor===after)return false;
   after=cursor;
  }
  return false;
 }catch{return false;}
}
