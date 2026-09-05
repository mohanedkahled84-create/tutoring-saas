/**
 * Centrly Message Logs & Delivery Status View (DEV-16 DEV-TDB.3 & DEV-ATN.3)
 * Visibility on WhatsApp sent/failed statuses + manual resend trigger.
 */

export function renderMessageLogsView(logs = []) {
  const logsList = logs || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Header -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">سجل رسائل الواتساب وحالة التسليم</h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              متابعة الرسائل المرسلة لأولياء الأمور، كشف أخطاء التسليم، وإعادة الإرسال يدوياً
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <span class="badge badge-success">تم التسليم: ${logsList.filter(l => l.status === 'sent').length}</span>
            <span class="badge badge-danger">فشل الإرسال: ${logsList.filter(l => l.status === 'failed' || l.status === 'needs_review').length}</span>
          </div>
        </div>

        <!-- Filter bar -->
        <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem;">
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.filterLogs('all')">الكل</button>
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.filterLogs('failed')">الأخطاء فقط</button>
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.filterLogs('sent')">المرسلة بنجاح</button>
        </div>
      </div>

      <!-- Logs Table -->
      <div class="card" style="margin: 0;">
        <div style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم الطالب</th>
                <th>رقم ولي الأمر</th>
                <th>نوع الرسالة</th>
                <th>حالة التسليم</th>
                <th>وقت الإرسال</th>
                <th>تفاصيل الخطأ</th>
                <th>إجراء يدوي</th>
              </tr>
            </thead>
            <tbody>
              ${logsList.length > 0 ? logsList.map(l => `
                <tr>
                  <td style="font-weight: 700;">${l.studentName || l.student_name || '—'}</td>
                  <td dir="ltr" style="text-align: right; font-family: monospace;">${l.phone || '—'}</td>
                  <td><span class="badge badge-blue">${l.type || 'إشعار'}</span></td>
                  <td>
                    <span class="badge ${l.status === 'sent' ? 'badge-success' : (l.status === 'failed' ? 'badge-danger' : 'badge-warning')}">
                      ${l.status === 'sent' ? 'تم التسليم' : (l.status === 'failed' ? 'فشل التسليم' : 'يحتاج مراجعة')}
                    </span>
                  </td>
                  <td style="font-size: 0.8rem; color: var(--centrly-text);">${l.time || '—'}</td>
                  <td style="font-size: 0.8rem; color: ${l.reason ? 'var(--centrly-danger)' : 'var(--centrly-text)'};">
                    ${l.reason || '—'}
                  </td>
                  <td>
                    ${l.status !== 'sent' ? `
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.resendSingleMessage('${l.studentId || l.student_id}', '${l.studentName || l.student_name}')" style="font-weight: 700; color: var(--centrly-blue-800);">
                        🔄 إعادة إرسال
                      </button>
                    ` : `
                      <span style="font-size: 0.8rem; color: var(--centrly-success);">مكتمل ✓</span>
                    `}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا توجد سجلات رسائل بعد. الرسائل المرسلة لأولياء الأمور ستظهر هنا فور إرسالها.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
