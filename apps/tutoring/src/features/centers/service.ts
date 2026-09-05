import {
  ICentersRepository,
  CreateTeacherInput,
  CreateAssistantInput,
  AcceptInviteInput,
  TeacherModel,
  AssistantModel,
  OnboardingResult,
  RoomModel,
  CreateRoomInput,
  RoomConflictCheckInput,
  RoomConflictCheckResult,
  RoomAvailabilityResult,
  FrontDeskScanInput,
  FrontDeskScanResult,
} from "./types.js";
import {
  generateInviteToken,
  verifyInviteToken,
} from "../../shared/utils/tokens.js";

/**
 * Pure helper: parse time "HH:MM" or ISO timestamp to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  if (timeStr.includes("T")) {
    const d = new Date(timeStr);
    return d.getHours() * 60 + d.getMinutes();
  }
  const parts = timeStr.trim().split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Pure helper: standard interval overlap formula (sA < eB && eA > sB)
 */
export function isTimeOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = parseTimeToMinutes(startA);
  const eA = parseTimeToMinutes(endA);
  const sB = parseTimeToMinutes(startB);
  const eB = parseTimeToMinutes(endB);
  return sA < eB && eA > sB;
}

/**
 * Centrly Centers Domain Service (DEV-76, DEV-77)
 * Strict Clean Architecture: Zero database client imports.
 * Encapsulates multi-teacher and assistant onboarding logic, hybrid invitations,
 * room booking conflict detection, and front-desk smart scanning.
 */
export class CentersService {
  constructor(private readonly repository: ICentersRepository) {}

  private validatePassword(password: string): boolean {
    return Boolean(password && password.length >= 8);
  }

  // ==========================================================================
  // DEV-76: Teacher & Assistant Onboarding
  // ==========================================================================

  async addTeacher(
    tenantId: string,
    input: CreateTeacherInput
  ): Promise<OnboardingResult<TeacherModel>> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    if (!input.name || !input.name.trim()) throw new Error("TEACHER_NAME_REQUIRED");
    if (!input.phone || !input.phone.trim()) throw new Error("TEACHER_PHONE_REQUIRED");

    const method = input.onboarding_method || (input.password ? "direct_creation" : "invite_link");
    const subjects = input.subjects || [];
    const revenueModel = input.revenue_model || "percentage";
    const revenueValue = input.revenue_value !== undefined ? Number(input.revenue_value) : 0;

    if (method === "direct_creation") {
      if (!input.email) throw new Error("EMAIL_REQUIRED_FOR_DIRECT_CREATION");
      if (!input.password || !this.validatePassword(input.password)) {
        throw new Error("WEAK_PASSWORD");
      }

      const teacher = await this.repository.createTeacher(tenantId, {
        name: input.name.trim(),
        phone: input.phone.trim(),
        subjects,
        revenue_model: revenueModel,
        revenue_value: revenueValue,
        status: "active",
      });

      const authRes = await this.repository.createAuthUserAndProfile({
        email: input.email.trim(),
        password: input.password,
        fullName: input.name.trim(),
        phone: input.phone.trim(),
        tenantId,
        role: "teacher",
        teacherId: teacher.id,
      });

      const updatedTeacher = await this.repository.updateTeacher(tenantId, teacher.id, {
        user_id: authRes.user_id,
        email: input.email.trim(),
      });

      return {
        member: updatedTeacher,
        onboarding_method: "direct_creation",
      };
    }

