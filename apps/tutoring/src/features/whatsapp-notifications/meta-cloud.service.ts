/**
 * ============================================================================
 * Meta WhatsApp Cloud API Service (Central Platform Number)
 * ============================================================================
 * Architecture Rule 1 & Rule 2:
 * - Domain layer has ZERO direct database imports.
 * - Communicates with data store exclusively through IMetaPortalQueueRepository.
 * - Communicates with Meta Graph API through IMetaCloudGateway.
 * - Dedicated exclusively to bulk new-student onboarding portal links.
 * ============================================================================
 */

import { IMetaCloudGateway, MetaTemplateSendResult } from "./meta-cloud.gateway.js";
import { IMetaPortalQueueRepository, MetaQueueItem } from "./meta-portal-queue.repository.js";

export interface BatchPortalStudentItem {
  student_id: string;
  student_name: string;
  student_phone?: string | null;
  parent_phone?: string | null;
  subject_name?: string | null;
  teacher_name?: string | null;
}

export interface BatchPortalDispatchOptions {
  tenant_id: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  subject_name?: string | null;
  students: BatchPortalStudentItem[];
  pacingDelayMs?: number;
}

export interface BatchPortalDispatchResult {
  total_students: number;
  total_messages: number;
  sent_today: number;
  queued_tomorrow: number;
  daily_limit: number;
  remaining_today: number;
  is_template_pending: boolean;
  message: string;
}

export class MetaCloudService {
  constructor(
    private readonly repository: IMetaPortalQueueRepository,
    private readonly gateway: IMetaCloudGateway,
    private readonly dailyLimit: number = 250
  ) {}

  /**
   * Normalizes an Egyptian or international phone number for Meta Cloud API (E.164 without '+').
   * Examples:
   *  "01012345678" -> "201012345678"
   *  "+201012345678" -> "201012345678"
   *  "201012345678" -> "201012345678"
   */
  normalizeForMeta(phone?: string | null): string {
    if (!phone) return "";
    let clean = phone.trim().replace(/[\s\-().+]/g, "");

    // Convert Arabic-Indic digits
    const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    for (let i = 0; i < 10; i++) {
      clean = clean.replaceAll(arabicDigits[i], String(i));
    }

    if (clean.startsWith("00")) {
      clean = clean.slice(2);
    }

    // Egyptian phone conversion: "010..." -> "2010..."
    if (clean.startsWith("01") && clean.length === 11) {
      return "20" + clean.slice(1);
    }

    // Already has Egyptian country code: "201..."
    if (clean.startsWith("201") && clean.length === 12) {
      return clean;
    }

    return clean;
  }

  /**
   * Retrieves platform-wide and tenant-specific quota statistics.
   */
  async getQuotaStatus(tenantId?: string): Promise<{
    dailyLimit: number;
    sentToday: number;
    remainingToday: number;
    queuedPending: number;
    tenantStats?: { sentToday: number; pendingQueue: number; totalSent: number };
  }> {
    const sentToday = await this.repository.getTodaySentCount();
    const remainingToday = Math.max(0, this.dailyLimit - sentToday);

    let tenantStats;
    if (tenantId) {
      tenantStats = await this.repository.getTenantStats(tenantId);
    }

    return {
      dailyLimit: this.dailyLimit,
      sentToday,
      remainingToday,
      queuedPending: tenantStats ? tenantStats.pendingQueue : 0,
      tenantStats,
    };
  }

