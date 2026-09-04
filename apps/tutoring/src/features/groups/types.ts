export interface Group {
  id: string;
  tenant_id: string;
  name: string;
  price?: number;
  billing_model?: "percentage" | "fixed_rent" | string;
  fixed_rent_amount?: number | null;
  center_name?: string | null;
  created_at?: string;
}

export interface EnrolledStudent {
  id: string;
  name: string;
  parent_phone: string;
  student_phone?: string | null;
  student_code?: string | null;
  fee_override?: number | null;
  exempt?: boolean;
}

export interface CreateGroupDTO {
  name: string;
  price?: number;
  billing_model?: "percentage" | "fixed_rent" | string;
  fixed_rent_amount?: number | null;
  center_name?: string | null;
}

export interface UpdateGroupDTO {
  name?: string;
  price?: number;
  billing_model?: "percentage" | "fixed_rent" | string;
  fixed_rent_amount?: number | null;
  center_name?: string | null;
}

export interface IGroupsRepository {
  list(tenantId?: string): Promise<Group[]>;
  findById(id: string): Promise<Group | null>;
  create(tenantId: string | undefined, data: CreateGroupDTO): Promise<Group>;
  update(id: string, data: UpdateGroupDTO): Promise<Group | null>;
  delete(id: string): Promise<void>;
  getEnrolledStudents(groupId: string): Promise<EnrolledStudent[]>;
  enrollStudent(tenantId: string | undefined, groupId: string, studentId: string): Promise<{ id: string; group_id: string; student_id: string }>;
  removeStudent(groupId: string, studentId: string): Promise<void>;
}
