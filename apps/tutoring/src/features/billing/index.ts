import { BillingService } from "./service.js";
import { SupabaseBillingRepository } from "./repository.js";
import { getServiceSupabaseClient } from "../../supabase.js";
import { DispatchRemindersSummary } from "./types.js";

export * from "./types.js";
export * from "./service.js";
export * from "./repository.js";
export * from "./routes.js";

export async function dispatchSubscriptionRenewalReminders(): Promise<DispatchRemindersSummary> {
  const service = new BillingService(new SupabaseBillingRepository(getServiceSupabaseClient()));
  return service.evaluateAndDispatchReminders();
}