  /**
   * Dispatches bulk onboarding portal links via Meta Cloud API with multi-tenant FIFO quota management.
   */
  async dispatchBatchPortalLinks(options: BatchPortalDispatchOptions): Promise<BatchPortalDispatchResult> {
    const { tenant_id, teacher_id, students, pacingDelayMs = 200 } = options;
    const teacherName = options.teacher_name || "المعلم";
    const subjectName = options.subject_name || "المادة الدراسية";

    if (!students || students.length === 0) {
      return {
        total_students: 0,
        total_messages: 0,
        sent_today: 0,
        queued_tomorrow: 0,
        daily_limit: this.dailyLimit,
        remaining_today: this.dailyLimit,
        is_template_pending: false,
        message: "لا يوجد طلاب محددون للإرسال.",
      };
    }

    // 1. Build flat list of message items (one for student, one for parent)
    const itemsToEnqueue: MetaQueueItem[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);

    for (const s of students) {
      const sPhone = this.normalizeForMeta(s.student_phone);
      const pPhone = this.normalizeForMeta(s.parent_phone);

      if (sPhone) {
        itemsToEnqueue.push({
          tenant_id,
          teacher_id: teacher_id || null,
          student_id: s.student_id,
          recipient_type: "student",
          recipient_phone: sPhone,
          template_name: "centerly",
          language_code: "en",
          parameters: [s.student_name, subjectName, teacherName],
          status: "pending",
          scheduled_date: today,
        });
      }

      if (pPhone) {
        itemsToEnqueue.push({
          tenant_id,
          teacher_id: teacher_id || null,
          student_id: s.student_id,
          recipient_type: "parent",
          recipient_phone: pPhone,
          template_name: "centerly_student",
          language_code: "en",
          parameters: [s.student_name, subjectName, teacherName],
          status: "pending",
          scheduled_date: today,
        });
      }
    }

    if (itemsToEnqueue.length === 0) {
      return {
        total_students: students.length,
        total_messages: 0,
        sent_today: 0,
        queued_tomorrow: 0,
        daily_limit: this.dailyLimit,
        remaining_today: this.dailyLimit,
        is_template_pending: false,
        message: "لم يتم العثور على أرقام هواتف صالحة للطلاب أو أولياء الأمور.",
      };
    }

    // 2. Multi-tenant FIFO Quota allocation
    const sentTodayCount = await this.repository.getTodaySentCount();
    const remainingQuota = Math.max(0, this.dailyLimit - sentTodayCount);

    const immediateItems: MetaQueueItem[] = [];
    const queuedItems: MetaQueueItem[] = [];

    for (let i = 0; i < itemsToEnqueue.length; i++) {
      const item = itemsToEnqueue[i];
      if (i < remainingQuota) {
        item.scheduled_date = today;
        item.status = "pending";
        immediateItems.push(item);
      } else {
        item.scheduled_date = tomorrow;
        item.status = "queued";
        queuedItems.push(item);
      }
    }

    // 3. Persist all in queue database
    const enqueued = await this.repository.enqueueItems([...immediateItems, ...queuedItems]);

    // 4. Check Meta Template status
    const statuses = await this.gateway.getTemplateStatuses();
    const isStudentPending = statuses["centerly"] === "PENDING";
    const isParentPending = statuses["centerly_student"] === "PENDING";
    const isTemplatePending = isStudentPending || isParentPending;

    // 5. If templates are pending review, keep as pending and inform user
    if (isTemplatePending) {
      const queuedCount = enqueued.length;
      return {
        total_students: students.length,
        total_messages: enqueued.length,
        sent_today: 0,
        queued_tomorrow: queuedCount,
        daily_limit: this.dailyLimit,
        remaining_today: remainingQuota,
        is_template_pending: true,
        message: `تم حفظ (${enqueued.length}) رسالة بنجاح في طابور سنترلي الرسمي. القوالب قيد المراجعة حالياً من ميتا (Pending) وسيتم إرسالها للطلاب وأولياء الأمور تلقائياً فور اعتماد فيسبوك.`,
      };
    }

    // 6. Asynchronously execute immediate items with pacing
    const immediateEnqueued = enqueued.filter((it) => it.scheduled_date === today && it.status === "pending");
    this.executeBatchAsync(immediateEnqueued, pacingDelayMs).catch(() => {});

    const remainingAfterDispatch = Math.max(0, remainingQuota - immediateEnqueued.length);
    const sentCount = immediateEnqueued.length;
    const queuedCount = queuedItems.length;

    let userMessage = "";
    if (sentCount > 0 && queuedCount === 0) {
      userMessage = `تم بنجاح إرسال روابط المنصة لـ (${sentCount}) رسالة عبر واتساب سنترلي الرسمي!`;
    } else if (sentCount > 0 && queuedCount > 0) {
      userMessage = `تم بنجاح إرسال (${sentCount}) رسالة اليوم عبر رقم سنترلي الرسمي. وتم جدولة (${queuedCount}) رسالة تلقائياً للغد نظراً لاكتمال الكوتا اليومية (${this.dailyLimit} رسالة).`;
    } else {
      userMessage = `اكتملت حصة الإرسال اليومية (${this.dailyLimit}/${this.dailyLimit}). تم جدولة إرسال الـ (${queuedCount}) رسالة بالكامل للغد تلقائياً.`;
    }

    return {
      total_students: students.length,
      total_messages: enqueued.length,
      sent_today: sentCount,
      queued_tomorrow: queuedCount,
      daily_limit: this.dailyLimit,
      remaining_today: remainingAfterDispatch,
      is_template_pending: false,
      message: userMessage,
    };
  }

