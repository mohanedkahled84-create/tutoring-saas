import { IQuizzesRepository, QuizRecord, QuizScoreItem } from "./types.js";

export class QuizzesService {
  constructor(private readonly repository: IQuizzesRepository) {}

  async listGroupQuizzesData(
    tenantId: string,
    groupId: string
  ): Promise<{
    quizzes: QuizRecord[];
    scores_map: Record<number, Record<string, number>>;
    notes_map: Record<number, Record<string, string>>;
    delivery_status_map: Record<number, Record<string, string>>;
  }> {
    let quizzes = await this.repository.listQuizzes(tenantId, groupId);

    // If no quizzes exist yet for this group, initialize default 3 starter quizzes
    if (quizzes.length === 0 && groupId) {
      const today = new Date().toISOString().slice(0, 10);
      const defaultQuizzes = [
        { group_id: groupId, quiz_number: 1, title: "كويز 1: أساسيات المادة", max_score: 10, quiz_date: today },
        { group_id: groupId, quiz_number: 2, title: "كويز 2: الفصل الأول", max_score: 10, quiz_date: today },
        { group_id: groupId, quiz_number: 3, title: "كويز 3: مراجعة شاملة", max_score: 10, quiz_date: today },
      ];

      for (const dq of defaultQuizzes) {
        try {
          const created = await this.repository.upsertQuiz(tenantId, dq);
          quizzes.push(created);
        } catch {
          // ignore seeding collision
        }
      }
    }

    const scoresList: QuizScoreItem[] = await this.repository.getScoresForGroup(tenantId, groupId);

    const scoresMap: Record<number, Record<string, number>> = {};
    const notesMap: Record<number, Record<string, string>> = {};
    const deliveryStatusMap: Record<number, Record<string, string>> = {};

    for (const item of scoresList) {
      const qNum = item.quiz_number;
      if (!scoresMap[qNum]) scoresMap[qNum] = {};
      if (!notesMap[qNum]) notesMap[qNum] = {};
      if (!deliveryStatusMap[qNum]) deliveryStatusMap[qNum] = {};

      scoresMap[qNum][item.student_id] = item.score;
      if (item.note) {
        notesMap[qNum][item.student_id] = item.note;
      }
      if (item.delivery_status) {
        deliveryStatusMap[qNum][item.student_id] = item.delivery_status;
      }
    }

    return {
      quizzes,
      scores_map: scoresMap,
      notes_map: notesMap,
      delivery_status_map: deliveryStatusMap,
    };
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
    return this.repository.upsertQuiz(tenantId, quiz);
  }

  async saveScores(
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
    return this.repository.saveQuizScores(tenantId, params);
  }

  async updateDeliveryStatus(
    tenantId: string,
    groupId: string,
    quizNumber: number,
    studentId: string,
    status: "sent" | "failed"
  ): Promise<void> {
    return this.repository.updateDeliveryStatus(tenantId, groupId, quizNumber, studentId, status);
  }
}
