// Legacy teacher URLs retain their paths, but all access and writes use the
// authenticated backend controllers. An outage is never a successful local edit.
export async function proxyTeacherQuiz(req,res,path,methods){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods',methods.join(', ')+', OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Cache-Control','private,no-store');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!methods.includes(req.method))return res.status(405).json({error:{message:'Method Not Allowed'}});
 const authorization=req.headers?.authorization;
 if(typeof authorization!=='string' || !/^Bearer \S+$/.test(authorization))return res.status(401).json({error:{message:'سجّل دخول حساب المدرس لإتمام العملية'}});
 let body=req.body;
 if(typeof body==='string'){try{body=JSON.parse(body);}catch{return res.status(400).json({error:{message:'Invalid request body'}});}}
 if(req.method!=='GET' && (!body || typeof body!=='object' || Array.isArray(body) || JSON.stringify(body).length>4000000))return res.status(400).json({error:{message:'Invalid request body'}});
 const query=new URL(req.url || '/', 'https://centerly-eg.com').search;
 try{
  const response=await fetch('https://tutoring-backend-production-c8dd.up.railway.app/api/quizzes/'+path+query,{method:req.method,headers:{Authorization:authorization,...(req.method==='GET'?{}:{'Content-Type':'application/json'})},...(req.method==='GET'?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(20000)});
  return res.status(response.status).json(await response.json());
 }catch{return res.status(503).json({error:{message:'تعذر إتمام العملية؛ حاول مجددًا. لم يتأكد الحفظ.'}});}
}
