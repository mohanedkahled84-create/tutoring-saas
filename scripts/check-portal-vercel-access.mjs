// Read-only operator check. Prints no credentials or provider error payloads.
const {PORTAL_VERCEL_TOKEN:token,PORTAL_VERCEL_PROJECT_ID:project,PORTAL_VERCEL_TEAM_ID:team}=process.env;
if(!token || !project || !team){console.log(JSON.stringify({configured:false}));process.exitCode=1;}
else {
 try {
  const url=`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}/domains/mr-omar.centerly-eg.com?teamId=${encodeURIComponent(team)}`;
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});
  const data=response.ok?await response.json():null;
  const valid=response.ok && data?.name==='mr-omar.centerly-eg.com' && data?.projectId===project && data?.verified===true;
  console.log(JSON.stringify({configured:true,status:response.status,expectedProjectAndDomain:valid}));
  if(!valid)process.exitCode=1;
 }catch {console.log(JSON.stringify({configured:true,reachable:false}));process.exitCode=1;}
}
