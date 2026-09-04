import type { RawStudentRow, ImportResult } from "./import.js";
import type { StudentBarcodeItem, BarcodeSheetOptions } from "./barcodePdf.js";

export type { RawStudentRow, ImportResult, StudentBarcodeItem, BarcodeSheetOptions };

export interface Student {
  id: string;
  tenant_id: string;
  name: string;
  parent_phone: string;
  student_phone?: string | null;
  code?: string | null;
  student_code?: string | null;
  fee_override?: number | null;
  exempt?: boolean;
  notes?: string | null;
  created_at?: string;
}

export interface CreateStudentDTO {
  name: string;
  parent_phone: string;
  student_phone?: string | null;
  code?: string | null;
  notes?: string | null;
  fee_override?: number | null;
  exempt?: boolean;
}

export interface UpdateStudentDTO {
  name?: string;
  parent_phone?: string;
  student_phone?: string | null;
  notes?: string | null;
  code?: string | null;
  fee_override?: number | null;
  exempt?: boolean;
}

export interface PublicRegisterDTO {
  tenant_id: string;
  name: string;
  parent_phone: string;
  student_phone?: string | null;
  group_id: string;
}

export interface BulkImportPayload {
  rows?: Record<string, unknown>[];
  csv_content?: string;
  column_mapping?: Record<string, string>;
}

export interface GroupRecord {
  id: string;
  name: string;
  tenant_id?: string;
}

export interface IStudentsRepository {
  list(tenantId?: string, query?: string): Promise<Student[]>;
  findById(id: string): Promise<Student | null>;
  create(tenantId: string | undefined, student: Partial<Student>): Promise<Student>;
  update(id: string, data: UpdateStudentDTO): Promise<Student | null>;
  delete(id: string): Promise<void>;
  getHighestSerialCode(tenantId?: string): Promise<number>;
  findGroupById(groupId: string): Promise<GroupRecord | null>;
  enrollStudentInGroup(tenantId: string | undefined, studentId: string, groupId: string): Promise<void>;
}
