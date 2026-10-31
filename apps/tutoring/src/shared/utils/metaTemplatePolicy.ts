// This deployment permits UTILITY templates only. Recheck live metadata before every send;
// approval alone is insufficient because Meta can recategorize an existing template.
export async function approvedUtilityTemplate(options:{baseUrl:string;accessToken?:string;wabaId?:string;name:string;language:string}):Promise<boolean> {
 if(!options.accessToken || !options.wabaId)return false;
 try {
  const response=await fetch(`${options.baseUrl}/${options.wabaId}/message_templates?name=${encodeURIComponent(options.name)}&fields=name,status,language,category`,{
   headers:{Authorization:`Bearer ${options.accessToken}`},signal:AbortSignal.timeout(3000),
  });
  const result:any=await response.json();
  return response.ok && Array.isArray(result?.data) && result.data.some((template:any)=>
   template.name===options.name && template.language===options.language && template.status==='APPROVED' && template.category==='UTILITY');
 }catch{return false;}
}
