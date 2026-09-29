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

export interface MetaTemplateSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: number;
  isPendingApproval?: boolean;
}

export interface IMetaCloudGateway {
  sendTemplate(params: {
    to: string; // E.164 format without '+', e.g. "201010979708"
    templateName: string;
    languageCode?: string;
    bodyParameters: string[];
  }): Promise<MetaTemplateSendResult>;

  getTemplateStatuses(): Promise<Record<string, "APPROVED" | "PENDING" | "REJECTED" | "UNKNOWN">>;
}

export class HttpMetaCloudGateway implements IMetaCloudGateway {
  private readonly baseUrl = "https://graph.facebook.com/v21.0";
  private templateStatusCache: { data: Record<string, "APPROVED" | "PENDING" | "REJECTED" | "UNKNOWN">; expiry: number } | null = null;

  constructor(
    private readonly phoneNumberId?: string,
    private readonly accessToken?: string,
    private readonly wabaId?: string
  ) {}

  async sendTemplate(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    bodyParameters: string[];
  }): Promise<MetaTemplateSendResult> {
    if (!this.phoneNumberId || !this.accessToken) {
      return {
        success: false,
        error: "Meta Cloud API credentials are not configured",
      };
    }

    const cleanTo = params.to.replace(/\D/g, "");
    const languageCode = params.languageCode || "en";

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
            parameters: params.bodyParameters.map((val) => ({
              type: "text",
              text: val || "",
            })),
          },
        ],
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorObj = (data as any)?.error || {};
        const errorCode = errorObj.code;
        const errorMsg = errorObj.message || `Meta API Error (${response.status})`;

        // Code 100 often indicates template is pending approval or parameter mismatch
        const isPending = errorCode === 100 || (errorObj.error_data?.details || "").includes("template");

        return {
          success: false,
          error: errorMsg,
          errorCode,
          isPendingApproval: isPending,
        };
      }

      const messageId = (data as any)?.messages?.[0]?.id;
      return {
        success: true,
        messageId,
      };
    } catch (err: any) {
      return {
        success: false,
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
