import type {SupabaseClient} from '@supabase/supabase-js';
import type {Response} from 'express';
export async function checkCommercialStorage(db:SupabaseClient,tenantId:string,bytes:number,res:Response):Promise<boolean>{
 const {error}=await db.rpc('commercial_storage_check',{p_tenant:tenantId,p_bytes:bytes});
 if(!error)return true;
 const quota=error.message?.includes('STORAGE_LIMIT_REACHED');
 res.status(quota?409:503).json({error:{code:quota?'STORAGE_LIMIT_REACHED':'STORAGE_UNAVAILABLE',message:quota?'مساحة الملفات غير كافية؛ احذف ملفات غير مطلوبة أو أضف مساحة من صفحة الاشتراك':'تعذر التحقق من المساحة؛ حاول مجددًا'}});
 return false;
}
