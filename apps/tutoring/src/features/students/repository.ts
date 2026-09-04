import { SupabaseClient } from "@supabase/supabase-js";
import {
  Student,
  UpdateStudentDTO,
  GroupRecord,
  IStudentsRepository,
} from "./types.js";

export class SupabaseStudentsRepository implements IStudentsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(tenantId?: string, query?: string): Promise<Student[]> {
    let q = this.client
      .from("students")
      .select("id, tenant_id, code, student_code, name, parent_phone, student_phone, fee_override, exempt, notes, created_at")
      .order("created_at", { ascending: false });

    if (tenantId) {
      q = q.eq("tenant_id", tenantId);
    }

    if (query && query.trim().length > 0) {
      const sanitized = query.trim();
      q = q.or(
        `name.ilike.%${sanitized}%,code.ilike.%${sanitized}%,parent_phone.ilike.%${sanitized}%,student_phone.ilike.%${sanitized}%`
      );
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(error.message);
    }
    return (data as Student[]) || [];
  }

  async findById(id: string): Promise<Student | null> {
    const { data, error } = await this.client
      .from("students")
      .select("id, tenant_id, code, student_code, name, parent_phone, student_phone, fee_override, exempt, notes, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (data as Student) || null;
  }

  async create(tenantId: string | undefined, student: Partial<Student>): Promise<Student> {
    const payload: Record<string, unknown> = {
      ...student,
      tenant_id: tenantId,
    };

    const { data, error } = await this.client
      .from("students")
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data as Student;
  }

  async update(id: string, data: UpdateStudentDTO): Promise<Student | null> {
    const updatePayload: Record<string, unknown> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.parent_phone !== undefined) updatePayload.parent_phone = data.parent_phone;
    if (data.student_phone !== undefined) updatePayload.student_phone = data.student_phone;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.code !== undefined) updatePayload.code = data.code;
    if (data.fee_override !== undefined) updatePayload.fee_override = data.fee_override;
    if (data.exempt !== undefined) updatePayload.exempt = data.exempt;

    const { data: updated, error } = await this.client
      .from("students")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (updated as Student) || null;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("students").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async getHighestSerialCode(tenantId?: string): Promise<number> {
    let q = this.client.from("students").select("student_code, code");
    if (tenantId) {
      q = q.eq("tenant_id", tenantId);
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(error.message);
    }

    let nextSerial = 1001;
    if (data && data.length > 0) {
      for (const s of data as Array<{ student_code?: string | null; code?: string | null }>) {
        const rawCode = s.student_code || s.code;
        if (rawCode) {
          const num = parseInt(rawCode, 10);
          if (!isNaN(num) && num >= nextSerial) {
            nextSerial = num + 1;
          }
        }
      }
    }

    return nextSerial;
  }

  async findGroupById(groupId: string): Promise<GroupRecord | null> {
    const { data, error } = await this.client
      .from("groups")
      .select("id, name, tenant_id")
      .eq("id", groupId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (data as GroupRecord) || null;
  }

  async enrollStudentInGroup(
    tenantId: string | undefined,
    studentId: string,
    groupId: string
  ): Promise<void> {
    const { error } = await this.client.from("group_students").insert({
      tenant_id: tenantId,
      student_id: studentId,
      group_id: groupId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export class FakeStudentsRepository implements IStudentsRepository {
  public students: Student[] = [];
  public groups: GroupRecord[] = [];
  public groupEnrollments: Array<{ tenant_id?: string; student_id: string; group_id: string }> = [];

  async list(tenantId?: string, query?: string): Promise<Student[]> {
    let list = this.students;
    if (tenantId) {
      list = list.filter((s) => s.tenant_id === tenantId);
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q)) ||
          (s.student_code && s.student_code.toLowerCase().includes(q)) ||
          s.parent_phone.includes(q) ||
          (s.student_phone && s.student_phone.includes(q))
      );
    }
    return [...list];
  }

  async findById(id: string): Promise<Student | null> {
    const student = this.students.find((s) => s.id === id);
    return student ? { ...student } : null;
  }

  async create(tenantId: string | undefined, student: Partial<Student>): Promise<Student> {
    const newStudent: Student = {
      id: student.id || `std-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId || "tenant-default",
      name: student.name || "",
      parent_phone: student.parent_phone || "",
      student_phone: student.student_phone || null,
      code: student.code || student.student_code || null,
      student_code: student.student_code || student.code || null,
      fee_override: student.fee_override ?? null,
      exempt: student.exempt ?? false,
      notes: student.notes || null,
      created_at: student.created_at || new Date().toISOString(),
    };
    this.students.push(newStudent);
    return { ...newStudent };
  }

  async update(id: string, data: UpdateStudentDTO): Promise<Student | null> {
    const idx = this.students.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const existing = this.students[idx];
    const updated: Student = {
      ...existing,
      ...data,
      student_code: data.code !== undefined ? data.code : existing.student_code,
    };
    this.students[idx] = updated;
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.students = this.students.filter((s) => s.id !== id);
    this.groupEnrollments = this.groupEnrollments.filter((e) => e.student_id !== id);
  }

  async getHighestSerialCode(tenantId?: string): Promise<number> {
    let nextSerial = 1001;
    const targetStudents = tenantId
      ? this.students.filter((s) => s.tenant_id === tenantId)
      : this.students;

    for (const s of targetStudents) {
      const rawCode = s.student_code || s.code;
      if (rawCode) {
        const num = parseInt(rawCode, 10);
        if (!isNaN(num) && num >= nextSerial) {
          nextSerial = num + 1;
        }
      }
    }
    return nextSerial;
  }

  async findGroupById(groupId: string): Promise<GroupRecord | null> {
    const group = this.groups.find((g) => g.id === groupId);
    return group ? { ...group } : null;
  }

  async enrollStudentInGroup(
    tenantId: string | undefined,
    studentId: string,
    groupId: string
  ): Promise<void> {
    this.groupEnrollments.push({
      tenant_id: tenantId,
      student_id: studentId,
      group_id: groupId,
    });
  }
}
