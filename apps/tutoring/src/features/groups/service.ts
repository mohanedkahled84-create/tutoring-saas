import {
  Group,
  CreateGroupDTO,
  UpdateGroupDTO,
  EnrolledStudent,
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
}
