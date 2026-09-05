export interface TelemetryEventInput {
  event_name: string;
  properties?: Record<string, unknown>;
  page_path?: string;
  session_id?: string;
  timestamp?: string;
}

export interface BatchTelemetryInput {
  events: TelemetryEventInput[];
}

export interface TelemetryRecord {
  id: string;
  tenant_id?: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  page_path?: string | null;
  session_id?: string | null;
  created_at: string;
}

export interface ITelemetryRepository {
  recordEvents(tenantId: string | null | undefined, events: TelemetryEventInput[]): Promise<number>;
  listRecentEvents(limit?: number): Promise<TelemetryRecord[]>;
}
