/**
 * Centrly Message Logs & Delivery Status View (DEV-16 DEV-TDB.3 & DEV-ATN.3)
 * Visibility on WhatsApp sent/failed statuses + manual resend trigger.
 */

export function renderMessageLogsView(logs = []) {
  const defaultLogs = logs.length > 0 ? logs : [
    { id: 'm1', studentId: 's1', studentName: 'أحمد محمود', phone: '01012345678', type: 'ملاحظة حضور', status: 'sent', time: '16:08', reason: null },
    { id: 'm2', studentId: 's3', studentName: 'عمر إبراهيم', phone: '01234567890', type: 'إنذار غياب', status: 'failed', time: '16:10', reason: 'الرقم غير مسجل على واتساب أو الهاتف مغلق' },
    { id: 'm3', studentId: 's4', studentName: 'مريم علي', phone: '01512345678', type: 'إنذار غياب', status: 'sent', time: '16:12', reason: null },
    { id: 'm4', studentId: 's5', studentName: 'كريم أحمد', phone: '01198765432', type: 'تقرير تسميع', status: 'needs_review', time: '16:15', reason: 'تجاوز حد الإرسال المؤقت' },
  ];

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
            <span class="badge badge-success">تم التسليم: ${defaultLogs.filter(l => l.status === 'sent').length}</span>
            <span class="badge badge-danger">فشل الإرسال: ${defaultLogs.filter(l => l.status === 'failed' || l.status === 'needs_review').length}</span>
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
              ${defaultLogs.map(l => `
                <tr>
                  <td style="font-weight: 700;">${l.studentName}</td>
                  <td dir="ltr" style="text-align: right; font-family: monospace;">${l.phone}</td>
                  <td><span class="badge badge-blue">${l.type}</span></td>
                  <td>
                    <span class="badge ${l.status === 'sent' ? 'badge-success' : (l.status === 'failed' ? 'badge-danger' : 'badge-warning')}">
                      ${l.status === 'sent' ? 'تم التسليم' : (l.status === 'failed' ? 'فشل التسليم' : 'يحتاج مراجعة')}
                    </span>
                  </td>
                  <td style="font-size: 0.8rem; color: var(--centrly-text);">${l.time}</td>
                  <td style="font-size: 0.8rem; color: ${l.reason ? 'var(--centrly-danger)' : 'var(--centrly-text)'};">
                    ${l.reason || '—'}
                  </td>
                  <td>
                    ${l.status !== 'sent' ? `
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.resendSingleMessage('${l.studentId}', '${l.studentName}')" style="font-weight: 700; color: var(--centrly-blue-800);">
                        🔄 إعادة إرسال
                      </button>
                    ` : `
                      <span style="font-size: 0.8rem; color: var(--centrly-success);">مكتمل ✓</span>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
