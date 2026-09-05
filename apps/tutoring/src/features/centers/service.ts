import {
  ICentersRepository,
  CreateTeacherInput,
  CreateAssistantInput,
  AcceptInviteInput,
  TeacherModel,
  AssistantModel,
  OnboardingResult,
} from "./types.js";
import {
  generateInviteToken,
  verifyInviteToken,
} from "../../shared/utils/tokens.js";

/**
 * Centrly Centers Domain Service (DEV-76)
 * Strict Clean Architecture: Zero database client imports.
 * Encapsulates multi-teacher and assistant onboarding logic, hybrid invitations,
 * and scoped role assignments.
 */
export class CentersService {
  constructor(private readonly repository: ICentersRepository) {}

  private validatePassword(password: string): boolean {
    return Boolean(password && password.length >= 8);
  }

  /**
   * DEV-76: Add teacher to center via invite-link or direct-creation.
   */
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

      // 1. Create teacher record first to get teacher_id
      const teacher = await this.repository.createTeacher(tenantId, {
        name: input.name.trim(),
        phone: input.phone.trim(),
        subjects,
        revenue_model: revenueModel,
        revenue_value: revenueValue,
        status: "active",
      });

      // 2. Provision Auth user and link profile
      const authRes = await this.repository.createAuthUserAndProfile({
        email: input.email.trim(),
        password: input.password,
        fullName: input.name.trim(),
        phone: input.phone.trim(),
        tenantId,
        role: "teacher",
        teacherId: teacher.id,
      });

      // 3. Attach user_id
      const updatedTeacher = await this.repository.updateTeacher(tenantId, teacher.id, {
        user_id: authRes.user_id,
        email: input.email.trim(),
      });

