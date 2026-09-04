import { Router, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import {
  parseCSV,
  mapRowToStudent,
  normalizePhoneNumber,
  isValidEgyptianPhone,
  RawStudentRow,
} from "../services/importService.js";

export const importRouter = Router();

// DEV-BSI.1: POST /api/groups/:id/students/import
importRouter.post(
  "/:id/students/import",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const supabase = req.supabase!;
    const tenantId = req.user!.tenant_id;
    const { id: groupId } = req.params;
    const { rows: directRows, csv_content, column_mapping } = req.body;

    if (!tenantId && req.user!.role !== "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "No active tenant context" } });
      return;
    }

    // 1. Verify group exists and belongs to tenant
    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("id, name")
      .eq("id", groupId)
      .single();

    if (groupErr || !group) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Target group not found" } });
      return;
    }

    // 2. Parse input into row array
    let rawRows: Record<string, any>[] = [];
    if (Array.isArray(directRows) && directRows.length > 0) {
      rawRows = directRows;
    } else if (typeof csv_content === "string" && csv_content.trim().length > 0) {
      rawRows = parseCSV(csv_content);
    } else {
      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Either 'rows' array or 'csv_content' text must be provided",
        },
      });
      return;
    }

    if (rawRows.length === 0) {
      res
        .status(400)
        .json({ error: { code: "BAD_REQUEST", message: "Import payload contains no data rows" } });
      return;
    }

    try {
      // 3. Find highest existing numeric student_code to continue sequence (starts at 1001)
      const { data: existingStudents } = await supabase
        .from("students")
        .select("student_code")
        .eq("tenant_id", tenantId);

      let nextSerial = 1001;
      if (existingStudents && existingStudents.length > 0) {
        for (const s of existingStudents) {
          if (s.student_code) {
            const num = parseInt(s.student_code, 10);
            if (!isNaN(num) && num >= nextSerial) {
              nextSerial = num + 1;
            }
          }
        }
      }

      const importedStudents: any[] = [];
      const errors: Array<{ row: number; name?: string; error: string }> = [];

      // 4. Process each row with row-level resilience
      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = i + 1;
        const raw = rawRows[i];
        const mapped = mapRowToStudent(raw, column_mapping);

        const name = mapped.name?.trim();
        const parentPhone = normalizePhoneNumber(mapped.parent_phone);
        const studentPhone = normalizePhoneNumber(mapped.student_phone) || null;
        let code = mapped.code?.toString().trim() || mapped.student_code?.toString().trim();

        // Row Validation
        if (!name) {
          errors.push({ row: rowNum, error: "اسم الطالب مطلوب (Missing student name)" });
          continue;
        }

        if (!parentPhone || !isValidEgyptianPhone(parentPhone)) {
          errors.push({
            row: rowNum,
            name,
            error:
              "رقم ولي الأمر غير صالح - يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ومكون من 11 رقماً",
          });
          continue;
        }

        if (studentPhone && !isValidEgyptianPhone(studentPhone)) {
          errors.push({
            row: rowNum,
            name,
            error:
              "رقم الطالب غير صالح - يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ومكون من 11 رقماً",
          });
          continue;
        }

        // Auto-assign serial if missing
        if (!code) {
          code = String(nextSerial);
          nextSerial += 1;
        }

        // Parse fee override & exempt
        let feeOverride: number | null = null;
        if (
          mapped.fee_override !== undefined &&
          mapped.fee_override !== null &&
          mapped.fee_override !== ""
        ) {
          const parsedFee = Number(mapped.fee_override);
          if (!isNaN(parsedFee) && parsedFee >= 0) feeOverride = parsedFee;
        }

        let isExempt = false;
        if (mapped.exempt !== undefined && mapped.exempt !== null) {
          const exemptVal = String(mapped.exempt).toLowerCase().trim();
          if (
            exemptVal === "true" ||
            exemptVal === "1" ||
            exemptVal === "نعم" ||
            exemptVal === "معفي"
          ) {
            isExempt = true;
          }
        }

        // Insert student
        const { data: student, error: studentInsertErr } = await supabase
          .from("students")
          .insert({
            tenant_id: tenantId,
            name,
            parent_phone: parentPhone,
            student_phone: studentPhone,
            student_code: code,
            fee_override: feeOverride,
            exempt: isExempt,
            notes: mapped.notes || null,
          })
          .select()
          .single();

        if (studentInsertErr) {
          errors.push({ row: rowNum, name, error: studentInsertErr.message });
          continue;
        }

        // Enroll student into group
        const { error: enrollErr } = await supabase.from("group_students").insert({
          tenant_id: tenantId,
          group_id: groupId,
          student_id: student.id,
        });

        if (enrollErr) {
          errors.push({
            row: rowNum,
            name,
            error: `Student created but failed to link to group: ${enrollErr.message}`,
          });
          continue;
        }

        importedStudents.push({
          id: student.id,
          name: student.name,
          code: student.student_code,
          parent_phone: student.parent_phone,
          fee_override: student.fee_override,
          exempt: student.exempt,
        });
      }

      res.status(200).json({
        total_rows: rawRows.length,
        imported_count: importedStudents.length,
        skipped_count: errors.length,
        errors,
        imported_students: importedStudents,
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL_ERROR", message: "Bulk import execution failed" } });
    }
  }
);
