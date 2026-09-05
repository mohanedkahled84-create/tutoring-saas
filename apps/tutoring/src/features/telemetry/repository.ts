import { SupabaseClient } from "@supabase/supabase-js";
import {
  TelemetryEventInput,
  TelemetryRecord,
  ITelemetryRepository,
} from "./types.js";

export class SupabaseTelemetryRepository implements ITelemetryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async recordEvents(
    tenantId: string | null | undefined,
    events: TelemetryEventInput[]
  ): Promise<number> {
    const rows = events.map((e) => ({
      tenant_id: tenantId || null,
      event_name: e.event_name,
      properties: e.properties || {},
      page_path: e.page_path || null,
      session_id: e.session_id || null,
      created_at: e.timestamp || new Date().toISOString(),
    }));

    const { error } = await this.client.from("telemetry_events").insert(rows);
    if (error) {
      throw new Error(`Failed to insert telemetry events: ${error.message}`);
    }
    return rows.length;
  }

  async listRecentEvents(limit = 50): Promise<TelemetryRecord[]> {
    const { data, error } = await this.client
      .from("telemetry_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }
    return (data as TelemetryRecord[]) || [];
  }
}

export class FakeTelemetryRepository implements ITelemetryRepository {
  public recorded: Array<TelemetryEventInput & { tenant_id?: string | null; id: string }> = [];

  async recordEvents(
    tenantId: string | null | undefined,
    events: TelemetryEventInput[]
  ): Promise<number> {
    for (const e of events) {
      this.recorded.push({
        ...e,
        tenant_id: tenantId,
        id: `tel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      });
    }
    return events.length;
  }

  async listRecentEvents(limit = 50): Promise<TelemetryRecord[]> {
    return this.recorded.slice(-limit).map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id || null,
      event_name: r.event_name,
      properties: r.properties || {},
      page_path: r.page_path || null,
      session_id: r.session_id || null,
      created_at: r.timestamp || new Date().toISOString(),
    }));
  }
}
