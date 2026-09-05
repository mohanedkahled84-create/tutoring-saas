export type TeacherRevenueModel = "percentage" | "fixed_per_student" | "fixed_total";
export type MemberStatus = "active" | "inactive" | "invited";
export type AssistantType = "assistant_to_center" | "assistant_to_teacher";
export type TeacherPayoutStatus = "unpaid" | "paid";

export interface TeacherModel {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  subjects: string[];
  revenue_model: TeacherRevenueModel;
  revenue_value: number;
  status: MemberStatus;
  invite_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantModel {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  teacher_id?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  assistant_type: AssistantType;
  can_view_financials: boolean;
  status: MemberStatus;
  invite_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomModel {
  id: string;
  tenant_id: string;
  name: string;
  capacity: number;
  location?: string | null;
  created_at: string;
}

export interface CreateRoomInput {
  name: string;
  capacity: number;
  location?: string;
}

export interface RoomBookingSlot {
  session_id: string;
  room_id: string;
  group_id: string;
  group_name?: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  status?: string;
}

export interface RoomConflictCheckInput {
  room_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  exclude_session_id?: string;
  student_count?: number;
}

export interface CapacityWarning {
  code: "CAPACITY_EXCEEDED";
  message: string;
  room_capacity: number;
  student_count: number;
}

export interface RoomConflictCheckResult {
  has_conflict: boolean;
  conflicting_booking?: RoomBookingSlot | null;
  warning?: CapacityWarning | null;
}

export interface RoomAvailabilityResult {
  room: RoomModel;
  date: string;
  bookings: RoomBookingSlot[];
}

export interface FrontDeskScanInput {
  barcode: string;
  current_time?: string;
}

export interface FrontDeskScanResult {
  success: boolean;
  mode: "front_desk";
  code?: string;
  message: string;
  audio_alert: "success" | "warning" | "error";
  student?: {
    id: string;
    name: string;
    barcode: string;
    phone?: string;
  };
  session?: {
    id: string;
    subject?: string;
    room_name?: string;
    teacher_name?: string;
    group_name?: string;
    session_number?: number;
    is_makeup?: boolean;
  };
}

export interface ActiveCenterSession {
  id: string;
  group_id: string;
  group_name: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  subject?: string | null;
  session_number: number;
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
}

export interface EnrollmentModel {
  id: string;
  tenant_id: string;
  student_id: string;
  teacher_id?: string | null;
  group_id: string;
  status: "active" | "dropped" | "suspended";
  joined_at: string;
}

// ============================================================================
// DEV-78: Per-Teacher Financial & Payout Types
// ============================================================================

export interface TeacherFinancialCalculationResult {
  total_revenue: number;
  teacher_cut: number;
  center_cut: number;
  revenue_model: TeacherRevenueModel;
  revenue_value: number;
}

export interface TeacherFinancialSummary {
  total_revenue: number;
  teacher_cut: number;
  center_cut: number;
  student_count: number;
  sessions_count: number;
}

export interface TeacherFinancialReport {
  teacher: TeacherModel;
  period: string; // e.g. '2026-09'
  summary: TeacherFinancialSummary;
  payout: {
    id?: string;
    status: TeacherPayoutStatus;
    paid_at?: string | null;
    paid_by?: string | null;
    notes?: string | null;
  };
}

export interface CenterFinancialRollup {
  period: string;
  totals: {
    total_revenue: number;
    total_teacher_cut: number;
    total_center_cut: number;
    paid_teachers_count: number;
    unpaid_teachers_count: number;
  };
  reports: TeacherFinancialReport[];
}

export interface SetPayoutStatusInput {
  teacher_id: string;
  period: string;
  status: TeacherPayoutStatus;
  notes?: string;
}

export interface TeacherPayoutModel {
  id: string;
  tenant_id: string;
  teacher_id: string;
  period: string;
  total_revenue: number;
  teacher_cut: number;
  center_cut: number;
  status: TeacherPayoutStatus;
  paid_at?: string | null;
  paid_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTeacherInput {
  name: string;
  phone: string;
  email?: string;
  password?: string;
  subjects?: string[];
  revenue_model?: TeacherRevenueModel;
  revenue_value?: number;
  onboarding_method?: "invite_link" | "direct_creation";
}

export interface CreateAssistantInput {
  name: string;
  phone: string;
  email?: string;
  password?: string;
  teacher_id?: string | null;
  assistant_type?: AssistantType;
  can_view_financials?: boolean;
  onboarding_method?: "invite_link" | "direct_creation";
}

export interface AcceptInviteInput {
  token: string;
  password: string;
  email?: string;
}

export interface OnboardingResult<T> {
  member: T;
  onboarding_method: "invite_link" | "direct_creation";
  invite_token?: string | null;
  invite_url?: string | null;
}

export interface ICentersRepository {
  // Teacher management
  createTeacher(
    tenantId: string,
    data: {
      name: string;
      phone: string;
      subjects: string[];
      revenue_model: TeacherRevenueModel;
      revenue_value: number;
      status: MemberStatus;
      user_id?: string | null;
      invite_token?: string | null;
    }
  ): Promise<TeacherModel>;
  getTeacherById(tenantId: string, teacherId: string): Promise<TeacherModel | null>;
  listTeachers(tenantId: string): Promise<TeacherModel[]>;
  updateTeacher(
    tenantId: string,
    teacherId: string,
    updates: Partial<TeacherModel>
  ): Promise<TeacherModel>;

  // Assistant management
  createAssistant(
    tenantId: string,
    data: {
      name: string;
      phone: string;
      assistant_type: AssistantType;
      teacher_id?: string | null;
      can_view_financials: boolean;
      status: MemberStatus;
      user_id?: string | null;
      invite_token?: string | null;
    }
  ): Promise<AssistantModel>;
  getAssistantById(tenantId: string, assistantId: string): Promise<AssistantModel | null>;
  listAssistants(tenantId: string): Promise<AssistantModel[]>;
  updateAssistant(
    tenantId: string,
    assistantId: string,
    updates: Partial<AssistantModel>
  ): Promise<AssistantModel>;

  // Rooms management & conflict
  createRoom(tenantId: string, data: CreateRoomInput): Promise<RoomModel>;
  listRooms(tenantId: string): Promise<RoomModel[]>;
  getRoomById(tenantId: string, roomId: string): Promise<RoomModel | null>;
  getRoomBookings(tenantId: string, roomId: string, date: string): Promise<RoomBookingSlot[]>;

  // Front-Desk scan queries
  getStudentByBarcode(tenantId: string, barcode: string): Promise<{
    id: string;
    name: string;
    barcode: string;
    phone?: string;
  } | null>;
  getStudentEnrollments(tenantId: string, studentId: string): Promise<EnrollmentModel[]>;
  getActiveSessionsForCenter(tenantId: string, date: string): Promise<ActiveCenterSession[]>;
  recordAttendanceForSession(tenantId: string, data: {
    session_id: string;
    student_id: string;
    status: "present" | "late" | "absent";
    is_makeup?: boolean;
    scanned_at?: string;
  }): Promise<{ id: string; recorded: boolean }>;

  // DEV-78: Financials & Payouts repository methods
  getTeacherSessionStats(tenantId: string, teacherId: string, period: string): Promise<{
    total_revenue: number;
    student_count: number;
    sessions_count: number;
  }>;
  getTeacherPayout(tenantId: string, teacherId: string, period: string): Promise<TeacherPayoutModel | null>;
  listTeacherPayouts(tenantId: string, period: string): Promise<TeacherPayoutModel[]>;
  saveTeacherPayout(tenantId: string, data: {
    teacher_id: string;
    period: string;
    total_revenue: number;
    teacher_cut: number;
    center_cut: number;
    status: TeacherPayoutStatus;
    paid_at?: string | null;
    paid_by?: string | null;
    notes?: string | null;
  }): Promise<TeacherPayoutModel>;

  // Provisioning
  createAuthUserAndProfile(data: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    tenantId: string;
    role: "teacher" | "assistant_to_teacher" | "assistant_to_center";
    teacherId?: string | null;
    assistantId?: string | null;
  }): Promise<{ user_id: string }>;
}
