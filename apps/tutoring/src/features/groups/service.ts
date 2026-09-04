import {
  Group,
  CreateGroupDTO,
  CreateSectionDTO,
  UpdateGroupDTO,
  EnrolledStudent,
  GroupRollUpReport,
  IGroupsRepository,
} from "./types.js";

export function sanitizeGroupForRole(group: Group, role?: string): Group {
  if (role === "assistant") {
    const safe = { ...group };
    delete safe.price;
    delete safe.billing_model;
    delete safe.fixed_rent_amount;
    return safe;
  }
  return group;
}

export class GroupsService {
  constructor(private readonly repo: IGroupsRepository) {}

  async listGroups(tenantId: string | undefined, userRole?: string): Promise<Group[]> {
    const groups = await this.repo.list(tenantId);
    return groups.map((g) => sanitizeGroupForRole(g, userRole));
  }

  async getGroup(
    id: string,
    userRole?: string
  ): Promise<{ group: Group; students: EnrolledStudent[] } | null> {
    const group = await this.repo.findById(id);
    if (!group) return null;

    const students = await this.repo.getEnrolledStudents(id);
    return {
      group: sanitizeGroupForRole(group, userRole),
      students,
    };
  }

  async createGroup(
    tenantId: string | undefined,
    data: CreateGroupDTO,
    userRole?: string
  ): Promise<Group> {
    if (!tenantId && userRole !== "admin") {
      throw new Error("NO_TENANT_CONTEXT");
    }

    return this.repo.create(tenantId, data);
  }

  async updateGroup(id: string, data: UpdateGroupDTO): Promise<Group | null> {
    return this.repo.update(id, data);
  }

  async deleteGroup(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async enrollStudent(
    tenantId: string | undefined,
    groupId: string,
    studentId: string
  ): Promise<{ id: string; group_id: string; student_id: string }> {
    return this.repo.enrollStudent(tenantId, groupId, studentId);
  }

  async removeStudent(groupId: string, studentId: string): Promise<void> {
    await this.repo.removeStudent(groupId, studentId);
  }

  async getBarcodeStudents(
    groupId: string
  ): Promise<{ groupName: string; students: Array<{ id: string; name: string; student_code: string }> }> {
    const group = await this.repo.findById(groupId);
    if (!group) {
      throw new Error("GROUP_NOT_FOUND");
    }

    const enrolled = await this.repo.getEnrolledStudents(groupId);
    const students = enrolled.map((s, idx) => ({
      id: s.id,
      name: s.name,
      student_code: s.student_code || String(1001 + idx),
    }));

    if (students.length === 0) {
      throw new Error("NO_STUDENTS");
    }

    return {
      groupName: group.name,
      students,
    };
  }

  /**
   * DEV-49: Create a named section/sub-group under an existing parent group.
   * Inherits pricing and center details from parent unless overridden.
   */
  async createSection(
    tenantId: string | undefined,
    parentGroupId: string,
    data: CreateSectionDTO,
    userRole?: string
  ): Promise<Group> {
    if (!tenantId && userRole !== "admin") {
      throw new Error("NO_TENANT_CONTEXT");
    }

    const parent = await this.repo.findById(parentGroupId);
    if (!parent) {
      throw new Error("PARENT_GROUP_NOT_FOUND");
    }

    const fullName = `${parent.name} - ${data.section_name}`;
    const sectionData: CreateSectionDTO = {
      section_name: data.section_name,
      price: data.price !== undefined ? data.price : parent.price,
      billing_model: data.billing_model || parent.billing_model,
      fixed_rent_amount: data.fixed_rent_amount !== undefined ? data.fixed_rent_amount : parent.fixed_rent_amount,
      center_name: data.center_name || parent.center_name,
    };

    const section = await this.repo.createSection(tenantId, parentGroupId, sectionData, fullName);
    return sanitizeGroupForRole(section, userRole);
  }

  /**
   * DEV-49: List all child sections under a parent group.
   */
  async listSections(parentGroupId: string, userRole?: string): Promise<Group[]> {
    const sections = await this.repo.listSections(parentGroupId);
    return sections.map((s) => sanitizeGroupForRole(s, userRole));
  }

  /**
   * DEV-49: Aggregated roll-up report across parent group and all its sections.
   * Calculates total students, sessions, and revenue across the entire grade.
   */
  async getGroupRollUp(parentGroupId: string, userRole?: string): Promise<GroupRollUpReport> {
    const report = await this.repo.getGroupRollUp(parentGroupId);
    if (!report) {
      throw new Error("GROUP_NOT_FOUND");
    }

    const sanitizedParent = sanitizeGroupForRole(report.parent_group, userRole);
    const sanitizedSections = report.sections.map((s) => sanitizeGroupForRole(s, userRole));

    if (userRole === "assistant") {
      delete report.total_revenue;
    }

    return {
      ...report,
      parent_group: sanitizedParent,
      sections: sanitizedSections,
    };
  }
}