      return {
        member: updatedTeacher,
        onboarding_method: "direct_creation",
      };
    }

    // Invite-link flow
    const teacher = await this.repository.createTeacher(tenantId, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      subjects,
      revenue_model: revenueModel,
      revenue_value: revenueValue,
      status: "invited",
    });

    const inviteToken = generateInviteToken(tenantId, teacher.id, "teacher", 7);
    const updatedTeacher = await this.repository.updateTeacher(tenantId, teacher.id, {
      invite_token: inviteToken,
      email: input.email ? input.email.trim() : null,
    });

    return {
      member: updatedTeacher,
      onboarding_method: "invite_link",
      invite_token: inviteToken,
      invite_url: `/invite/${inviteToken}`,
    };
  }

  /**
   * DEV-76: Add assistant (to specific teacher or center-wide) via invite or direct creation.
   */
  async addAssistant(
    tenantId: string,
    input: CreateAssistantInput
  ): Promise<OnboardingResult<AssistantModel>> {
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    if (!input.name || !input.name.trim()) throw new Error("ASSISTANT_NAME_REQUIRED");
    if (!input.phone || !input.phone.trim()) throw new Error("ASSISTANT_PHONE_REQUIRED");

    const method = input.onboarding_method || (input.password ? "direct_creation" : "invite_link");
    const assistantType =
      input.assistant_type ||
      (input.teacher_id ? "assistant_to_teacher" : "assistant_to_center");
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
        teacherId: input.teacher_id || null,
        assistantId: assistant.id,
      });

      const updatedAssistant = await this.repository.updateAssistant(tenantId, assistant.id, {
        user_id: authRes.user_id,
        email: input.email.trim(),
      });

      return {
        member: updatedAssistant,
        onboarding_method: "direct_creation",
      };
    }

    // Invite-link flow
    const assistant = await this.repository.createAssistant(tenantId, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      assistant_type: assistantType,
      teacher_id: input.teacher_id || null,
      can_view_financials: canViewFinancials,
      status: "invited",
    });

    const inviteToken = generateInviteToken(tenantId, assistant.id, assistantType, 7);
    const updatedAssistant = await this.repository.updateAssistant(tenantId, assistant.id, {
      invite_token: inviteToken,
      email: input.email ? input.email.trim() : null,
    });

    return {
      member: updatedAssistant,
      onboarding_method: "invite_link",
      invite_token: inviteToken,
      invite_url: `/invite/${inviteToken}`,
    };
  }

  /**
   * DEV-76: Accept invite token, set password, and activate account.
   */
  async acceptInvite(input: AcceptInviteInput): Promise<{
    success: boolean;
    role: string;
    record_id: string;
    user_id: string;
  }> {
    if (!input.token) throw new Error("TOKEN_REQUIRED");
    if (!input.password || !this.validatePassword(input.password)) {
      throw new Error("WEAK_PASSWORD");
    }

    const payload = verifyInviteToken(input.token);
    if (!payload) {
      throw new Error("INVALID_OR_EXPIRED_TOKEN");
    }

    const { tenant_id: tenantId, record_id: recordId, role } = payload;

    if (role === "teacher") {
      const teacher = await this.repository.getTeacherById(tenantId, recordId);
      if (!teacher || teacher.status !== "invited") {
        throw new Error("INVITATION_NOT_AVAILABLE");
      }

      const email = input.email || teacher.email;
      if (!email) throw new Error("EMAIL_REQUIRED");

      const authRes = await this.repository.createAuthUserAndProfile({
        email: email.trim(),
        password: input.password,
        fullName: teacher.name,
        phone: teacher.phone,
        tenantId,
        role: "teacher",
        teacherId: teacher.id,
      });

      await this.repository.updateTeacher(tenantId, teacher.id, {
        user_id: authRes.user_id,
        status: "active",
        invite_token: null,
        email: email.trim(),
      });

      return {
        success: true,
        role: "teacher",
        record_id: teacher.id,
        user_id: authRes.user_id,
      };
    }

    // Assistant invitation
    const assistant = await this.repository.getAssistantById(tenantId, recordId);
    if (!assistant || assistant.status !== "invited") {
      throw new Error("INVITATION_NOT_AVAILABLE");
    }

    const email = input.email || assistant.email;
    if (!email) throw new Error("EMAIL_REQUIRED");

    const authRes = await this.repository.createAuthUserAndProfile({
      email: email.trim(),
      password: input.password,
      fullName: assistant.name,
      phone: assistant.phone,
      tenantId,
      role: assistant.assistant_type,
      teacherId: assistant.teacher_id,
      assistantId: assistant.id,
    });

    await this.repository.updateAssistant(tenantId, assistant.id, {
      user_id: authRes.user_id,
      status: "active",
      invite_token: null,
      email: email.trim(),
    });

    return {
      success: true,
      role: assistant.assistant_type,
      record_id: assistant.id,
      user_id: authRes.user_id,
    };
  }

  async resendTeacherInvite(
    tenantId: string,
    teacherId: string
  ): Promise<{ invite_token: string; invite_url: string }> {
    const teacher = await this.repository.getTeacherById(tenantId, teacherId);
    if (!teacher) throw new Error("TEACHER_NOT_FOUND");
    if (teacher.status === "active") throw new Error("TEACHER_ALREADY_ACTIVE");

    const inviteToken = generateInviteToken(tenantId, teacher.id, "teacher", 7);
    await this.repository.updateTeacher(tenantId, teacher.id, { invite_token: inviteToken });

    return {
      invite_token: inviteToken,
      invite_url: `/invite/${inviteToken}`,
    };
  }

  async resendAssistantInvite(
    tenantId: string,
    assistantId: string
  ): Promise<{ invite_token: string; invite_url: string }> {
    const assistant = await this.repository.getAssistantById(tenantId, assistantId);
    if (!assistant) throw new Error("ASSISTANT_NOT_FOUND");
    if (assistant.status === "active") throw new Error("ASSISTANT_ALREADY_ACTIVE");

    const inviteToken = generateInviteToken(
      tenantId,
      assistant.id,
      assistant.assistant_type,
      7
    );
    await this.repository.updateAssistant(tenantId, assistant.id, { invite_token: inviteToken });

    return {
      invite_token: inviteToken,
      invite_url: `/invite/${inviteToken}`,
    };
  }

  async listTeachers(tenantId: string): Promise<TeacherModel[]> {
    return this.repository.listTeachers(tenantId);
  }

  async listAssistants(tenantId: string): Promise<AssistantModel[]> {
    return this.repository.listAssistants(tenantId);
  }
}
