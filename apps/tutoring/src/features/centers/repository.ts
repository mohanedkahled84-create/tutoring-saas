import { SupabaseClient } from "@supabase/supabase-js";
import {
  ICentersRepository,
  TeacherModel,
  AssistantModel,
  TeacherRevenueModel,
  MemberStatus,
  AssistantType,
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
    const { data, error } = await this.client
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
    const { data, error } = await this.client
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
    const { data: authUser, error: authErr } = await this.adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });

    if (authErr || !authUser.user) {
      throw new Error(authErr ? authErr.message : "Failed to provision member auth user");
    }

    const userId = authUser.user.id;

    const { error: profileErr } = await this.adminClient.from("users").insert({
      id: userId,
      tenant_id: data.tenantId,
      email: data.email,
      role: data.role,
      teacher_id: data.teacherId || null,
      assistant_id: data.assistantId || null,
    });

    if (profileErr) {
      throw new Error(profileErr.message);
    }

    return { user_id: userId };
  }
}

/**
 * In-memory repository for unit testing
 */
export class FakeCentersRepository implements ICentersRepository {
  public teachers: TeacherModel[] = [];
  public assistants: AssistantModel[] = [];
  public users: Array<{ id: string; email: string; role: string }> = [];

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
    const teacher: TeacherModel = {
      id: `teach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenant_id: tenantId,
      name: data.name,
      phone: data.phone,
      subjects: data.subjects,
      revenue_model: data.revenue_model,
      revenue_value: data.revenue_value,
      status: data.status,
      user_id: data.user_id || null,
      invite_token: data.invite_token || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.teachers.push(teacher);
    return teacher;
  }

  async getTeacherById(tenantId: string, teacherId: string): Promise<TeacherModel | null> {
    const t = this.teachers.find((row) => row.tenant_id === tenantId && row.id === teacherId);
    return t || null;
  }

  async listTeachers(tenantId: string): Promise<TeacherModel[]> {
    return this.teachers.filter((row) => row.tenant_id === tenantId);
  }

  async updateTeacher(
    tenantId: string,
    teacherId: string,
    updates: Partial<TeacherModel>
  ): Promise<TeacherModel> {
    const idx = this.teachers.findIndex((row) => row.tenant_id === tenantId && row.id === teacherId);
    if (idx === -1) throw new Error("TEACHER_NOT_FOUND");
    this.teachers[idx] = {
      ...this.teachers[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return this.teachers[idx];
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
    const assistant: AssistantModel = {
      id: `asst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenant_id: tenantId,
      name: data.name,
      phone: data.phone,
      assistant_type: data.assistant_type,
      teacher_id: data.teacher_id || null,
      can_view_financials: data.can_view_financials,
      status: data.status,
      user_id: data.user_id || null,
      invite_token: data.invite_token || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.assistants.push(assistant);
    return assistant;
  }

  async getAssistantById(tenantId: string, assistantId: string): Promise<AssistantModel | null> {
    const a = this.assistants.find((row) => row.tenant_id === tenantId && row.id === assistantId);
    return a || null;
  }

  async listAssistants(tenantId: string): Promise<AssistantModel[]> {
    return this.assistants.filter((row) => row.tenant_id === tenantId);
  }

  async updateAssistant(
    tenantId: string,
    assistantId: string,
    updates: Partial<AssistantModel>
  ): Promise<AssistantModel> {
    const idx = this.assistants.findIndex((row) => row.tenant_id === tenantId && row.id === assistantId);
    if (idx === -1) throw new Error("ASSISTANT_NOT_FOUND");
    this.assistants[idx] = {
      ...this.assistants[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return this.assistants[idx];
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
    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.users.push({ id: userId, email: data.email, role: data.role });
    return { user_id: userId };
  }
}
