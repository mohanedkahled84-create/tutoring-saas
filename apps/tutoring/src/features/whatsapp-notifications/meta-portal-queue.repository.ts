/**
 * ============================================================================
 * Meta Portal Queue Repository
 * ============================================================================
 * Architecture Rule 1 & Rule 8:
 * - Encapsulates all database operations for `meta_portal_dispatch_queue`.
 * - Enables in-memory unit tests with `FakeMetaPortalQueueRepository`.
 * ============================================================================
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface MetaQueueItem {
  id?: string;
  tenant_id: string;
  teacher_id?: string | null;
  student_id: string;
  recipient_type: "student" | "parent";
  recipient_phone: string;
  template_name: string;
  language_code?: string;
  parameters: string[];
  status: "pending" | "sent" | "failed" | "queued";
  scheduled_date: string; // YYYY-MM-DD
  meta_message_id?: string | null;
  error_message?: string | null;
  attempts?: number;
  sent_at?: string | null;
  created_at?: string;
}

export interface IMetaPortalQueueRepository {
  getTodaySentCount(): Promise<number>;
  getTenantStats(tenantId: string): Promise<{ sentToday: number; pendingQueue: number; totalSent: number }>;
  enqueueItems(items: MetaQueueItem[]): Promise<MetaQueueItem[]>;
  getPendingItemsForDate(date: string, limit?: number): Promise<MetaQueueItem[]>;
  updateItemStatus(
    id: string,
    updates: {
      status: "pending" | "sent" | "failed" | "queued";
      meta_message_id?: string | null;
      error_message?: string | null;
      sent_at?: string | null;
    }
  ): Promise<void>;
  updateStudentPortalSentAt(studentId: string, type: "student" | "parent", sentAt: string): Promise<void>;
}

export class SupabaseMetaPortalQueueRepository implements IMetaPortalQueueRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly privilegedClient?: SupabaseClient
  ) {}

  private get db(): SupabaseClient {
    return this.privilegedClient || this.client;
  }

  async getTodaySentCount(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const { count, error } = await this.db
        .from("meta_portal_dispatch_queue")
        .select("id", { count: "exact", head: true })
        .eq("scheduled_date", today)
        .eq("status", "sent");

      if (error) {
        return 0;
      }
      return count || 0;
    } catch {
      return 0;
    }
  }

  async getTenantStats(tenantId: string): Promise<{ sentToday: number; pendingQueue: number; totalSent: number }> {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [todayRes, pendingRes, totalRes] = await Promise.all([
        this.db
          .from("meta_portal_dispatch_queue")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("scheduled_date", today)
          .eq("status", "sent"),
        this.db
          .from("meta_portal_dispatch_queue")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["pending", "queued"]),
        this.db
          .from("meta_portal_dispatch_queue")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "sent"),
      ]);

      return {
        sentToday: todayRes.count || 0,
        pendingQueue: pendingRes.count || 0,
        totalSent: totalRes.count || 0,
      };
    } catch {
      return { sentToday: 0, pendingQueue: 0, totalSent: 0 };
    }
  }

  async enqueueItems(items: MetaQueueItem[]): Promise<MetaQueueItem[]> {
    if (items.length === 0) return [];

    try {
      const { data, error } = await this.db
        .from("meta_portal_dispatch_queue")
        .insert(
          items.map((it) => ({
            tenant_id: it.tenant_id,
            teacher_id: it.teacher_id || null,
            student_id: it.student_id,
            recipient_type: it.recipient_type,
            recipient_phone: it.recipient_phone,
            template_name: it.template_name,
            language_code: it.language_code || "en",
            parameters: it.parameters,
            status: it.status,
            scheduled_date: it.scheduled_date,
            meta_message_id: it.meta_message_id || null,
            error_message: it.error_message || null,
            sent_at: it.sent_at || null,
          }))
        )
        .select();

      if (error) {
        throw new Error(`Failed to enqueue items in meta_portal_dispatch_queue: ${error.message}`);
      }

      return (data || []) as MetaQueueItem[];
    } catch (err: any) {
      throw new Error(`Queue insert failed: ${err.message}`);
    }
  }

  async getPendingItemsForDate(date: string, limit = 100): Promise<MetaQueueItem[]> {
    try {
      const { data, error } = await this.db
        .from("meta_portal_dispatch_queue")
        .select("*")
        .eq("scheduled_date", date)
        .in("status", ["pending", "queued"])
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) return [];
      return (data || []) as MetaQueueItem[];
    } catch {
      return [];
    }
  }

  async updateItemStatus(
    id: string,
    updates: {
      status: "pending" | "sent" | "failed" | "queued";
      meta_message_id?: string | null;
      error_message?: string | null;
      sent_at?: string | null;
    }
  ): Promise<void> {
    try {
      await this.db
        .from("meta_portal_dispatch_queue")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    } catch (err) {
      // Non-blocking log
    }
  }

  async updateStudentPortalSentAt(studentId: string, type: "student" | "parent", sentAt: string): Promise<void> {
    try {
      const updatePayload: Record<string, string> = {};
      if (type === "parent") {
        updatePayload.parent_portal_sent_at = sentAt;
      } else {
        updatePayload.student_portal_sent_at = sentAt;
      }

      await this.db.from("students").update(updatePayload).eq("id", studentId);
    } catch {
      // Non-blocking update
    }
  }
}

export class FakeMetaPortalQueueRepository implements IMetaPortalQueueRepository {
  public items: MetaQueueItem[] = [];

  async getTodaySentCount(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    return this.items.filter((it) => it.scheduled_date === today && it.status === "sent").length;
  }

  async getTenantStats(tenantId: string): Promise<{ sentToday: number; pendingQueue: number; totalSent: number }> {
    const today = new Date().toISOString().slice(0, 10);
    const sentToday = this.items.filter(
      (it) => it.tenant_id === tenantId && it.scheduled_date === today && it.status === "sent"
    ).length;
    const pendingQueue = this.items.filter(
      (it) => it.tenant_id === tenantId && (it.status === "pending" || it.status === "queued")
    ).length;
    const totalSent = this.items.filter((it) => it.tenant_id === tenantId && it.status === "sent").length;

    return { sentToday, pendingQueue, totalSent };
  }

  async enqueueItems(items: MetaQueueItem[]): Promise<MetaQueueItem[]> {
    const created = items.map((it, idx) => ({
      ...it,
      id: it.id || `queue-item-${Date.now()}-${idx}`,
      created_at: it.created_at || new Date().toISOString(),
    }));
    this.items.push(...created);
    return created;
  }

  async getPendingItemsForDate(date: string, limit = 100): Promise<MetaQueueItem[]> {
    return this.items
      .filter((it) => it.scheduled_date === date && (it.status === "pending" || it.status === "queued"))
      .slice(0, limit);
  }

  async updateItemStatus(
    id: string,
    updates: {
      status: "pending" | "sent" | "failed" | "queued";
      meta_message_id?: string | null;
      error_message?: string | null;
      sent_at?: string | null;
    }
  ): Promise<void> {
    const item = this.items.find((it) => it.id === id);
    if (item) {
      item.status = updates.status;
      if (updates.meta_message_id !== undefined) item.meta_message_id = updates.meta_message_id;
      if (updates.error_message !== undefined) item.error_message = updates.error_message;
      if (updates.sent_at !== undefined) item.sent_at = updates.sent_at;
    }
  }

  async updateStudentPortalSentAt(_studentId: string, _type: "student" | "parent", _sentAt: string): Promise<void> {
    // In-memory stub
  }
}
