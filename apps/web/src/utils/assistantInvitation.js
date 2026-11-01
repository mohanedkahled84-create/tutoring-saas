export function assistantInvitationStatus(assistant, now = Date.now()) {
 if (!assistant.access) return 'سجل قديم — لم يُربط بحساب مستقل';
 if (assistant.status === 'inactive') return 'الوصول متوقف';
 const invitation = assistant.invitation;
 const active = assistant.status === 'active';
 if (invitation && !invitation.accepted_at) {
  const prefix = active ? 'حساب نشط · ' : '';
  if (invitation.revoked_at) return `${prefix}الدعوة السابقة ملغاة`;
  if (Date.parse(invitation.expires_at) <= now) return `${prefix}الدعوة انتهت — أرسل دعوة جديدة`;
  if (invitation.delivery_status === 'sent') return `${prefix}${active ? 'دعوة استعادة مرسلة' : 'دعوة مرسلة'} — بانتظار الاستكمال`;
  if (invitation.delivery_status === 'blocked') return `${prefix}الدعوة محفوظة — بانتظار اعتماد رسالة واتساب`;
  return `${prefix}الدعوة محفوظة — لم يتأكد إرسال واتساب`;
 }
 return active ? 'حساب مستقل' : 'بانتظار دعوة لاستكمال الحساب';
}
