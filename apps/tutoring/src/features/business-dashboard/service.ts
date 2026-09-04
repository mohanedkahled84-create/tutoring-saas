import {
  BusinessDashboardData,
  IBusinessDashboardRepository,
} from "./types.js";

export class BusinessDashboardService {
  constructor(private readonly repo: IBusinessDashboardRepository) {}

  /**
   * DEV-54: Cross-tenant business overview metrics for the founder.
   * Aggregates active subscriptions, MRR, message costs, and churn signals.
   */
  async getMetrics(): Promise<BusinessDashboardData> {
    return this.repo.getBusinessDashboardData();
  }
}
