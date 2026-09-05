import {
  ISessionsRepository,
  CreateSessionInput,
  SessionModel,
  CancelSessionInput,
  RescheduleSessionInput,
  CreateExtraSessionInput,
  SessionActionResult,
  GroupFinancialData,
  AttendeeFinancialData,
  FinancialSummaryResult,
  FinancialBreakdownItem,
  ReceiptOptions,
  ReceiptResult,
  QuizScoreRecord,
} from "./types.js";

export class SessionsService {
  constructor(private readonly repository: ISessionsRepository) {}

  async createSession(tenantId: string, input: CreateSessionInput): Promise<SessionModel> {
    return this.repository.createSession(tenantId, input);
  }

  async endSession(
    tenantId: string,
    sessionId: string
  ): Promise<{
    session: SessionModel;
    status: string;
    ended_at: string;
    message: string;
  }> {
    const sessionData = await this.repository.getSessionWithGroup(sessionId);
    if (!sessionData) {
      throw new Error("SESSION_NOT_FOUND");
    }
    const endedAt = new Date().toISOString();
    const updated = await this.repository.updateSessionStatus(sessionId, "ended", endedAt);
    return {
      session: updated,
      status: "ended",
      ended_at: endedAt,
      message: "Session ended successfully. Attendance finalized.",
    };
  }

  /**
   * DEV-50: Cancel a scheduled or in-progress session.
   * Updates status to 'cancelled', records reason, and dispatches Arabic WhatsApp notice to group parents.
   */
  async cancelSession(
    tenantId: string,
    sessionId: string,
    input: CancelSessionInput
  ): Promise<SessionActionResult> {
    const sessionData = await this.repository.getSessionWithGroup(sessionId);
    if (!sessionData) {
      throw new Error("SESSION_NOT_FOUND");
    }

    const cancelledSession = await this.repository.cancelSession(sessionId, input.reason);
    let dispatchedCount = 0;

    if (input.notify_parents !== false) {
      const groupName = sessionData.group.name || "المجموعة";
      const sessionDate = sessionData.session.session_date;
      const noticeBody = [
        "⚠️ *إلغاء حصة* ⚠️",
        "━━━━━━━━━━━━━━━━━━━━━",
        `أولياء الأمور الكرام، نود إحاطتكم بأنه تم إلغاء حصة *${groupName}* المقررة بتاريخ ${sessionDate}.`,
        input.reason ? `📌 *السبب:* ${input.reason}` : null,
        "━━━━━━━━━━━━━━━━━━━━━",
        "_نعتذر عن أي إزعاج ونوافيكم بالموعد البديل لاحقاً._",
      ]
        .filter(Boolean)
        .join("\n");

      const students = await this.repository.getStudentsForGroup(sessionData.session.group_id);
      for (const student of students) {
        if (student.parent_phone && student.parent_phone.trim().length >= 9) {
          const idempotencyKey = `cancel:${tenantId}:${sessionId}:${student.id}`;
          await this.repository.logSessionActionNotification(
            tenantId,
            idempotencyKey,
            student.parent_phone,
            "session_cancelled",
            noticeBody
          );
          dispatchedCount += 1;
        }
      }
    }

    return {
      session: cancelledSession,
      action: "cancelled",
      notifications_dispatched: dispatchedCount,
      message: `Session cancelled successfully. Dispatched ${dispatchedCount} WhatsApp parent notifications.`,
      details: {
        cancellation_reason: input.reason,
      },
    };
  }

  /**
   * DEV-50: Reschedule a session to a new date/time.
   * Updates status to 'rescheduled', records new date/time and reason, and dispatches Arabic WhatsApp notice.
   */
  async rescheduleSession(
    tenantId: string,
    sessionId: string,
    input: RescheduleSessionInput
  ): Promise<SessionActionResult> {
    const sessionData = await this.repository.getSessionWithGroup(sessionId);
    if (!sessionData) {
      throw new Error("SESSION_NOT_FOUND");
    }

    const rescheduledSession = await this.repository.rescheduleSession(
      sessionId,
      input.new_date,
      input.new_time,
      input.reason
    );
    let dispatchedCount = 0;

    if (input.notify_parents !== false) {
      const groupName = sessionData.group.name || "المجموعة";
      const oldDate = sessionData.session.session_date;
      const timeStr = input.new_time ? ` الساعة ${input.new_time}` : "";
      const noticeBody = [
        "📅 *تعديل موعد حصة* 📅",
        "━━━━━━━━━━━━━━━━━━━━━",
        `أولياء الأمور الكرام، تم تعديل موعد حصة *${groupName}* (المقررة أصلاً في ${oldDate}).`,
        `⏰ *الموعد الجديد:* يوم ${input.new_date}${timeStr}`,
        input.reason ? `📌 *السبب:* ${input.reason}` : null,
        "━━━━━━━━━━━━━━━━━━━━━",
        "_يرجى التنبيه على الطالب بالحضور في الموعد الجديد._",
      ]
        .filter(Boolean)
        .join("\n");

      const students = await this.repository.getStudentsForGroup(sessionData.session.group_id);
      for (const student of students) {
        if (student.parent_phone && student.parent_phone.trim().length >= 9) {
          const idempotencyKey = `reschedule:${tenantId}:${sessionId}:${student.id}:${input.new_date}`;
          await this.repository.logSessionActionNotification(
            tenantId,
            idempotencyKey,
            student.parent_phone,
            "session_rescheduled",
            noticeBody
          );
          dispatchedCount += 1;
        }
      }
    }

    return {
      session: rescheduledSession,
      action: "rescheduled",
      notifications_dispatched: dispatchedCount,
      message: `Session rescheduled successfully. Dispatched ${dispatchedCount} WhatsApp parent notifications.`,
      details: {
        new_date: input.new_date,
        new_time: input.new_time,
        cancellation_reason: input.reason,
      },
    };
  }