  /**
   * Asynchronous pacing dispatcher for immediate items
   */
  private async executeBatchAsync(items: MetaQueueItem[], pacingDelayMs: number): Promise<void> {
    const nowIso = new Date().toISOString();

    for (const item of items) {
      if (!item.id) continue;

      try {
        const sendRes: MetaTemplateSendResult = await this.gateway.sendTemplate({
          to: item.recipient_phone,
          templateName: item.template_name,
          languageCode: item.language_code || "en",
          bodyParameters: item.parameters || [],
        });

        if (sendRes.success) {
          await this.repository.updateItemStatus(item.id, {
            status: "sent",
            meta_message_id: sendRes.messageId || null,
            sent_at: nowIso,
          });

          await this.repository.updateStudentPortalSentAt(item.student_id, item.recipient_type, nowIso);
        } else {
          await this.repository.updateItemStatus(item.id, {
            status: sendRes.isPendingApproval ? "pending" : "failed",
            error_message: sendRes.error || "Meta dispatch failure",
          });
        }
      } catch (err: any) {
        await this.repository.updateItemStatus(item.id, {
          status: "failed",
          error_message: err.message || "Unknown error during Meta dispatch",
        });
      }

      if (pacingDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pacingDelayMs));
      }
    }
  }

  /**
   * Processes queued items whose scheduled_date <= today.
   * Can be invoked by a daily cron job.
   */
  async processScheduledQueue(): Promise<{ processed: number; sent: number; failed: number }> {
    const today = new Date().toISOString().slice(0, 10);
    const sentTodayCount = await this.repository.getTodaySentCount();
    const remainingQuota = Math.max(0, this.dailyLimit - sentTodayCount);

    if (remainingQuota <= 0) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    const pendingItems = await this.repository.getPendingItemsForDate(today, remainingQuota);
    if (pendingItems.length === 0) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const nowIso = new Date().toISOString();

    for (const item of pendingItems) {
      if (!item.id) continue;

      try {
        const res = await this.gateway.sendTemplate({
          to: item.recipient_phone,
          templateName: item.template_name,
          languageCode: item.language_code || "en",
          bodyParameters: item.parameters || [],
        });

        if (res.success) {
          sent++;
          await this.repository.updateItemStatus(item.id, {
            status: "sent",
            meta_message_id: res.messageId || null,
            sent_at: nowIso,
          });
          await this.repository.updateStudentPortalSentAt(item.student_id, item.recipient_type, nowIso);
        } else {
          failed++;
          await this.repository.updateItemStatus(item.id, {
            status: res.isPendingApproval ? "pending" : "failed",
            error_message: res.error || "Meta error",
          });
        }
      } catch (err: any) {
        failed++;
        await this.repository.updateItemStatus(item.id, {
          status: "failed",
          error_message: err.message || "Execution exception",
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { processed: pendingItems.length, sent, failed };
  }
}
