import { SupabaseClient } from "@supabase/supabase-js";
import { IQuizzesRepository, QuizRecord, QuizScoreItem } from "./types.js";

export class SupabaseQuizzesRepository implements IQuizzesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listQuizzes(tenantId: string, groupId?: string): Promise<QuizRecord[]> {
    let query = this.supabase
      .from("quizzes")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("quiz_number", { ascending: true });

    if (groupId) {
      query = query.eq("group_id", groupId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list quizzes: ${error.message}`);
    }
    return (data || []) as unknown as QuizRecord[];
  }

  async upsertQuiz(
    tenantId: string,
    quiz: {
      id?: string;
      group_id: string;
      quiz_number: number;
      title: string;
      max_score?: number;
      quiz_date?: string;
      is_skipped?: boolean;
    }
  ): Promise<QuizRecord> {
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      group_id: quiz.group_id,
      quiz_number: quiz.quiz_number,
      title: quiz.title || `كويز ${quiz.quiz_number}`,
      max_score: quiz.max_score ?? 10,
      quiz_date: quiz.quiz_date || new Date().toISOString().slice(0, 10),
      is_skipped: quiz.is_skipped ?? false,
      updated_at: new Date().toISOString(),
    };

    if (quiz.id && quiz.id.length > 20) {
      payload.id = quiz.id;
    }

    const { data, error } = await this.supabase
      .from("quizzes")
      .upsert(payload, { onConflict: "tenant_id,group_id,quiz_number" })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to upsert quiz: ${error?.message || "unknown error"}`);
    }

