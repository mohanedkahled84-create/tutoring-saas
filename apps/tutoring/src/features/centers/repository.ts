import { SupabaseClient } from "@supabase/supabase-js";
import {
  ICentersRepository,
  TeacherModel,
  AssistantModel,
  TeacherRevenueModel,
  MemberStatus,
  AssistantType,
  RoomModel,
  CreateRoomInput,
  RoomBookingSlot,
  EnrollmentModel,
  ActiveCenterSession,
} from "./types.js";

export class SupabaseCentersRepository implements ICentersRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly adminClient: SupabaseClient
  ) {}

  async createTeacher(
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
  ): Promise<TeacherModel> {
    const { data: row, error } = await this.adminClient
      .from("teachers")
      .insert({
        tenant_id: tenantId,
        name: data.name,
        phone: data.phone,
        subjects: data.subjects,
        revenue_model: data.revenue_model,
        revenue_value: data.revenue_value,
        status: data.status,
        user_id: data.user_id || null,
        invite_token: data.invite_token || null,
      })
      .select()
      .single();

    if (error || !row) {
      throw new Error(error ? error.message : "Failed to create teacher");
    }
    return row as unknown as TeacherModel;
  }

  async getTeacherById(tenantId: string, teacherId: string): Promise<TeacherModel | null> {
    const { data, error } = await this.adminClient
      .from("teachers")
      .select()
      .eq("tenant_id", tenantId)
      .eq("id", teacherId)
      .single();

    if (error || !data) return null;
    return data as unknown as TeacherModel;
  }

  async listTeachers(tenantId: string): Promise<TeacherModel[]> {
    const { data, error } = await this.adminClient
      .from("teachers")
      .select()
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as unknown as TeacherModel[];
  }

  async updateTeacher(
    tenantId: string,
    teacherId: string,
    updates: Partial<TeacherModel>
  ): Promise<TeacherModel> {
    const { data, error } = await this.adminClient
      .from("teachers")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", teacherId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to update teacher");
    }
    return data as unknown as TeacherModel;
  }

  async createAssistant(
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
  ): Promise<AssistantModel> {
    const { data: row, error } = await this.adminClient
      .from("assistants")
      .insert({
        tenant_id: tenantId,
        name: data.name,
        phone: data.phone,
        assistant_type: data.assistant_type,
        teacher_id: data.teacher_id || null,
        can_view_financials: data.can_view_financials,
        status: data.status,
        user_id: data.user_id || null,
        invite_token: data.invite_token || null,
      })
      .select()
      .single();

    if (error || !row) {
      throw new Error(error ? error.message : "Failed to create assistant");
    }
    return row as unknown as AssistantModel;
  }

  async getAssistantById(tenantId: string, assistantId: string): Promise<AssistantModel | null> {
    const { data, error } = await this.adminClient
      .from("assistants")
      .select()
      .eq("tenant_id", tenantId)
      .eq("id", assistantId)
      .single();

    if (error || !data) return null;
    return data as unknown as AssistantModel;
  }

  async listAssistants(tenantId: string): Promise<AssistantModel[]> {
    const { data, error } = await this.adminClient
      .from("assistants")
      .select()
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as unknown as AssistantModel[];
  }

  async updateAssistant(
    tenantId: string,
    assistantId: string,
    updates: Partial<AssistantModel>
  ): Promise<AssistantModel> {
    const { data, error } = await this.adminClient
      .from("assistants")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", assistantId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to update assistant");
    }
    return data as unknown as AssistantModel;
  }

  // --- Rooms Management ---
  async createRoom(tenantId: string, data: CreateRoomInput): Promise<RoomModel> {
    const { data: row, error } = await this.adminClient
      .from("rooms")
      .insert({
        tenant_id: tenantId,
        name: data.name,
        capacity: data.capacity,
      })
      .select()
      .single();

    if (error || !row) {
      throw new Error(error ? error.message : "Failed to create room");
    }
    return row as unknown as RoomModel;
  }

  async listRooms(tenantId: string): Promise<RoomModel[]> {
    const { data, error } = await this.adminClient
      .from("rooms")
      .select()
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    if (error || !data) return [];
    return data as unknown as RoomModel[];
  }

  async getRoomById(tenantId: string, roomId: string): Promise<RoomModel | null> {
    const { data, error } = await this.adminClient
      .from("rooms")
      .select()
      .eq("tenant_id", tenantId)
      .eq("id", roomId)
      .single();

    if (error || !data) return null;
    return data as unknown as RoomModel;
  }

  async getRoomBookings(tenantId: string, roomId: string, date: string): Promise<RoomBookingSlot[]> {
    const { data } = await this.adminClient
      .from("sessions")
      .select(`
        id,
        room_id,
        group_id,
        teacher_id,
        session_date,
        start_time,
        end_time,
        status,
        groups ( name ),
        teachers ( name )
      `)
      .eq("tenant_id", tenantId)
      .eq("room_id", roomId)
      .eq("session_date", date)
      .neq("status", "cancelled");

    interface SessionBookingRow {
      id: string;
      room_id: string;
      group_id: string;
      teacher_id?: string | null;
      session_date: string;
      start_time?: string | null;
      end_time?: string | null;
      status: string;
      groups?: { name?: string };
      teachers?: { name?: string };
    }

    return (data as unknown as SessionBookingRow[]).map((row) => ({
      session_id: row.id,
      room_id: row.room_id,
      group_id: row.group_id,
      group_name: row.groups?.name,
      teacher_id: row.teacher_id,
      teacher_name: row.teachers?.name,
      date: row.session_date,
      start_time: row.start_time || "00:00",
      end_time: row.end_time || "23:59",
      status: row.status,
    }));
  }

  // --- Front-Desk Queries ---
  async getStudentByBarcode(tenantId: string, barcode: string): Promise<{
    id: string;
    name: string;
    barcode: string;
    phone?: string;
  } | null> {
    const { data, error } = await this.adminClient
      .from("students")
      .select("id, name, barcode, phone")
      .eq("tenant_id", tenantId)
      .eq("barcode", barcode)
      .single();

    if (error || !data) return null;
    return data;
  }

  async getStudentEnrollments(tenantId: string, studentId: string): Promise<EnrollmentModel[]> {
    const { data, error } = await this.adminClient
      .from("enrollments")
      .select()
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    if (error || !data) return [];
    return data as unknown as EnrollmentModel[];
  }

  async getActiveSessionsForCenter(tenantId: string, date: string): Promise<ActiveCenterSession[]> {
    const { data } = await this.adminClient
      .from("sessions")
      .select(`
        id,
        group_id,
        teacher_id,
        room_id,
        session_number,
        session_date,
        start_time,
        end_time,
        status,
        groups ( name, subject ),
        teachers ( name ),
        rooms ( name )
      `)
      .eq("tenant_id", tenantId)
      .eq("session_date", date)
      .in("status", ["in_progress", "scheduled"]);

    interface ActiveSessionQueryResult {
      id: string;
      group_id: string;
      teacher_id?: string | null;
      room_id?: string | null;
      session_number: number;
      session_date: string;
      start_time?: string | null;
      end_time?: string | null;
      status: string;
      groups?: { name?: string; subject?: string };
      teachers?: { name?: string };
      rooms?: { name?: string };
    }

    return (data as unknown as ActiveSessionQueryResult[]).map((row) => ({
      id: row.id,
      group_id: row.group_id,
      group_name: row.groups?.name || "مجموعة غير مسماة",
      subject: row.groups?.subject,
      teacher_id: row.teacher_id,
      teacher_name: row.teachers?.name,
      room_id: row.room_id,
      room_name: row.rooms?.name,
      session_number: row.session_number,
      session_date: row.session_date,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
    }));
  }

  async recordAttendanceForSession(tenantId: string, data: {
    session_id: string;
    student_id: string;
    status: "present" | "late" | "absent";
    is_makeup?: boolean;
    scanned_at?: string;
  }): Promise<{ id: string; recorded: boolean }> {
    const { data: row, error } = await this.adminClient
      .from("attendance")
      .upsert(
        {
          tenant_id: tenantId,
          session_id: data.session_id,
          student_id: data.student_id,
          status: data.status,
          is_makeup: Boolean(data.is_makeup),
          scanned_at: data.scanned_at || new Date().toISOString(),
        },
        { onConflict: "session_id,student_id" }
      )
      .select("id")
      .single();

    if (error || !row) {
      throw new Error(error ? error.message : "Failed to record attendance");
    }
    return { id: row.id, recorded: true };
  }

  async createAuthUserAndProfile(data: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    tenantId: string;
    role: "teacher" | "assistant_to_teacher" | "assistant_to_center";
    teacherId?: string | null;
    assistantId?: string | null;
  }): Promise<{ user_id: string }> {
    const { data: authData, error: authError } = await this.adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        phone: data.phone,
        role: data.role,
        tenant_id: data.tenantId,
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError ? authError.message : "Failed to provision auth user");
    }

    const userId = authData.user.id;

    const { error: profileError } = await this.adminClient.from("users").insert({
      id: userId,
      tenant_id: data.tenantId,
      full_name: data.fullName,
      phone: data.phone,
      role: data.role,
      teacher_id: data.teacherId || null,
      assistant_id: data.assistantId || null,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      await this.adminClient.auth.admin.deleteUser(userId);
      throw new Error(profileError.message);
    }

    return { user_id: userId };
  }
}

