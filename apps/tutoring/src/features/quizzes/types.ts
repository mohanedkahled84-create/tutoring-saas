export interface QuizRecord {
  id: string;
  tenant_id: string;
  group_id: string;
  quiz_number: number;
  title: string;
  max_score: number;
  quiz_date: string;
  is_skipped: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuizScoreItem {
  id?: string;
  tenant_id: string;
  quiz_id?: string;
  group_id: string;
  quiz_number: number;
  student_id: string;
  score: number;
  max_score: number;
  note?: string;
  delivery_status?: "pending" | "sent" | "failed";
  created_at?: string;
  updated_at?: string;
}

export interface IQuizzesRepository {
  listQuizzes(tenantId: string, groupId?: string): Promise<QuizRecord[]>;
  upsertQuiz(
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
  ): Promise<QuizRecord>;
  getScoresForGroup(tenantId: string, groupId: string, quizNumber?: number): Promise<QuizScoreItem[]>;
  saveQuizScores(
    tenantId: string,
    params: {
      group_id: string;
      quiz_number: number;
      quiz_title?: string;
      max_score?: number;
      scores: Record<string, number | string>;
      notes?: Record<string, string>;
    }
  ): Promise<{ savedCount: number }>;
  updateDeliveryStatus(
    tenantId: string,
    groupId: string,
    quizNumber: number,
    studentId: string,
    status: "sent" | "failed"
  ): Promise<void>;
}
