import { AttendanceWebhookPayload } from "./types.js";
import { WhatsAppNotificationsService } from "./service.js";
import { SupabaseWhatsAppNotificationsRepository } from "./repository.js";
import { supabasePublic } from "../../supabase.js";

export * from "./types.js";
export * from "./service.js";
export * from "./repository.js";
export * from "./routes.js";

// Convenience export for cross-feature notifications complying with Rule 4
const defaultService = new WhatsAppNotificationsService(
  new SupabaseWhatsAppNotificationsRepository(supabasePublic)
);

export async function dispatchAttendanceWebhook(payload: AttendanceWebhookPayload): Promise<boolean> {
  return defaultService.dispatchAttendanceWebhook(payload);
}
