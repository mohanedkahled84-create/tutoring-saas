import { AttendanceEvaluation } from "../../shared/types/index.js";

export interface ScanStudentInput {
  student_id?: string;
  student_code?: string;
  homework_status?: string | null;
  is_makeup?: boolean;
  home_group_id?: string | null;
  comment?: string | null;
}

export interface StudentProfile {
  id: string;
  name: string;
  student_code?: string | null;
  parent_phone?: string | null;
  student_phone?: string | null;
  fee_override?: number | null;
  exempt?: boolean | null;
}

export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  session_id: string;
  student_id: string;
  attended: boolean;
  comment?: string | null;
  homework_status?: string | null;
  is_makeup?: boolean;
  home_group_id?: string | null;
  sent?: boolean;
  idempotency_key: string;
  created_at: string;
}

export interface ScanStudentResult {
  already_recorded: boolean;
  message: string;
  recorded_at: string;
  attendance: unknown;
  student: {
    id: string;
    name: string;
    student_code?: string | null;
  };
}

export interface BatchAttendanceResult {
  message: string;
  count: number;
  attendance: unknown[];
  notification_decisions: AttendanceEvaluation[];
}

export interface OfflineSyncItem {
  student_id: string;
  attended: boolean;
  is_makeup?: boolean;
  client_timestamp: string;
  idempotency_key?: string;
  comment?: string;
  homework_status?: string | null;
  home_group_id?: string | null;
}

export interface SyncItemOutcome {
  idempotency_key: string;
  student_id: string;
  status: "synced" | "already_recorded" | "failed";
  recorded_at?: string;
  error?: string;
}

export interface OfflineBatchSyncResult {
  total: number;
  synced_count: number;
  already_recorded_count: number;
  failed_count: number;
  results: SyncItemOutcome[];
}

export interface DeliveryStatusItem {
  student_id: string;
  student_name: string;
  student_code: string | null;
  parent_phone: string | null;
  attended: boolean;
  delivery_status: string;
  failure_reason: string | null;
  logged_at: string | null;
}

export interface DeliveryStatusReport {
  session_id: string;
  total_students: number;
  sent_count: number;
  failed_count: number;
  deliveries: DeliveryStatusItem[];
}

export interface IAttendanceRepository {
  findStudent(
    tenantId: string,
    studentId?: string,
    studentCode?: string
  ): Promise<StudentProfile | null>;
  findAttendanceByKey(idempotencyKey: string): Promise<AttendanceRecord | null>;
  createAttendanceRecord(record: Partial<AttendanceRecord>): Promise<AttendanceRecord>;
  upsertAttendanceBatch(records: Partial<AttendanceRecord>[]): Promise<AttendanceRecord[]>;
  getStudentsByIds(
    tenantId: string,
    studentIds: string[]
  ): Promise<Array<{ id: string; name: string; parent_phone: string }>>;
  getAttendanceForSession(sessionId: string): Promise<AttendanceRecord[]>;
  getMessageLogsForTenant(
    tenantId: string
  ): Promise<Array<{ idempotency_key: string; status: string; error_detail?: string | null; created_at: string }>>;
}