  /**
   * DEV-50: Add an extra / make-up session outside the normal schedule.
   * Creates session record with is_extra=true, status='scheduled', and notifies parents.
   */
  async createExtraSession(
    tenantId: string,
    input: CreateExtraSessionInput
  ): Promise<SessionActionResult> {
    const nextSessionNumber = await this.repository.getNextSessionNumber(input.group_id);
    const extraSession = await this.repository.createExtraSession(
      tenantId,
      input,
      nextSessionNumber
    );

    let dispatchedCount = 0;

    if (input.notify_parents !== false) {
      const sessionWithGroup = await this.repository.getSessionWithGroup(extraSession.id);
      const groupName = sessionWithGroup?.group.name || "المجموعة";
      const timeStr = input.session_time ? ` الساعة ${input.session_time}` : "";
      const noticeBody = [
        "📢 *حصة إضافية / تعويضية* 📢",
        "━━━━━━━━━━━━━━━━━━━━━",
        `أولياء الأمور الكرام، تم تحديد موعد لحصة إضافية لمجموعة *${groupName}*.`,
        `📅 *التاريخ:* ${input.session_date}${timeStr}`,
        input.topic ? `📖 *الموضوع:* ${input.topic}` : null,
        "━━━━━━━━━━━━━━━━━━━━━",
        "_حضور الطالب ضروري ومهم للاستفادة._",
      ]
        .filter(Boolean)
        .join("\n");

      const students = await this.repository.getStudentsForGroup(input.group_id);
      for (const student of students) {
        if (student.parent_phone && student.parent_phone.trim().length >= 9) {
          const idempotencyKey = `extra:${tenantId}:${extraSession.id}:${student.id}`;
          await this.repository.logSessionActionNotification(
            tenantId,
            idempotencyKey,
            student.parent_phone,
            "extra_session",
            noticeBody
          );
          dispatchedCount += 1;
        }
      }
    }

    return {
      session: extraSession,
      action: "extra",
      notifications_dispatched: dispatchedCount,
      message: `Extra session scheduled successfully. Dispatched ${dispatchedCount} WhatsApp parent notifications.`,
      details: {
        new_date: input.session_date,
        new_time: input.session_time,
        extra_topic: input.topic,
      },
    };
  }

  /**
   * DEV-56: Query sessions in date range for the teacher calendar.
   */
  async getCalendarSessions(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): Promise<SessionModel[]> {
    return this.repository.getSessionsByDateRange(tenantId, fromDate, toDate);
  }

  async getSessionDetails(sessionId: string): Promise<{
    session: SessionModel;
    attendance: unknown[];
    quiz_scores: unknown[];
  }> {
    const data = await this.repository.getSessionWithDetails(sessionId);
    if (!data) {
      throw new Error("SESSION_NOT_FOUND");
    }
    return data;
  }

  async saveQuizScore(
    tenantId: string,
    sessionId: string,
    studentId: string,
    score: number,
    maxScore: number
  ): Promise<QuizScoreRecord> {
    return this.repository.upsertQuizScore(tenantId, sessionId, studentId, score, maxScore);
  }

  async listQuizScores(sessionId: string): Promise<QuizScoreRecord[]> {
    return this.repository.getQuizScoresForSession(sessionId);
  }

  /**
   * Pure domain calculation for session financials.
   * Handles exemptions, fee overrides, makeup tracking, and totals.
   */
  calculateFinancialSummary(
    sessionId: string,
    group: GroupFinancialData,
    attendees: AttendeeFinancialData[]
  ): FinancialSummaryResult {
    const basePrice = Number(group.price) || 0;
    let totalRevenue = 0;
    let exemptCount = 0;
    let overriddenCount = 0;
    let regularCount = 0;
    let makeupCount = 0;

    const breakdown: FinancialBreakdownItem[] = attendees.map((att) => {
      const student = att.students;
      let feeCharged = basePrice;
      let pricingType = "regular";

      if (att.is_makeup) {
        makeupCount += 1;
      }

      if (student?.exempt) {
        feeCharged = 0;
        pricingType = "exempt";
        exemptCount += 1;
      } else if (student?.fee_override != null && student.fee_override !== undefined) {
        feeCharged = Number(student.fee_override);
        pricingType = "override";
        overriddenCount += 1;
      } else {
        regularCount += 1;
      }

      totalRevenue += feeCharged;

      return {
        student_id: student?.id,
        student_name: student?.name,
        is_makeup: att.is_makeup,
        home_group_id: att.home_group_id,
        pricing_type: pricingType,
        fee_charged: feeCharged,
      };
    });

    return {
      session_id: sessionId,
      group: {
        id: group.id,
        name: group.name,
        base_price: basePrice,
        billing_model: group.billing_model,
        fixed_rent_amount: group.fixed_rent_amount,
      },
      financials: {
        total_revenue: totalRevenue,
        attendee_count: attendees.length,
        regular_count: regularCount,
        exempt_count: exemptCount,
        overridden_count: overriddenCount,
        makeup_count: makeupCount,
      },
      breakdown,
    };
  }

