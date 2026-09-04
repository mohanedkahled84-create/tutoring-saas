import { SupabaseClient } from "@supabase/supabase-js";
import {
  IWhatsAppNotificationsRepository,
  MessageTemplate,
  WhatsAppConnectionStatus,
} from "./types.js";

export class SupabaseWhatsAppNotificationsRepository implements IWhatsAppNotificationsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async isMessageDispatched(idempotencyKey: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from("message_logs")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      return Boolean(data);
    } catch {
      return false;
    }
  }

  async getTemplates(tenantId?: string): Promise<MessageTemplate[]> {
    let query = this.supabase
      .from("message_templates")
      .select("id, tenant_id, template_type, variants, is_active, created_at, updated_at");

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    return data as unknown as MessageTemplate[];
  }

  async upsertTemplate(template: {
    tenant_id: string;
    template_type: string;
    variants: unknown;
    is_active: boolean;
  }): Promise<MessageTemplate> {
    const { data, error } = await this.supabase
      .from("message_templates")
      .upsert(
        {
          tenant_id: template.tenant_id,
          template_type: template.template_type,
          variants: template.variants,
          is_active: template.is_active,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,template_type" }
      )
      .select()
      .single();

    if (error || !data) {
      throw new Error(error ? error.message : "Failed to save message template");
    }

    return data as unknown as MessageTemplate;
  }

  async getConnectionStatus(): Promise<WhatsAppConnectionStatus> {
    return {
      status: "connected",
      phone_number: "+201099887766",
      gateway: "Evolution API v2.1",
      latency_ms: 110,
      daily_quota: {
        used: 124,
        limit: 500,
        safety_score: "excellent",
      },
    };
  }
}
