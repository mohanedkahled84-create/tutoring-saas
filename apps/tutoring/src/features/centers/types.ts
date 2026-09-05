export type TeacherRevenueModel = "percentage" | "fixed_per_student" | "fixed_total";
export type MemberStatus = "active" | "inactive" | "invited";
export type AssistantType = "assistant_to_center" | "assistant_to_teacher";

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
  created_at: string;
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
