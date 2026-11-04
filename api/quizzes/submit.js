// Compatibility proxy only. Authorization and marking have one owner: the
// backend's verified, atomic submission path. Never mark answers locally.
export default async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Cache-Control','private,no-store');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({error:{message:'Method Not Allowed'}});
 let body=req.body;
 if(typeof body==='string'){try{body=JSON.parse(body);}catch{return res.status(400).json({error:{message:'Invalid request body'}});}}
 if(!body || typeof body!=='object' || Array.isArray(body) || JSON.stringify(body).length>250000)return res.status(400).json({error:{message:'Invalid request body'}});
 try{
  const response=await fetch('https://tutoring-backend-production-c8dd.up.railway.app/api/public/quizzes/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
  const result=await response.json();return res.status(response.status).json(result);
 }catch{return res.status(503).json({error:{message:'تعذر تأكيد التسليم؛ احتفظ بإجاباتك وحاول مجددًا'}});}
}