/**
 * Clean Fake implementation for offline unit tests (Zero database dependencies)
 */
export class FakeCentersRepository implements ICentersRepository {
  public teachers: TeacherModel[] = [];
  public assistants: AssistantModel[] = [];
  public users: Array<{ id: string; role: string; full_name?: string; email?: string; teacher_id?: string | null; assistant_id?: string | null }> = [];
  public rooms: RoomModel[] = [];
  public roomBookings: RoomBookingSlot[] = [];
  public students: Array<{ id: string; tenant_id: string; name: string; barcode: string; phone?: string }> = [];
  public enrollments: EnrollmentModel[] = [];
  public activeSessions: ActiveCenterSession[] = [];
  public attendanceRecords: Array<{
    id: string;
    tenant_id: string;
    session_id: string;
    student_id: string;
    status: string;
    is_makeup: boolean;
    scanned_at: string;
  }> = [];

  async createTeacher(
    tenantId: string,
    data: {
      name: string;
      phone: string;
      subjects?: string[];
      revenue_model?: TeacherRevenueModel;
      revenue_value?: number;
      status?: MemberStatus;
      user_id?: string | null;
      invite_token?: string | null;
    }
  ): Promise<TeacherModel> {
    const teacher: TeacherModel = {
      id: `teacher-${this.teachers.length + 1}`,
      tenant_id: tenantId,
      user_id: data.user_id || null,
      name: data.name,
      phone: data.phone,
      email: null,
      subjects: data.subjects || [],
      revenue_model: data.revenue_model || "percentage",
      revenue_value: data.revenue_value || 0,
      status: data.status || "active",
      invite_token: data.invite_token || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.teachers.push(teacher);
    return teacher;
  }

  async getTeacherById(tenantId: string, teacherId: string): Promise<TeacherModel | null> {
    return this.teachers.find((t) => t.tenant_id === tenantId && t.id === teacherId) || null;
  }

  async listTeachers(tenantId: string): Promise<TeacherModel[]> {
    return this.teachers.filter((t) => t.tenant_id === tenantId);
  }

  async updateTeacher(tenantId: string, teacherId: string, updates: Partial<TeacherModel>): Promise<TeacherModel> {
    const idx = this.teachers.findIndex((t) => t.tenant_id === tenantId && t.id === teacherId);
    if (idx === -1) throw new Error("Teacher not found");
    this.teachers[idx] = { ...this.teachers[idx], ...updates, updated_at: new Date().toISOString() };
    return this.teachers[idx];
  }

  async createAssistant(
    tenantId: string,
    data: {
      name: string;
      phone: string;
      assistant_type?: AssistantType;
      teacher_id?: string | null;
      can_view_financials?: boolean;
      status?: MemberStatus;
      user_id?: string | null;
      invite_token?: string | null;
    }
  ): Promise<AssistantModel> {
    const assistant: AssistantModel = {
      id: `assistant-${this.assistants.length + 1}`,
      tenant_id: tenantId,
      name: data.name,
      phone: data.phone,
      email: null,
      assistant_type: data.assistant_type || "assistant_to_center",
      teacher_id: data.teacher_id || null,
      can_view_financials: Boolean(data.can_view_financials),
      status: data.status || "active",
      invite_token: data.invite_token || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.assistants.push(assistant);
    return assistant;
  }

  async getAssistantById(tenantId: string, assistantId: string): Promise<AssistantModel | null> {
    return this.assistants.find((a) => a.tenant_id === tenantId && a.id === assistantId) || null;
  }

  async listAssistants(tenantId: string): Promise<AssistantModel[]> {
    return this.assistants.filter((a) => a.tenant_id === tenantId);
  }

  async updateAssistant(tenantId: string, assistantId: string, updates: Partial<AssistantModel>): Promise<AssistantModel> {
    const idx = this.assistants.findIndex((a) => a.tenant_id === tenantId && a.id === assistantId);
    if (idx === -1) throw new Error("Assistant not found");
    this.assistants[idx] = { ...this.assistants[idx], ...updates, updated_at: new Date().toISOString() };
    return this.assistants[idx];
  }

  // --- Rooms Fake Implementation ---
  async createRoom(tenantId: string, data: CreateRoomInput): Promise<RoomModel> {
    const room: RoomModel = {
      id: `room-${this.rooms.length + 1}`,
      tenant_id: tenantId,
      name: data.name,
      capacity: data.capacity,
      location: data.location || null,
      created_at: new Date().toISOString(),
    };
    this.rooms.push(room);
    return room;
  }

  async listRooms(tenantId: string): Promise<RoomModel[]> {
    return this.rooms.filter((r) => r.tenant_id === tenantId);
  }

  async getRoomById(tenantId: string, roomId: string): Promise<RoomModel | null> {
    return this.rooms.find((r) => r.tenant_id === tenantId && r.id === roomId) || null;
  }

  async getRoomBookings(tenantId: string, roomId: string, date: string): Promise<RoomBookingSlot[]> {
    return this.roomBookings.filter((b) => b.room_id === roomId && b.date === date);
  }

  // --- Front-Desk Fake Implementation ---
  async getStudentByBarcode(tenantId: string, barcode: string): Promise<{ id: string; name: string; barcode: string; phone?: string } | null> {
    const s = this.students.find((st) => st.tenant_id === tenantId && st.barcode === barcode);
    return s ? { id: s.id, name: s.name, barcode: s.barcode, phone: s.phone } : null;
  }

  async getStudentEnrollments(tenantId: string, studentId: string): Promise<EnrollmentModel[]> {
    return this.enrollments.filter((e) => e.tenant_id === tenantId && e.student_id === studentId);
  }

  async getActiveSessionsForCenter(tenantId: string, date: string): Promise<ActiveCenterSession[]> {
    return this.activeSessions.filter((s) => s.session_date === date);
  }

  async recordAttendanceForSession(tenantId: string, data: {
    session_id: string;
    student_id: string;
    status: "present" | "late" | "absent";
    is_makeup?: boolean;
    scanned_at?: string;
  }): Promise<{ id: string; recorded: boolean }> {
    const rec = {
      id: `att-${this.attendanceRecords.length + 1}`,
      tenant_id: tenantId,
      session_id: data.session_id,
      student_id: data.student_id,
      status: data.status,
      is_makeup: Boolean(data.is_makeup),
      scanned_at: data.scanned_at || new Date().toISOString(),
    };
    this.attendanceRecords.push(rec);
    return { id: rec.id, recorded: true };
  }

  async createAuthUserAndProfile(data: {
    email: string;
    password?: string;
    fullName: string;
    phone?: string;
    tenantId?: string;
    role: "teacher" | "assistant_to_teacher" | "assistant_to_center";
    teacherId?: string | null;
    assistantId?: string | null;
  }): Promise<{ user_id: string }> {
    const userId = `fake-auth-user-${this.users.length + 1}`;
    this.users.push({
      id: userId,
      role: data.role,
      full_name: data.fullName,
      email: data.email,
      teacher_id: data.teacherId || null,
      assistant_id: data.assistantId || null,
    });
    return { user_id: userId };
  }
}
