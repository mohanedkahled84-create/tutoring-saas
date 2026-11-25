import {localize} from '../utils/language.js?v=9.99.0';
import {renderCommercialBillingView,registerCommercialBillingActions} from './CommercialBillingView.js?v=9.99.0';
import {escapeHtml} from '../utils/escapeHtml.js?v=9.99.0';
export function renderBillingView(data={},user={}) { return renderCommercialBillingView(data,user); }
export function registerBillingActions(app){
 registerCommercialBillingActions(app);
 app.showQuotaBlockedModal=function(currentCount,limit){
  this.showModal(localize('وصلت لسعة الطلاب','Student capacity reached'),`<div dir="${localize('rtl','ltr')}"><p>${localize('لديك','You have')} ${escapeHtml(String(currentCount))} ${localize('طالب من سعة','students out of')} ${escapeHtml(String(limit))}. ${localize('يمكنك إضافة مقاعد أو اختيار باقة أكبر، أو أرشفة الطلاب غير النشطين مع حفظ تاريخهم.','Add seats, choose a larger plan, or archive inactive students while retaining their history.')}</p><button class="btn btn-primary" style="min-height:44px" onclick="window.centrlyApp.closeModal();window.centrlyApp.navigate('billing')">${localize('مراجعة السعة والاشتراك','Review capacity and subscription')}</button></div>`);
 };
 // Old cached buttons must start from a server-priced order, never a client-supplied amount.
 app.openPlanChoiceModal=app.openPaymentProofModal=function(){this.closeModal();this.navigate('billing');};
 app.handleSubmitPaymentProof=function(event){event?.preventDefault();this.openPlanChoiceModal();};
 app.setBillingCycle=function(){this.navigate('billing');};
}
