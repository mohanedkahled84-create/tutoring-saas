import {renderCommercialBillingView,registerCommercialBillingActions} from './CommercialBillingView.js?v=9.46.0';
import {escapeHtml} from '../utils/escapeHtml.js?v=9.46.0';
export function renderBillingView(data={},user={}) { return renderCommercialBillingView(data,user); }
export function registerBillingActions(app){
 registerCommercialBillingActions(app);
 app.showQuotaBlockedModal=function(currentCount,limit){
  this.showModal('وصلت لسعة الطلاب',`<div dir="rtl"><p>لديك ${escapeHtml(String(currentCount))} طالب من سعة ${escapeHtml(String(limit))}. يمكنك إضافة مقاعد أو اختيار باقة أكبر، أو أرشفة الطلاب غير النشطين مع حفظ تاريخهم.</p><button class="btn btn-primary" style="min-height:44px" onclick="window.centrlyApp.closeModal();window.centrlyApp.navigate('billing')">مراجعة السعة والاشتراك</button></div>`);
 };
 // Old cached buttons must start from a server-priced order, never a client-supplied amount.
 app.openPlanChoiceModal=app.openPaymentProofModal=function(){this.closeModal();this.navigate('billing');};
 app.handleSubmitPaymentProof=function(event){event?.preventDefault();this.openPlanChoiceModal();};
 app.setBillingCycle=function(){this.navigate('billing');};
}
