import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServiceSupabaseClient, supabasePublic } from "../../supabase.js";
import { config } from "../../shared/config/index.js";
import { validateFileUpload } from "../../shared/utils/fileUploadValidator.js";
import {materialGroupsSchema,materialMatchesGroups,normalizeMaterialGroups} from './targets.js';
import {z} from 'zod';

export const materialsRouter = Router();

export function normalizeMaterialUrl(rawUrl?: string | null): string {
  if (!rawUrl) return "";
  if (rawUrl.includes("/storage/v1/object/sign/homework-submissions/")) {
    return rawUrl
      .replace("/storage/v1/object/sign/homework-submissions/", "/storage/v1/object/public/homework-submissions/")
      .split("?")[0];
  }
  return rawUrl;
}

// GET /api/materials - List materials for tenant / group
materialsRouter.get("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const groupId = req.query.group_id as string | undefined;
  if(groupId && !z.string().uuid().safeParse(groupId).success){res.status(400).json({error:{code:'BAD_REQUEST',message:'المجموعة غير صالحة'}});return;}

  try {
    const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();
    let query = supabase
      .from("study_materials")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const materials = (data || []).filter((m:any)=>!groupId || materialMatchesGroups(m,[groupId])).map((m: any) => ({
      ...m,
      url: normalizeMaterialUrl(m.url),
    }));

    res.json({ materials, count: materials.length });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// POST /api/materials - Create a new study material / homework
materialsRouter.post("/", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const { title, description, type, url, group_id, is_homework, due_date, book_name, pages, questions, file_data, file_name } = req.body;
  const late=z.boolean().nullable().optional().safeParse(req.body.allow_late_submission);
  if(!late.success){res.status(400).json({error:{message:'اختيار التسليم المتأخر غير صالح'}});return;}
  const targetInput=materialGroupsSchema.safeParse({group_id,group_ids:req.body.group_ids});
  if(!targetInput.success){res.status(400).json({error:{code:'BAD_REQUEST',message:'اختر مجموعة أو أكثر من مجموعاتك',details:targetInput.error.issues}});return;}
  const targets=normalizeMaterialGroups(targetInput.data);

  if (!title) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "عنوان المذكرة أو الواجب مطلوب" } });
    return;
  }

  // If it's regular study material (not homework), url or file_data is strictly required
  if (!is_homework && !url && !file_data) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "رابط المذكرة أو ملف الـ PDF مطلوب" } });
    return;
  }

  try {
    const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();
    let finalUrl = url ? url.trim() : "";
    if(targets.group_ids){
      const {data:groups,error}=await supabase.from('groups').select('id').eq('tenant_id',tenantId).in('id',targets.group_ids);
      if(error || groups?.length!==targets.group_ids.length){res.status(403).json({error:{code:'FORBIDDEN',message:'اختر مجموعات مسموحًا لك بإسناد المحتوى إليها'}});return;}
    }

    // If file_data (base64) provided, validate magic bytes and upload securely (C-05)
    if (file_data) {
      let contentType = "application/pdf";
      const mimeMatch = file_data.match(/^data:([^;]+);base64,/);
      if (mimeMatch && mimeMatch[1]) {
        contentType = mimeMatch[1].toLowerCase();
      }

      const base64Clean = file_data.replace(/^data:[^;]+;base64,/, "");
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Clean) || base64Clean.length % 4 !== 0) {
        res.status(400).json({ error: { code: "INVALID_FILE", message: "صيغة الملف غير صالحة" } });
        return;
      }
      const fileBuffer = Buffer.from(base64Clean, "base64");

      const validation = validateFileUpload({
        buffer: fileBuffer,
        originalFilename: file_name || "material.pdf",
        declaredMimeType: contentType,
        maxSizeBytes: 25 * 1024 * 1024,
      });

      if (!validation.isValid || !validation.sanitizedFilename || !validation.detectedMimeType) {
        res.status(400).json({ error: { code: "INVALID_FILE", message: "الملف مرفوض: " + (validation.error || "نوع غير مدعوم") } });
        return;
      }

      const storagePath = `materials/${tenantId}/${Date.now()}_${validation.sanitizedFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("homework-submissions")
        .upload(storagePath, fileBuffer, {
          contentType: validation.detectedMimeType,
          upsert: true,
        });

      if (uploadError) {
        res.status(500).json({ error: { code: "STORAGE_ERROR", message: "تعذر رفع الملف إلى السحابة: " + uploadError.message } });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("homework-submissions")
        .getPublicUrl(storagePath);
      finalUrl = publicUrlData.publicUrl;
    }

    finalUrl = normalizeMaterialUrl(finalUrl);

    const { data, error } = await supabase
      .from("study_materials")
      .insert({
        tenant_id: tenantId,
        teacher_id: req.user?.id || null,
        title: title.trim(),
        description: description ? description.trim() : null,
        type: type || "pdf",
        url: finalUrl,
        ...targets,
        is_homework: Boolean(is_homework),
        due_date: due_date || null,
        allow_late_submission:late.data ?? null,
        book_name: book_name ? book_name.trim() : null,
        pages: pages ? pages.trim() : null,
        questions: questions ? questions.trim() : null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, material: data });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// Copy content into a fresh assignment. Never copy submissions or trust a client URL.
materialsRouter.post('/:id/copy',async(req:AuthenticatedRequest,res:Response):Promise<void>=>{
 const tenant=req.user?.tenant_id;
 const schema=z.object({request_id:z.string().uuid(),title:z.string().trim().min(1).max(250),due_date:z.iso.date().nullable().optional(),group_id:z.string().uuid().nullable().optional(),group_ids:z.array(z.string().uuid()).min(1).max(200).nullable().optional()}).strict();
 const parsed=schema.safeParse(req.body),id=z.string().uuid().safeParse(req.params.id);
 if(!tenant){res.status(403).json({error:{message:'حساب المدرس غير متاح'}});return;}
 if(!parsed.success || !id.success){res.status(400).json({error:{message:'راجع عنوان المحتوى والمجموعات وموعد التسليم'}});return;}
 const targets=materialGroupsSchema.safeParse(parsed.data);
 if(!targets.success){res.status(400).json({error:{message:'راجع المجموعات المختارة'}});return;}
 try{
  const db=getServiceSupabaseClient();
  const source=await db.from('study_materials').select('*').eq('id',id.data).eq('tenant_id',tenant).maybeSingle();
  if(source.error)throw source.error;
  if(!source.data){res.status(404).json({error:{message:'المحتوى غير متاح'}});return;}
  const row=source.data;
  if(!['pdf','link','video'].includes(row.type) || row.book_name==='approved_homework'){res.status(409).json({error:{message:'أنشئ نسخة من صفحة الاختبار أو الفيديو المرتبط بواجب لاختيار شروطه الجديدة'}});return;}
  const target=normalizeMaterialGroups(targets.data);
  const result=await db.from('study_materials').insert({id:parsed.data.request_id,source_material_id:row.id,tenant_id:tenant,teacher_id:req.user?.id,title:parsed.data.title,description:row.description,type:row.type,url:row.url,is_homework:row.is_homework,due_date:row.is_homework?parsed.data.due_date || null:null,book_name:row.book_name,pages:row.pages,questions:row.questions,...target}).select().single();
  if(result.error?.code==='23505'){
   const saved=await db.from('study_materials').select('*').eq('id',parsed.data.request_id).eq('tenant_id',tenant).maybeSingle();
   if(!saved.error && saved.data?.source_material_id===row.id){res.json({material:saved.data,success:true,unchanged:true});return;}
  }
  if(result.error)throw result.error;
  res.status(201).json({material:result.data,success:true});
 }catch(error:any){const denied=['42501','44000'].includes(error?.code) || /FORBIDDEN|violates check option/.test(error?.message || '');res.status(denied?403:error?.code==='23514'?409:503).json({error:{message:denied?'اختر مجموعات مسموحًا لك بإسناد المحتوى إليها':error?.code==='23514'?'اختر مجموعات نشطة من السنة الحالية':'تعذر إنشاء النسخة. راجع قائمة المحتوى قبل المحاولة مجددًا'}});}
});

// PATCH /api/materials/:id - Update study material metadata / exceptions
materialsRouter.patch("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  const { title, description, url, group_id, book_name, pages, questions } = req.body;
  const policy=z.object({allow_late_submission:z.boolean().nullable().optional(),due_date:z.iso.date().nullable().optional()}).safeParse(req.body);
  if(!policy.success){res.status(400).json({error:{message:'راجع موعد التسليم واختيار التسليم المتأخر'}});return;}
  const changesTargets=group_id!==undefined || req.body.group_ids!==undefined;
  const targetInput=materialGroupsSchema.safeParse({group_id,group_ids:req.body.group_ids});
  if(changesTargets && !targetInput.success){res.status(400).json({error:{code:'BAD_REQUEST',message:'المجموعات المختارة غير صالحة'}});return;}

  try {
    const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();
    const updatePayload: Record<string, any> = {};
    Object.assign(updatePayload,policy.data);

    if (title !== undefined) updatePayload.title = title.trim();
    if (description !== undefined) updatePayload.description = description ? description.trim() : null;
    if (url !== undefined) updatePayload.url = normalizeMaterialUrl(url.trim());
    if (changesTargets && targetInput.success) Object.assign(updatePayload,normalizeMaterialGroups(targetInput.data));
    if (book_name !== undefined) updatePayload.book_name = book_name ? book_name.trim() : null;
    if (pages !== undefined) updatePayload.pages = pages ? pages.trim() : null;
    if (questions !== undefined) updatePayload.questions = questions ? questions.trim() : null;

    const { data, error } = await supabase
      .from("study_materials")
      .update(updatePayload)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if(error?.message?.includes('GROUP_HAS_SUBMISSIONS')){res.status(409).json({error:{code:'HAS_SUBMISSIONS',message:'لا يمكن إزالة مجموعة لها تسليمات. احتفظ بالمجموعة للحفاظ على سجل الطلاب.'}});return;}
    if(error?.message?.includes('COPY_TO_NEW_YEAR')){res.status(409).json({error:{code:'COPY_TO_NEW_YEAR',message:'المحتوى مرتبط بسنة سابقة؛ استخدم نسخة جديدة للمجموعات الحالية للحفاظ على التسليمات القديمة'}});return;}
    if (error) throw error;

    res.json({ success: true, material: data });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});

// DELETE /api/materials/:id - Delete a study material
materialsRouter.delete("/:id", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;

  if (!tenantId && req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
    return;
  }

  try {
    const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || supabasePublic;

    const { data: deleted, error } = await supabase
      .from("study_materials")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("id");

    if (error) throw error;
    if (!deleted?.length) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "المادة غير موجودة" } });
      return;
    }
    // Purge only after deletion succeeds, using the authorized server client.
    for (const bucketName of ["homework-private", "homework-submissions"]) {
      const folderPrefix = `${tenantId}/${id}`;
      const { data: files } = await supabase.storage.from(bucketName).list(folderPrefix, { limit: 1000 });
      const paths = (files || []).filter(f => f.id).map(f => `${folderPrefix}/${f.name}`);
      if (paths.length) await supabase.storage.from(bucketName).remove(paths);
    }
    res.json({ success: true, message: "تم حذف المادة بنجاح" });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});