  async getFinancialSummary(sessionId: string): Promise<FinancialSummaryResult> {
    const sessionData = await this.repository.getSessionWithGroup(sessionId);
    if (!sessionData) {
      throw new Error("SESSION_NOT_FOUND");
    }

    const attendees = await this.repository.getAttendedStudentsForSession(sessionId);
    return this.calculateFinancialSummary(sessionId, sessionData.group, attendees);
  }

  /**
   * Generates Arabic settlement receipt and calculates teacher/center splits.
   */
  async generateReceipt(
    tenantId: string,
    sessionId: string,
    options: ReceiptOptions
  ): Promise<ReceiptResult> {
    const sessionData = await this.repository.getSessionWithGroup(sessionId);
    if (!sessionData) {
      throw new Error("SESSION_NOT_FOUND");
    }

    const { session, group } = sessionData;
    const basePrice = Number(group.price) || 0;
    const allAttendance = await this.repository.getAllAttendanceWithStudents(sessionId);

    let totalRevenue = 0;
    let presentCount = 0;
    let absentCount = 0;
    let exemptCount = 0;
    let makeupCount = 0;

    for (const att of allAttendance) {
      if (att.attended) {
        presentCount += 1;
        const s = att.students;
        if (att.is_makeup) makeupCount += 1;

        if (s?.exempt) {
          exemptCount += 1;
        } else if (s?.fee_override != null) {
          totalRevenue += Number(s.fee_override);
        } else {
          totalRevenue += basePrice;
        }
      } else {
        absentCount += 1;
      }
    }

    // Compute center and teacher revenue shares
    let centerShare = 0;
    let teacherShare = totalRevenue;

    if (group.billing_model === "fixed_rent" && group.fixed_rent_amount) {
      centerShare = Math.min(Number(group.fixed_rent_amount), totalRevenue);
      teacherShare = totalRevenue - centerShare;
    } else if (group.billing_model === "percentage") {
      centerShare = Math.round(totalRevenue * 0.2);
      teacherShare = totalRevenue - centerShare;
    }

    const formattedReceipt = [
      "🧾 *إيصال تصفية الحصة / Session Settlement Receipt*",
      "━━━━━━━━━━━━━━━━━━━━━",
      `🏫 *المجموعة:* ${group.name || ""}`,
      group.center_name ? `📍 *السنتر:* ${group.center_name}` : null,
      `📅 *التاريخ:* ${session.session_date} | *حصة رقم:* ${session.session_number}`,
      `👥 *إجمالي الحضور:* ${presentCount} طالب (منهم ${exemptCount} منحة / معفي)`,
      `❌ *إجمالي الغياب:* ${absentCount} طالب`,
      makeupCount > 0 ? `🔄 *طلاب التعويض:* ${makeupCount} طالب` : null,
      "━━━━━━━━━━━━━━━━━━━━━",
      `💵 *إجمالي النقدية المحصلة:* ${totalRevenue} ج.م`,
      `🏢 *حصة السنتر:* ${centerShare} ج.م`,
      `👨‍🏫 *صافي المعلم:* ${teacherShare} ج.م`,
      "━━━━━━━━━━━━━━━━━━━━━",
      `_تم الاستخراج آلياً بتاريخ ${new Date().toLocaleDateString("ar-EG")}_`,
    ]
      .filter(Boolean)
      .join("\n");

    let loggedMessageId: string | null = null;
    if (options.send_via_whatsapp && options.recipient_phone) {
      const idempotencyKey = `receipt:${tenantId}:${sessionId}:${Date.now()}`;
      loggedMessageId = await this.repository.logReceiptMessage(
        tenantId,
        idempotencyKey,
        options.recipient_type || "teacher",
        options.recipient_phone,
        formattedReceipt
      );
    }

    return {
      message: "Session receipt generated successfully",
      formatted_receipt: formattedReceipt,
      summary: {
        session_id: sessionId,
        group_name: group.name,
        present_count: presentCount,
        absent_count: absentCount,
        exempt_count: exemptCount,
        makeup_count: makeupCount,
        total_revenue: totalRevenue,
        center_share: centerShare,
        teacher_share: teacherShare,
      },
      logged_message_id: loggedMessageId,
    };
  }
}
