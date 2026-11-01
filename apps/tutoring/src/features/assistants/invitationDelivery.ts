import { approvedUtilityTemplate } from '../../shared/utils/metaTemplatePolicy.js';

// This is the user's current copy candidate. Pending/reclassified templates never send.
export const assistantInvitationTemplate = 'centerly_assistant_account_added_v1';
type MetaConnection = { appSecret?: string; accessToken?: string; wabaId?: string; phoneNumberId?: string };

export async function notifyAssistantInvitation(meta: MetaConnection, phone: string, teacher: string, nonce: string) {
 const baseUrl = 'https://graph.facebook.com/v22.0';
 if (!meta.appSecret || !meta.phoneNumberId || !await approvedUtilityTemplate({ baseUrl, accessToken: meta.accessToken, wabaId: meta.wabaId, name: assistantInvitationTemplate, language: 'ar' })) return 'blocked';
 try {
  const response = await fetch(`${baseUrl}/${meta.phoneNumberId}/messages`, {
   method: 'POST', headers: { Authorization: `Bearer ${meta.accessToken}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
   body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template', template: {
    name: assistantInvitationTemplate, language: { code: 'ar' }, components: [
     { type: 'body', parameters: [{ type: 'text', text: teacher }] },
     { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `CENTRLY_ASSISTANT:${nonce}` }] },
    ],
   } }),
  });
  const result: any = await response.json();
  return response.ok && result?.messages?.[0]?.id ? 'sent' : 'failed';
 } catch { return 'failed'; }
}