    const inviteToken = generateInviteToken(tenantId, "temp", "teacher");
    const teacher = await this.repository.createTeacher(tenantId, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      subjects,
      revenue_model: revenueModel,
      revenue_value: revenueValue,
      status: "invited",
      invite_token: inviteToken,
    });

    const finalToken = generateInviteToken(tenantId, teacher.id, "teacher");
    const updatedTeacher = await this.repository.updateTeacher(tenantId, teacher.id, {
      invite_token: finalToken,
      email: input.email ? input.email.trim() : null,
    });

    return {
      member: updatedTeacher,
      onboarding_method: "invite_link",
      invite_token: finalToken,
      invite_url: `/register?invite=${finalToken}`,
    };
  }

  async resendTeacherInvite(
    tenantId: string,
    teacherId: string
  ): Promise<{ invite_token: string; invite_url: string }> {
    const teacher = await this.repository.getTeacherById(tenantId, teacherId);
    if (!teacher) throw new Error("TEACHER_NOT_FOUND");
    if (teacher.status === "active") throw new Error("TEACHER_ALREADY_ACTIVE");

    const newToken = generateInviteToken(tenantId, teacher.id, "teacher");
    await this.repository.updateTeacher(tenantId, teacher.id, {
      invite_token: newToken,
      status: "invited",
    });

    return {
      invite_token: newToken,
      invite_url: `/register?invite=${newToken}`,
    };
  }

  async acceptInvite(
    input: AcceptInviteInput
  ): Promise<{ success: boolean; role: string; member: TeacherModel | AssistantModel; record_id: string }> {
    if (!input.password || !this.validatePassword(input.password)) {
      throw new Error("WEAK_PASSWORD");
    }
    const payload = verifyInviteToken(input.token);
    if (!payload) throw new Error("INVALID_OR_EXPIRED_TOKEN");

    const { tenant_id: tenantId, record_id: memberId, role: memberType } = payload;

    if (memberType === "teacher") {
      const teacher = await this.repository.getTeacherById(tenantId, memberId);
      if (!teacher || teacher.status === "active" || teacher.invite_token !== input.token) {
        throw new Error("INVITATION_NOT_AVAILABLE");
      }

      const email = input.email || teacher.email || `teacher_${teacher.id.slice(0, 8)}@centrly.app`;
      const authRes = await this.repository.createAuthUserAndProfile({
        email,
        password: input.password,
        fullName: teacher.name,
        phone: teacher.phone,
        tenantId,
        role: "teacher",
        teacherId: teacher.id,
      });

      const updated = await this.repository.updateTeacher(tenantId, teacher.id, {
        user_id: authRes.user_id,
        email,
        status: "active",
        invite_token: null,
      });

      return { success: true, role: "teacher", member: updated, record_id: memberId };
    }

    const assistant = await this.repository.getAssistantById(tenantId, memberId);
    if (!assistant || assistant.status === "active" || assistant.invite_token !== input.token) {
      throw new Error("INVITATION_NOT_AVAILABLE");
    }

    const email = input.email || assistant.email || `assistant_${assistant.id.slice(0, 8)}@centrly.app`;
    const authRes = await this.repository.createAuthUserAndProfile({
      email,
      password: input.password,
      fullName: assistant.name,
      phone: assistant.phone,
      tenantId,
      role: assistant.assistant_type,
      assistantId: assistant.id,
    });

    const updated = await this.repository.updateAssistant(tenantId, assistant.id, {
      user_id: authRes.user_id,
      email,
      status: "active",
      invite_token: null,
    });

    return { success: true, role: assistant.assistant_type, member: updated, record_id: memberId };
  }

  async addAssistant(
    tenantId: string,
    input: CreateAssistantInput
  ): Promise<OnboardingResult<AssistantModel>> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    if (!input.name || !input.name.trim()) throw new Error("ASSISTANT_NAME_REQUIRED");
    if (!input.phone || !input.phone.trim()) throw new Error("ASSISTANT_PHONE_REQUIRED");

    const assistantType = input.assistant_type || (input.teacher_id ? "assistant_to_teacher" : "assistant_to_center");
    const method = input.onboarding_method || (input.password ? "direct_creation" : "invite_link");
    const canViewFinancials = Boolean(input.can_view_financials);

    if (method === "direct_creation") {
      if (!input.email) throw new Error("EMAIL_REQUIRED_FOR_DIRECT_CREATION");
      if (!input.password || !this.validatePassword(input.password)) {
        throw new Error("WEAK_PASSWORD");
      }

      const assistant = await this.repository.createAssistant(tenantId, {
        name: input.name.trim(),
        phone: input.phone.trim(),
        assistant_type: assistantType,
        teacher_id: input.teacher_id || null,
        can_view_financials: canViewFinancials,
        status: "active",
      });

      const authRes = await this.repository.createAuthUserAndProfile({
        email: input.email.trim(),
        password: input.password,
        fullName: input.name.trim(),
        phone: input.phone.trim(),
        tenantId,
        role: assistantType,
        assistantId: assistant.id,
      });

      const updated = await this.repository.updateAssistant(tenantId, assistant.id, {
        user_id: authRes.user_id,
        email: input.email.trim(),
      });

      return {
        member: updated,
        onboarding_method: "direct_creation",
      };
    }

    const inviteToken = generateInviteToken(tenantId, "temp", assistantType);
    const assistant = await this.repository.createAssistant(tenantId, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      assistant_type: assistantType,
      teacher_id: input.teacher_id || null,
      can_view_financials: canViewFinancials,
      status: "invited",
      invite_token: inviteToken,
    });

    const finalToken = generateInviteToken(tenantId, assistant.id, assistantType);
    const updated = await this.repository.updateAssistant(tenantId, assistant.id, {
      invite_token: finalToken,
      email: input.email ? input.email.trim() : null,
    });

    return {
      member: updated,
      onboarding_method: "invite_link",
      invite_token: finalToken,
      invite_url: `/register?invite=${finalToken}`,
    };
  }

  async resendAssistantInvite(
    tenantId: string,
    assistantId: string
  ): Promise<{ invite_token: string; invite_url: string }> {
    const assistant = await this.repository.getAssistantById(tenantId, assistantId);
    if (!assistant) throw new Error("ASSISTANT_NOT_FOUND");
    if (assistant.status === "active") throw new Error("ASSISTANT_ALREADY_ACTIVE");

    const newToken = generateInviteToken(tenantId, assistant.id, assistant.assistant_type);
    await this.repository.updateAssistant(tenantId, assistant.id, {
      invite_token: newToken,
      status: "invited",
    });

    return {
      invite_token: newToken,
      invite_url: `/register?invite=${newToken}`,
    };
  }

  async listTeachers(tenantId: string): Promise<TeacherModel[]> {
    return this.repository.listTeachers(tenantId);
  }

  async listAssistants(tenantId: string): Promise<AssistantModel[]> {
    return this.repository.listAssistants(tenantId);
  }

  async getTeacherById(tenantId: string, teacherId: string): Promise<TeacherModel | null> {
    return this.repository.getTeacherById(tenantId, teacherId);
  }

  async getAssistantById(tenantId: string, assistantId: string): Promise<AssistantModel | null> {
    return this.repository.getAssistantById(tenantId, assistantId);
  }

  // ==========================================================================
  // DEV-77: Rooms & Booking Conflict Engine
  // ==========================================================================

  async createRoom(tenantId: string, input: CreateRoomInput): Promise<RoomModel> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    if (!input.name || !input.name.trim()) throw new Error("ROOM_NAME_REQUIRED");
    const capacity = Number(input.capacity);
    if (isNaN(capacity) || capacity <= 0) {
      throw new Error("INVALID_CAPACITY");
    }

    return this.repository.createRoom(tenantId, {
      name: input.name.trim(),
      capacity,
      location: input.location ? input.location.trim() : undefined,
    });
  }

  async listRooms(tenantId: string): Promise<RoomModel[]> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    return this.repository.listRooms(tenantId);
  }

  async getRoomById(tenantId: string, roomId: string): Promise<RoomModel> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    const room = await this.repository.getRoomById(tenantId, roomId);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    return room;
  }

  /**
   * Pure conflict check: compares proposed time against existing room bookings.
   * Also surfaces non-blocking capacity warning if group size > room capacity.
   */
  async checkRoomConflict(
    tenantId: string,
    input: RoomConflictCheckInput
  ): Promise<RoomConflictCheckResult> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    if (!input.room_id) throw new Error("ROOM_ID_REQUIRED");
    if (!input.date) throw new Error("DATE_REQUIRED");
    if (!input.start_time || !input.end_time) throw new Error("TIME_RANGE_REQUIRED");

    const room = await this.getRoomById(tenantId, input.room_id);

    // 1. Check capacity warning (soft warning, non-blocking)
    const warning =
      input.student_count !== undefined && input.student_count > room.capacity
        ? {
            code: "CAPACITY_EXCEEDED" as const,
            message: `عدد طلاب المجموعة (${input.student_count}) يتجاوز سعة القاعة (${room.capacity})`,
            room_capacity: room.capacity,
            student_count: input.student_count,
          }
        : null;

    // 2. Fetch existing bookings on the requested date
    const bookings = await this.repository.getRoomBookings(tenantId, input.room_id, input.date);

    for (const b of bookings) {
      if (input.exclude_session_id && b.session_id === input.exclude_session_id) {
        continue;
      }
      if (b.status === "cancelled") {
        continue;
      }

      if (isTimeOverlapping(b.start_time, b.end_time, input.start_time, input.end_time)) {
        return {
          has_conflict: true,
          conflicting_booking: b,
          warning,
        };
      }
    }

    return {
      has_conflict: false,
      conflicting_booking: null,
      warning,
    };
  }

  async getRoomAvailability(
    tenantId: string,
    roomId: string,
    date: string
  ): Promise<RoomAvailabilityResult> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    const room = await this.getRoomById(tenantId, roomId);
    const bookings = await this.repository.getRoomBookings(tenantId, roomId, date);
    return {
      room,
      date,
      bookings,
    };
  }

  // ==========================================================================
  // DEV-77: Front-Desk / Smart Gate Mode Scanning
  // ==========================================================================

  async frontDeskScan(
    tenantId: string,
    input: FrontDeskScanInput
  ): Promise<FrontDeskScanResult> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    if (!input.barcode || !input.barcode.trim()) {
      throw new Error("BARCODE_REQUIRED");
    }

    const barcode = input.barcode.trim();
    const student = await this.repository.getStudentByBarcode(tenantId, barcode);

    // Edge case 1: Student not found
    if (!student) {
      return {
        success: false,
        mode: "front_desk",
        code: "STUDENT_NOT_FOUND",
        message: "طالب غير مسجل في السنتر",
        audio_alert: "error",
      };
    }

    // Determine current date
    const dateStr = input.current_time
      ? input.current_time.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const [enrollments, activeSessions] = await Promise.all([
      this.repository.getStudentEnrollments(tenantId, student.id),
      this.repository.getActiveSessionsForCenter(tenantId, dateStr),
    ]);

    const activeEnrollments = enrollments.filter((e) => e.status === "active");

    // Edge case 2: No active enrollments
    if (activeEnrollments.length === 0) {
      return {
        success: false,
        mode: "front_desk",
        code: "NO_ACTIVE_ENROLLMENT_MATCH",
        message: "لا يوجد أي اشتراك نشط للطالب في هذا السنتر",
        audio_alert: "warning",
        student,
      };
    }

    // Edge case 3: No active sessions currently running
    if (activeSessions.length === 0) {
      return {
        success: false,
        mode: "front_desk",
        code: "NO_ACTIVE_ENROLLMENT_MATCH",
        message: "لا توجد حصص نشطة حالياً في السنتر",
        audio_alert: "warning",
        student,
      };
    }

    // 1. Check exact group match
    const exactMatch = activeSessions.find((session) =>
      activeEnrollments.some((e) => e.group_id === session.group_id)
    );

    if (exactMatch) {
      await this.repository.recordAttendanceForSession(tenantId, {
        session_id: exactMatch.id,
        student_id: student.id,
        status: "present",
        is_makeup: false,
        scanned_at: input.current_time || new Date().toISOString(),
      });

      return {
        success: true,
        mode: "front_desk",
        message: `✅ ${student.name} — حاضر (${exactMatch.subject || "حصة"} - ${exactMatch.room_name || "قاعة"} - مستر ${exactMatch.teacher_name || "المدرس"})`,
        audio_alert: "success",
        student,
        session: {
          id: exactMatch.id,
          subject: exactMatch.subject || undefined,
          room_name: exactMatch.room_name || undefined,
          teacher_name: exactMatch.teacher_name || undefined,
          group_name: exactMatch.group_name,
          session_number: exactMatch.session_number,
          is_makeup: false,
        },
      };
    }

    // 2. Check make-up match (same teacher, different group)
    const makeupMatch = activeSessions.find(
      (session) =>
        session.teacher_id &&
        activeEnrollments.some((e) => e.teacher_id === session.teacher_id)
    );

    if (makeupMatch) {
      await this.repository.recordAttendanceForSession(tenantId, {
        session_id: makeupMatch.id,
        student_id: student.id,
        status: "present",
        is_makeup: true,
        scanned_at: input.current_time || new Date().toISOString(),
      });

      return {
        success: true,
        mode: "front_desk",
        message: `✅ ${student.name} — حاضر [تعويض] (${makeupMatch.subject || "حصة"} - ${makeupMatch.room_name || "قاعة"} - مستر ${makeupMatch.teacher_name || "المدرس"})`,
        audio_alert: "success",
        student,
        session: {
          id: makeupMatch.id,
          subject: makeupMatch.subject || undefined,
          room_name: makeupMatch.room_name || undefined,
          teacher_name: makeupMatch.teacher_name || undefined,
          group_name: makeupMatch.group_name,
          session_number: makeupMatch.session_number,
          is_makeup: true,
        },
      };
    }

    // Edge case 4: Student enrolled in center, but not in any session running now
    return {
      success: false,
      mode: "front_desk",
      code: "NO_ACTIVE_ENROLLMENT_MATCH",
      message: "لا توجد حصة نشطة مسجل بها الطالب حالياً",
      audio_alert: "warning",
      student,
    };
  }
}
