import { localize as t } from './language.js?v=9.99.6';

export function assistantInvitationStatus(assistant, now = Date.now()) {
 if (!assistant.access) return t('سجل قديم — لم يُربط بحساب مستقل', 'Legacy record — not linked to an independent account');
 if (assistant.status === 'inactive') return t('الوصول متوقف', 'Access suspended');
 const invitation = assistant.invitation;
 const active = assistant.status === 'active';
 if (invitation && !invitation.accepted_at) {
  const prefix = active ? t('حساب نشط · ', 'Active account · ') : '';
  if (invitation.revoked_at) return `${prefix}${t('الدعوة السابقة ملغاة', 'Previous invitation revoked')}`;
  if (Date.parse(invitation.expires_at) <= now) return `${prefix}${t('الدعوة انتهت — أرسل دعوة جديدة', 'Invitation expired — send a new invitation')}`;
  if (invitation.delivery_status === 'sent') return `${prefix}${active ? t('دعوة استعادة مرسلة', 'Recovery invitation sent') : t('دعوة مرسلة', 'Invitation sent')}${t(' — بانتظار الاستكمال', ' — pending setup')}`;
  if (invitation.delivery_status === 'blocked') return `${prefix}${t('الدعوة محفوظة — بانتظار اعتماد رسالة واتساب', 'Invitation saved — pending WhatsApp template approval')}`;
  return `${prefix}${t('الدعوة محفوظة — لم يتأكد إرسال واتساب', 'Invitation saved — WhatsApp delivery unconfirmed')}`;
 }
 return active ? t('حساب مستقل', 'Independent account') : t('بانتظار دعوة لاستكمال الحساب', 'Pending invitation to complete setup');
}
