/**
 * ============================================================================
 * Meta WhatsApp Cloud API Gateway
 * ============================================================================
 * Architecture Rule 1 & Rule 3:
 * - Domain layer communicates with Meta Graph API exclusively via interfaces.
 * - ZERO imports of external database clients in this file.
 * - Central System Number (+20 10 10979708, Phone Number ID: 1236924299513397)
 * ============================================================================
 */

import {approvedUtilityTemplate,type ExpectedTemplate} from '../../shared/utils/metaTemplatePolicy.js';
import {metaTemplateParameters} from '../../shared/utils/metaTemplateParameters.js';
import {reserveMetaBudget,settleMetaBudget,type MetaBudgetContext} from '../../shared/utils/metaDispatchBudget.js';

export interface MetaTemplateSendResult {
  success: boolean;
  outcome?:'not_sent'|'accepted'|'unknown';
  messageId?: string;
  error?: string;
  errorCode?: number;
  isPendingApproval?: boolean;
  deferred?:boolean;
  retryAt?:string|null;
}

export interface IMetaCloudGateway {
  sendTemplate(params: {
    to: string; // E.164 format without '+', e.g. "201010979708"
    templateName: string;
    languageCode?: string;
    bodyParameters: string[];
    expected?:ExpectedTemplate;
    budget?:MetaBudgetContext;
  }): Promise<MetaTemplateSendResult>;

  getTemplateStatuses(): Promise<Record<string, "APPROVED" | "PENDING" | "REJECTED" | "UNKNOWN">>;
}

export class HttpMetaCloudGateway implements IMetaCloudGateway {
  private readonly baseUrl = "https://graph.facebook.com/v21.0";
  private templateStatusCache: { data: Record<string, "APPROVED" | "PENDING" | "REJECTED" | "UNKNOWN">; expiry: number } | null = null;

  constructor(
    private readonly phoneNumberId?: string,
    private readonly accessToken?: string,
    private readonly wabaId?: string,
    private readonly budgetPolicy={reserve:reserveMetaBudget,settle:settleMetaBudget}
  ) {}

  async sendTemplate(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    bodyParameters: string[];
    expected?:ExpectedTemplate;
    budget?:MetaBudgetContext;
  }): Promise<MetaTemplateSendResult> {
    if (!this.phoneNumberId || !this.accessToken) {
      return {
        success: false,
        outcome:'not_sent',
        error: "Meta Cloud API credentials are not configured",
      };
    }

    const cleanTo = params.to.replace(/\D/g, "");
    if(!/^201[0125]\d{8}$/.test(cleanTo))return {success:false,outcome:'not_sent',error:'الإرسال الرسمي بالسعر الحالي للأرقام المصرية فقط؛ استخدم فتح واتساب للأرقام الأخرى'};
    const languageCode = params.languageCode || "en";
    if(params.expected && params.bodyParameters.length!==params.expected.parameterCount)return {success:false,outcome:'not_sent',error:'Template parameter count does not match the approved contract'};
    if(!await approvedUtilityTemplate({baseUrl:this.baseUrl,accessToken:this.accessToken,wabaId:this.wabaId,name:params.templateName,language:languageCode,expected:params.expected})){
      return {success:false,outcome:'not_sent',error:'Template must be approved as UTILITY; marketing, other categories and unverified templates are blocked'};
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
      type: "template",
      template: {
        name: params.templateName,
        language: {
          code: languageCode,
        },
        components: [
          {
            type: "body",
            parameters: metaTemplateParameters(params.templateName,params.bodyParameters).map((val) => ({
              type: "text",
              text: val || "",
            })),
          },
        ],
      },
    };

    const budget=await this.budgetPolicy.reserve(cleanTo,params.budget);
    if(!budget.allowed)return {success:false,outcome:'not_sent',deferred:true,retryAt:budget.nextAt,error:'الإرسال مجدول على دفعات؛ حاول لاحقًا'};
    try {
      const response = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal:AbortSignal.timeout(15000),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorObj = (data as any)?.error || {};
        const errorCode = errorObj.code;
        const errorMsg = errorObj.message || `Meta API Error (${response.status})`;

        // Code 100 often indicates template is pending approval or parameter mismatch
        const isPending = errorCode === 100 || (errorObj.error_data?.details || "").includes("template");
        await this.budgetPolicy.settle(budget.id,response.status>=400 && response.status<500 && errorObj.code!==undefined?'not_sent':'unknown');

        return {
          success: false,
          outcome:response.status>=400 && response.status<500 && errorObj.code!==undefined?'not_sent':'unknown',
          error: errorMsg,
          errorCode,
          isPendingApproval: isPending,
        };
      }

      const messageId = (data as any)?.messages?.[0]?.id;
      if(typeof messageId!=='string' || !messageId.startsWith('wamid.'))return {success:false,outcome:'unknown',error:'Meta did not return a confirmed message identifier'};
      await this.budgetPolicy.settle(budget.id,'accepted');
      return {
        success: true,
        outcome:'accepted',
        messageId,
      };
    } catch (err: any) {
      await this.budgetPolicy.settle(budget.id,'unknown');
      return {
        success: false,
        outcome:'unknown',
        error: err.message || "Failed to dispatch message to Meta Cloud API",
      };
    }
  }

  async getTemplateStatuses(): Promise<Record<string, "APPROVED" | "PENDING" | "REJECTED" | "UNKNOWN">> {
    if (!this.wabaId || !this.accessToken) {
      return {};
    }

    const now = Date.now();
    if (this.templateStatusCache && this.templateStatusCache.expiry > now) {
      return this.templateStatusCache.data;
    }

    try {
      const url = `${this.baseUrl}/${this.wabaId}/message_templates?fields=name,status`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!res.ok) {
        return this.templateStatusCache?.data || {};
      }

      const json = await res.json().catch(() => ({}));
      const list = (json as any)?.data || [];
      const map: Record<string, "APPROVED" | "PENDING" | "REJECTED" | "UNKNOWN"> = {};

      for (const item of list) {
        if (item.name && item.status) {
          map[item.name] = item.status;
        }
      }

      this.templateStatusCache = {
        data: map,
        expiry: now + 5 * 60 * 1000, // cache for 5 minutes
      };

      return map;
    } catch {
      return this.templateStatusCache?.data || {};
    }
  }
}

export class FakeMetaCloudGateway implements IMetaCloudGateway {
  public sentMessages: Array<{ to: string; templateName: string; parameters: string[] }> = [];
  public failNext = false;
  public simulatePending = false;

  async sendTemplate(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    bodyParameters: string[];
  }): Promise<MetaTemplateSendResult> {
    if (this.failNext) {
      this.failNext = false;
      return { success: false, error: "Simulated Meta network failure" };
    }

    if (this.simulatePending) {
      return {
        success: false,
        error: "(#100) Invalid parameter: template pending review",
        errorCode: 100,
        isPendingApproval: true,
      };
    }

    this.sentMessages.push({
      to: params.to,
      templateName: params.templateName,
      parameters: params.bodyParameters,
    });

    return {
      success: true,
      messageId: `wamid.fake.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  async getTemplateStatuses(): Promise<Record<string, "APPROVED" | "PENDING" | "REJECTED" | "UNKNOWN">> {
    return {
      centerly: this.simulatePending ? "PENDING" : "APPROVED",
      centerly_student: this.simulatePending ? "PENDING" : "APPROVED",
    };
  }
}
