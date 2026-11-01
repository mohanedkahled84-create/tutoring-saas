import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTeacherDashboard} from '../../web/src/components/TeacherDashboard.js';
import {renderTeacherAssistantsView,registerTeacherAssistantsActions} from '../../web/src/components/TeacherAssistantsView.js';
import {renderStudentReportsView} from '../../web/src/components/StudentReportsView.js';
import {renderSidebar} from '../../web/src/components/Sidebar.js';
import {registerSecurityPinActions} from '../../web/src/components/SecurityPinManager.js';
test('old PIN flags cannot restore an internal password gate or hide permitted owner pages',()=>{
 const stale={hasPin:true,isUnlocked:false,hideNumbers:false};
 for(const html of [renderTeacherDashboard({}, {},stale),renderTeacherAssistantsView([],[],stale),renderStudentReportsView({activeTab:'financial'},stale),renderSidebar('dashboard',{role:'teacher'},stale)])assert.doesNotMatch(html,/promptUnlockFinancials|openSetPinModal|lockFinancials|رمز الأمان|PIN/);
 const app={hasSecurityPin:true,isFinancialUnlocked:false};registerSecurityPinActions(app);app.lockFinancials();assert.equal(app.hasSecurityPin,false);assert.equal(app.isFinancialUnlocked,true);
});
