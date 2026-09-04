import {
  Student,
  CreateStudentDTO,
  UpdateStudentDTO,
  PublicRegisterDTO,
  BulkImportPayload,
  ImportResult,
  IStudentsRepository,
} from "./types.js";
import {
  parseCSV,
  mapRowToStudent,
  normalizePhoneNumber,
  isValidEgyptianPhone,
} from "./import.js";

export class StudentsService {
  constructor(private readonly repo: IStudentsRepository) {}

  async listStudents(tenantId?: string, query?: string): Promise<Student[]> {
    return this.repo.list(tenantId, query);
  }

  async getStudent(id: string): Promise<Student | null> {
    return this.repo.findById(id);
  }

  async createStudent(
    tenantId: string | undefined,
    data: CreateStudentDTO,
    userRole?: string
  ): Promise<Student> {
    if (!tenantId && userRole !== "admin") {
      throw new Error("NO_TENANT_CONTEXT");
    }

    return this.repo.create(tenantId, {
      name: data.name,
      parent_phone: data.parent_phone,
      student_phone: data.student_phone || null,
      code: data.code || null,
      student_code: data.code || null,
      notes: data.notes || null,
      fee_override: data.fee_override ?? null,
      exempt: data.exempt ?? false,
    });
  }

  async updateStudent(id: string, data: UpdateStudentDTO): Promise<Student | null> {
    return this.repo.update(id, data);
  }

  async deleteStudent(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async publicRegister(
    data: PublicRegisterDTO
  ): Promise<{ student: Student; verification_message_queued: boolean }> {
    const student = await this.repo.create(data.tenant_id, {
      name: data.name,
      parent_phone: data.parent_phone,
      student_phone: data.student_phone || null,
    });

    await this.repo.enrollStudentInGroup(data.tenant_id, student.id, data.group_id);

    return {
      student,
      verification_message_queued: true,
    };
  }

  async bulkImport(
    tenantId: string | undefined,
    groupId: string,
    payload: BulkImportPayload,
    userRole?: string
  ): Promise<ImportResult> {
    if (!tenantId && userRole !== "admin") {
      throw new Error("NO_TENANT_CONTEXT");
    }

    // 1. Verify group exists
    const group = await this.repo.findGroupById(groupId);
    if (!group) {
      throw new Error("GROUP_NOT_FOUND");
    }

    // 2. Parse input into raw row array
    let rawRows: Record<string, unknown>[] = [];
    if (Array.isArray(payload.rows) && payload.rows.length > 0) {
      rawRows = payload.rows;
    } else if (typeof payload.csv_content === "string" && payload.csv_content.trim().length > 0) {
      rawRows = parseCSV(payload.csv_content);
    } else {
      throw new Error("EMPTY_PAYLOAD");
    }

    if (rawRows.length === 0) {
      throw new Error("NO_DATA_ROWS");
    }

    // 3. Resolve starting serial sequence
    let nextSerial = await this.repo.getHighestSerialCode(tenantId);

    const importedStudents: Array<{
      id: string;
      name: string;
      code: string;
      parent_phone: string;
      fee_override?: number | null;
      exempt?: boolean | null;
    }> = [];
    const errors: Array<{ row: number; name?: string; error: string }> = [];

    // 4. Process each row with row-level error resilience
    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 1;
      const raw = rawRows[i];
      const mapped = mapRowToStudent(raw, payload.column_mapping);

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

      try {
        const student = await this.repo.create(tenantId, {
          name,
          parent_phone: parentPhone,
          student_phone: studentPhone,
          code,
          student_code: code,
          fee_override: feeOverride,
          exempt: isExempt,
          notes: mapped.notes || null,
        });

        await this.repo.enrollStudentInGroup(tenantId, student.id, groupId);

        importedStudents.push({
          id: student.id,
          name: student.name,
          code: student.student_code || student.code || code,
          parent_phone: student.parent_phone,
          fee_override: student.fee_override,
          exempt: student.exempt,
        });
      } catch (rowErr: unknown) {
        const message = rowErr instanceof Error ? rowErr.message : "Row insertion failed";
        errors.push({ row: rowNum, name, error: message });
      }
    }

    return {
      total_rows: rawRows.length,
      imported_count: importedStudents.length,
      skipped_count: errors.length,
      errors,
      imported_students: importedStudents,
    };
  }
}
