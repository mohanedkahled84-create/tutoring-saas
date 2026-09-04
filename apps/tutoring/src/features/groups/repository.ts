import { SupabaseClient } from "@supabase/supabase-js";
import {
  Group,
  CreateGroupDTO,
  CreateSectionDTO,
  UpdateGroupDTO,
  EnrolledStudent,
  GroupRollUpReport,
  IGroupsRepository,
} from "./types.js";

export class SupabaseGroupsRepository implements IGroupsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(tenantId?: string): Promise<Group[]> {
    let query = this.client
      .from("groups")
      .select("id, tenant_id, name, price, billing_model, fixed_rent_amount, center_name, created_at")
      .order("name", { ascending: true });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return (data as Group[]) || [];
  }

  async findById(id: string): Promise<Group | null> {
    const { data, error } = await this.client
      .from("groups")
      .select("id, tenant_id, name, price, billing_model, fixed_rent_amount, center_name, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (data as Group) || null;
  }

  async create(tenantId: string | undefined, data: CreateGroupDTO): Promise<Group> {
    const { data: created, error } = await this.client
      .from("groups")
      .insert({
        tenant_id: tenantId,
        name: data.name,
        price: data.price || 0,
        billing_model: data.billing_model || "percentage",
        fixed_rent_amount: data.fixed_rent_amount || null,
        center_name: data.center_name || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return created as Group;
  }

  async update(id: string, data: UpdateGroupDTO): Promise<Group | null> {
    const updatePayload: Record<string, unknown> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.price !== undefined) updatePayload.price = data.price;
    if (data.billing_model !== undefined) updatePayload.billing_model = data.billing_model;
    if (data.fixed_rent_amount !== undefined) updatePayload.fixed_rent_amount = data.fixed_rent_amount;
    if (data.center_name !== undefined) updatePayload.center_name = data.center_name;

    const { data: updated, error } = await this.client
      .from("groups")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (updated as Group) || null;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("groups").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async getEnrolledStudents(groupId: string): Promise<EnrolledStudent[]> {
    const { data: enrollments, error } = await this.client
      .from("group_students")
      .select("id, student_id, students(id, name, parent_phone, student_phone, student_code, fee_override, exempt)")
      .eq("group_id", groupId);

    if (error) {
      throw new Error(error.message);
    }

    const rawEnrollments = (enrollments || []) as unknown as Array<{
      students?: EnrolledStudent | null;
    }>;

    return rawEnrollments
      .map((e) => e.students)
      .filter((s): s is EnrolledStudent => Boolean(s));
  }

  async enrollStudent(
    tenantId: string | undefined,
    groupId: string,
    studentId: string
  ): Promise<{ id: string; group_id: string; student_id: string }> {
    const { data, error } = await this.client
      .from("group_students")
      .insert({
        tenant_id: tenantId,
        group_id: groupId,
        student_id: studentId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data as { id: string; group_id: string; student_id: string };
  }

  async removeStudent(groupId: string, studentId: string): Promise<void> {
    const { error } = await this.client
      .from("group_students")
      .delete()
      .eq("group_id", groupId)
      .eq("student_id", studentId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async listSections(parentGroupId: string): Promise<Group[]> {
    const { data, error } = await this.client
      .from("groups")
      .select("id, tenant_id, name, price, billing_model, fixed_rent_amount, center_name, parent_group_id, is_section, section_name, created_at")
      .eq("parent_group_id", parentGroupId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return (data as Group[]) || [];
  }

  async createSection(
    tenantId: string | undefined,
    parentGroupId: string,
    data: CreateSectionDTO,
    fullName: string
  ): Promise<Group> {
    const { data: created, error } = await this.client
      .from("groups")
      .insert({
        tenant_id: tenantId,
        parent_group_id: parentGroupId,
        name: fullName,
        section_name: data.section_name,
        is_section: true,
        price: data.price || 0,
        billing_model: data.billing_model || "percentage",
        fixed_rent_amount: data.fixed_rent_amount || null,
        center_name: data.center_name || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return created as Group;
  }

  async getGroupRollUp(parentGroupId: string): Promise<GroupRollUpReport | null> {
    const parent = await this.findById(parentGroupId);
    if (!parent) return null;

    const sections = await this.listSections(parentGroupId);
    const allGroupIds = [parentGroupId, ...sections.map((s) => s.id)];

    const { data: enrollments } = await this.client
      .from("group_students")
      .select("student_id")
      .in("group_id", allGroupIds);

    const studentIds = new Set((enrollments || []).map((e: { student_id: string }) => e.student_id));

    const { data: sessions } = await this.client
      .from("sessions")
      .select("id")
      .in("group_id", allGroupIds);

    const sessionIds = (sessions || []).map((s: { id: string }) => s.id);

    let totalAttendance = 0;
    let totalRevenue = 0;
    if (sessionIds.length > 0) {
      const { data: attendance } = await this.client
        .from("attendance")
        .select("attended")
        .in("session_id", sessionIds);

      const attendedRecords = (attendance || []).filter((a: { attended: boolean }) => a.attended);
      totalAttendance = attendedRecords.length;
      totalRevenue = totalAttendance * (Number(parent.price) || 0);
    }

    return {
      parent_group: parent,
      sections,
      total_sections: sections.length,
      total_students_enrolled: studentIds.size,
      total_sessions: sessionIds.length,
      total_revenue: totalRevenue,
      total_attendance: totalAttendance,
    };
  }
}

export class FakeGroupsRepository implements IGroupsRepository {
  public groups: Group[] = [];
  public enrollments: Array<{ id: string; tenant_id?: string; group_id: string; student_id: string }> = [];
  public students: EnrolledStudent[] = [];

  async list(tenantId?: string): Promise<Group[]> {
    if (tenantId) {
      return this.groups.filter((g) => g.tenant_id === tenantId);
    }
    return [...this.groups];
  }

  async findById(id: string): Promise<Group | null> {
    const group = this.groups.find((g) => g.id === id);
    return group ? { ...group } : null;
  }

  async create(tenantId: string | undefined, data: CreateGroupDTO): Promise<Group> {
    const newGroup: Group = {
      id: `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId || "tenant-1",
      name: data.name,
      price: data.price || 0,
      billing_model: data.billing_model || "percentage",
      fixed_rent_amount: data.fixed_rent_amount || null,
      center_name: data.center_name || null,
      created_at: new Date().toISOString(),
    };
    this.groups.push(newGroup);
    return { ...newGroup };
  }

  async update(id: string, data: UpdateGroupDTO): Promise<Group | null> {
    const idx = this.groups.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    const updated: Group = {
      ...this.groups[idx],
      ...data,
    };
    this.groups[idx] = updated;
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.groups = this.groups.filter((g) => g.id !== id);
    this.enrollments = this.enrollments.filter((e) => e.group_id !== id);
  }

  async getEnrolledStudents(groupId: string): Promise<EnrolledStudent[]> {
    const studentIds = this.enrollments
      .filter((e) => e.group_id === groupId)
      .map((e) => e.student_id);
    return this.students.filter((s) => studentIds.includes(s.id));
  }

  async enrollStudent(
    tenantId: string | undefined,
    groupId: string,
    studentId: string
  ): Promise<{ id: string; group_id: string; student_id: string }> {
    const enrollment = {
      id: `enr-${Date.now()}`,
      tenant_id: tenantId,
      group_id: groupId,
      student_id: studentId,
    };
    this.enrollments.push(enrollment);
    return enrollment;
  }

  async removeStudent(groupId: string, studentId: string): Promise<void> {
    this.enrollments = this.enrollments.filter(
      (e) => !(e.group_id === groupId && e.student_id === studentId)
    );
  }

  async listSections(parentGroupId: string): Promise<Group[]> {
    return this.groups.filter((g) => g.parent_group_id === parentGroupId);
  }

  async createSection(
    tenantId: string | undefined,
    parentGroupId: string,
    data: CreateSectionDTO,
    fullName: string
  ): Promise<Group> {
    const newSection: Group = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId || "tenant-1",
      parent_group_id: parentGroupId,
      name: fullName,
      section_name: data.section_name,
      is_section: true,
      price: data.price !== undefined ? data.price : 0,
      billing_model: data.billing_model || "percentage",
      fixed_rent_amount: data.fixed_rent_amount || null,
      center_name: data.center_name || null,
      created_at: new Date().toISOString(),
    };
    this.groups.push(newSection);
    return { ...newSection };
  }

  async getGroupRollUp(parentGroupId: string): Promise<GroupRollUpReport | null> {
    const parent = await this.findById(parentGroupId);
    if (!parent) return null;

    const sections = await this.listSections(parentGroupId);
    const allGroupIds = [parentGroupId, ...sections.map((s) => s.id)];

    const enrolledStudentIds = new Set(
      this.enrollments
        .filter((e) => allGroupIds.includes(e.group_id))
        .map((e) => e.student_id)
    );

    return {
      parent_group: parent,
      sections,
      total_sections: sections.length,
      total_students_enrolled: enrolledStudentIds.size,
      total_sessions: 0,
      total_revenue: enrolledStudentIds.size * (parent.price || 0),
      total_attendance: enrolledStudentIds.size,
    };
  }
}