    return data as unknown as QuizRecord;
  }

  async getScoresForGroup(
    tenantId: string,
    groupId: string,
    quizNumber?: number
  ): Promise<QuizScoreItem[]> {
    let query = this.supabase
      .from("quiz_scores")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("group_id", groupId);

    if (quizNumber !== undefined) {
      query = query.eq("quiz_number", quizNumber);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to get quiz scores: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      quiz_id: row.quiz_id,
      group_id: row.group_id,
      quiz_number: row.quiz_number,
      student_id: row.student_id,
      score: Number(row.score),
      max_score: Number(row.max_score || 10),
      note: row.note || "",
      delivery_status: row.delivery_status || "pending",
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async saveQuizScores(
    tenantId: string,
    params: {
      group_id: string;
      quiz_number: number;
      quiz_title?: string;
      max_score?: number;
      scores: Record<string, number | string>;
      notes?: Record<string, string>;
    }
  ): Promise<{ savedCount: number }> {
    const maxScore = params.max_score ?? 10;
    const quizTitle = params.quiz_title || `كويز ${params.quiz_number}`;

    // 1. Upsert Quiz record first
    const quiz = await this.upsertQuiz(tenantId, {
      group_id: params.group_id,
      quiz_number: params.quiz_number,
      title: quizTitle,
      max_score: maxScore,
    });

    // 2. Upsert scores into quiz_scores
    let savedCount = 0;
    const entries = Object.entries(params.scores);

    for (const [studentId, scoreVal] of entries) {
      if (scoreVal === undefined || scoreVal === null || scoreVal === "") continue;
      const numScore = Number(scoreVal);
      if (isNaN(numScore)) continue;

      const idempotencyKey = `${tenantId}:${params.group_id}:${studentId}:quiz-${params.quiz_number}`;
      const noteVal = params.notes?.[studentId] || null;

      const { error } = await this.supabase.from("quiz_scores").upsert(
        {
          tenant_id: tenantId,
          group_id: params.group_id,
          quiz_id: quiz.id,
          quiz_number: params.quiz_number,
          student_id: studentId,
          score: numScore,
          max_score: maxScore,
          note: noteVal,
          idempotency_key: idempotencyKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "idempotency_key" }
      );

      if (!error) {
        savedCount++;
      }
    }

    return { savedCount };
  }

  async updateDeliveryStatus(
    tenantId: string,
    groupId: string,
    quizNumber: number,
    studentId: string,
    status: "sent" | "failed"
  ): Promise<void> {
    const idempotencyKey = `${tenantId}:${groupId}:${studentId}:quiz-${quizNumber}`;
    await this.supabase
      .from("quiz_scores")
      .update({
        delivery_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("idempotency_key", idempotencyKey);
  }
}

export class FakeQuizzesRepository implements IQuizzesRepository {
  private quizzes: QuizRecord[] = [];
  private scores: QuizScoreItem[] = [];

  async listQuizzes(tenantId: string, groupId?: string): Promise<QuizRecord[]> {
    return this.quizzes.filter(
      (q) => q.tenant_id === tenantId && (!groupId || q.group_id === groupId)
    );
  }

  async upsertQuiz(
    tenantId: string,
    quiz: {
      id?: string;
      group_id: string;
      quiz_number: number;
      title: string;
      max_score?: number;
      quiz_date?: string;
      is_skipped?: boolean;
    }
  ): Promise<QuizRecord> {
    const existingIndex = this.quizzes.findIndex(
      (q) =>
        q.tenant_id === tenantId &&
        q.group_id === quiz.group_id &&
        q.quiz_number === quiz.quiz_number
    );

    const record: QuizRecord = {
      id: quiz.id || `quiz-uuid-${Date.now()}-${quiz.quiz_number}`,
      tenant_id: tenantId,
      group_id: quiz.group_id,
      quiz_number: quiz.quiz_number,
      title: quiz.title,
      max_score: quiz.max_score ?? 10,
      quiz_date: quiz.quiz_date || new Date().toISOString().slice(0, 10),
      is_skipped: quiz.is_skipped ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.quizzes[existingIndex] = record;
    } else {
      this.quizzes.push(record);
    }

    return record;
  }

  async getScoresForGroup(
    tenantId: string,
    groupId: string,
    quizNumber?: number
  ): Promise<QuizScoreItem[]> {
    return this.scores.filter(
      (s) =>
        s.tenant_id === tenantId &&
        s.group_id === groupId &&
        (quizNumber === undefined || s.quiz_number === quizNumber)
    );
  }

  async saveQuizScores(
    tenantId: string,
    params: {
      group_id: string;
      quiz_number: number;
      quiz_title?: string;
      max_score?: number;
      scores: Record<string, number | string>;
      notes?: Record<string, string>;
    }
  ): Promise<{ savedCount: number }> {
    await this.upsertQuiz(tenantId, {
      group_id: params.group_id,
      quiz_number: params.quiz_number,
      title: params.quiz_title || `كويز ${params.quiz_number}`,
      max_score: params.max_score ?? 10,
    });

    let savedCount = 0;
    for (const [studentId, scoreVal] of Object.entries(params.scores)) {
      if (scoreVal === undefined || scoreVal === null) continue;
      const existingIdx = this.scores.findIndex(
        (s) =>
          s.tenant_id === tenantId &&
          s.group_id === params.group_id &&
          s.quiz_number === params.quiz_number &&
          s.student_id === studentId
      );

      const item: QuizScoreItem = {
        id: `qs-${Date.now()}-${studentId}`,
        tenant_id: tenantId,
        group_id: params.group_id,
        quiz_number: params.quiz_number,
        student_id: studentId,
        score: Number(scoreVal),
        max_score: params.max_score ?? 10,
        note: params.notes?.[studentId] || "",
        delivery_status: "pending",
        updated_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        this.scores[existingIdx] = { ...this.scores[existingIdx], ...item };
      } else {
        this.scores.push(item);
      }
      savedCount++;
    }

    return { savedCount };
  }

  async updateDeliveryStatus(
    tenantId: string,
    groupId: string,
    quizNumber: number,
    studentId: string,
    status: "sent" | "failed"
  ): Promise<void> {
    const item = this.scores.find(
      (s) =>
        s.tenant_id === tenantId &&
        s.group_id === groupId &&
        s.quiz_number === quizNumber &&
        s.student_id === studentId
    );
    if (item) {
      item.delivery_status = status;
    }
  }
}
