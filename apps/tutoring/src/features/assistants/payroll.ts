import type { SupabaseClient } from "@supabase/supabase-js";

export type PayModel = "monthly" | "per_session" | "per_day";
export interface PayAssistant {
  id?: string;
  status?: string | null;
  salary_model?: string | null;
  salary?: number | string | null;
  salary_amount?: number | string | null;
  group_id?: string | null;
  teacher_id?: string | null;
  work_weekdays?: number[] | null;
  pay_start_date?: string | null;
  access?: { all_groups: boolean; group_ids: string[] } | null;
}
export interface PaySession {
  id: string;
  group_id?: string | null;
  teacher_id?: string | null;
  session_date: string;
  status?: string | null;
}
export interface PayPeriod { month: number; year: number; from: string; to: string }

export function cairoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isPayDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function payPeriod(month?: unknown, year?: unknown, now = new Date()): PayPeriod {
  const today = cairoDate(now);
  const m = month === undefined ? Number(today.slice(5, 7)) : Number(month);
  const y = year === undefined ? Number(today.slice(0, 4)) : Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2000 || y > 9999) {
    throw new Error("اختر شهرًا وسنة صحيحين لحساب المستحقات");
  }
  const prefix = `${y}-${String(m).padStart(2, "0")}`;
  return { month: m, year: y, from: `${prefix}-01`, to: `${prefix}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}` };
}

/** Sunday = 0, Saturday = 6. Count calendar dates, never 24-hour intervals in Cairo (DST). */
export function scheduledDays(period: PayPeriod, weekdays: number[], start: string): number {
  const wanted = new Set(weekdays);
  let count = 0;
  for (let d = 1; d <= Number(period.to.slice(-2)); d++) {
    const date = `${period.from.slice(0, 8)}${String(d).padStart(2, "0")}`;
    if (date >= start && wanted.has(new Date(`${date}T00:00:00Z`).getUTCDay())) count++;
  }
  return count;
}

export function validatePay(body: Record<string, unknown>, previous?: PayAssistant) {
  const model = body.salary_model ?? previous?.salary_model ?? "monthly";
  if (!["monthly", "per_session", "per_day"].includes(String(model))) throw new Error("نظام المحاسبة غير صحيح");
  const raw = body.salary ?? body.salary_amount ?? previous?.salary ?? 0;
  if ((typeof raw !== "string" && typeof raw !== "number") || String(raw).trim() === "") throw new Error("أدخل قيمة أجر صحيحة");
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100000000 || Math.abs(rate * 100 - Math.round(rate * 100)) > 0.00001) {
    throw new Error("أدخل أجرًا من صفر إلى ١٠٠ مليون، بحد أقصى منزلتين عشريتين");
  }
  const weekdays = body.work_weekdays ?? previous?.work_weekdays ?? [];
  if (!Array.isArray(weekdays) || weekdays.length > 7 || weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(weekdays).size !== weekdays.length) {
    throw new Error("أيام العمل غير صحيحة");
  }
  const start = body.pay_start_date === undefined ? previous?.pay_start_date ?? null : body.pay_start_date;
  if (start !== null && (!isPayDate(start) || start < "2000-01-01")) throw new Error("تاريخ بداية العمل غير صحيح");
  if (model === "per_day" && (weekdays.length === 0 || !start)) throw new Error("اختر أيام العمل وتاريخ بدايته لحساب الأجر اليومي تلقائيًا");
  return { salary_model: model as PayModel, salary: rate, work_weekdays: [...weekdays].sort(), pay_start_date: start as string | null };
}

/** An estimate for the selected month, not a payment ledger or an attendance claim. */
export function calculatePay(assistant: PayAssistant, period: PayPeriod, sessions: PaySession[] = []) {
  const model = assistant.salary_model || "monthly";
  const rate = Number(assistant.salary ?? assistant.salary_amount ?? 0);
  const active = !assistant.status || ["active", "invited"].includes(assistant.status);
  const start = assistant.pay_start_date || period.from;
  let units = 0;
  let basis = "monthly_fixed";
  if (active && start <= period.to) {
    if (model === "per_day") {
      basis = "scheduled_days";
      units = isPayDate(start) ? scheduledDays(period, assistant.work_weekdays || [], start) : 0;
    } else if (model === "per_session") {
      basis = "ended_sessions";
      const unique = new Set<string>();
      for (const s of sessions) {
        if (s.status !== "ended" || s.session_date < period.from || s.session_date > period.to || s.session_date < start) continue;
        if (assistant.access) {
          if (!assistant.access.all_groups && !assistant.access.group_ids.includes(s.group_id || '')) continue;
        } else if (assistant.group_id && s.group_id !== assistant.group_id) continue;
        // Legacy teacher workspaces have tenant-owned sessions with teacher_id = null.
        if (assistant.teacher_id && s.teacher_id && s.teacher_id !== assistant.teacher_id) continue;
        unique.add(s.id);
      }
      units = unique.size;
    } else if (model === "monthly") units = 1;
  }
  if (model === "per_day") basis = "scheduled_days";
  if (model === "per_session") basis = "ended_sessions";
  return {
    month: period.month, year: period.year, basis, units,
    amount: Number.isFinite(rate) && rate >= 0 ? Math.round(rate * 100) * units / 100 : 0,
    from: start > period.from ? start : period.from, to: period.to,
  };
}

export async function attachPayroll(db: SupabaseClient, tenantId: string, assistants: PayAssistant[], period: PayPeriod) {
  const sessions: PaySession[] = [];
  // Paginate so large tenants do not silently lose sessions to the Data API's row cap.
  if (assistants.some(a => ["active", "invited"].includes(a.status || "active") && a.salary_model === "per_session")) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("sessions")
        .select("id,group_id,teacher_id,session_date,status")
        .eq("tenant_id", tenantId).eq("status", "ended")
        .gte("session_date", period.from).lte("session_date", period.to)
        .order("id").range(offset, offset + 499);
      if (error) throw error;
      sessions.push(...(data || []));
      if (!data || data.length < 500) break;
    }
  }
  return assistants.map(a => ({ ...a, payroll: calculatePay(a, period, sessions) }));
}
