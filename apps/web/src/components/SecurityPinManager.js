export function registerSecurityPinActions(app) {
 app.hasSecurityPin=false;app.isFinancialUnlocked=true;
 const unlock=function(){this.hasSecurityPin=false;this.isFinancialUnlocked=true;};
 app.openSetPinModal=unlock;app.promptUnlockFinancials=unlock;app.lockFinancials=unlock;app.resetFinancialPinPrompt=unlock;
 app.toggleHideFinancialNumbers=function(){
  this.hideFinancialNumbers=!this.hideFinancialNumbers;
  if(this.hideFinancialNumbers && typeof document!=='undefined' && document.querySelector?.('[data-assistant-pay]'))this.closeModal();
  this.renderMainContent();
 };
}
