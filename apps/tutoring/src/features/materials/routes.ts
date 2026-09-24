import { Router, Response } from "express";
import { AuthenticatedRequest } from "../../shared/types/index.js";
import { getServiceSupabaseClient, supabasePublic } from "../../supabase.js";
import { config } from "../../shared/config/index.js";
import { validateFileUpload } from "../../shared/utils/fileUploadValidator.js";

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

  try {
    const supabase = (config.supabaseServiceRoleKey ? getServiceSupabaseClient() : req.supabase) || getServiceSupabaseClient();
    let query = supabase
      .from("study_materials")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (groupId) {
      query = query.or(`group_id.eq.${groupId},group_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const materials = (data || []).map((m: any) => ({
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
        maxSizeBytes: 10 * 1024 * 1024,
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
        group_id: group_id || null,
        is_homework: Boolean(is_homework),
        due_date: due_date || null,
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

    // Purge any storage files associated with this homework material
    try {
      const bucketName = "homework-submissions";
      const folderPrefix = `${tenantId}/${id}`;
      const { data: folderFiles } = await supabasePublic.storage
        .from(bucketName)
        .list(folderPrefix);

      if (Array.isArray(folderFiles) && folderFiles.length > 0) {
        const paths = folderFiles.map((f: any) => `${folderPrefix}/${f.name}`);
        await supabasePublic.storage.from(bucketName).remove(paths).catch(() => {});
      }
    } catch (_) {}

    const { error } = await supabase
      .from("study_materials")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) throw error;

    res.json({ success: true, message: "تم حذف المادة بنجاح" });
  } catch (err: unknown) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: (err as Error).message } });
  }
});
