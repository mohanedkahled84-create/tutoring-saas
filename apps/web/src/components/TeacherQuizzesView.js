import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Teacher Quizzes Management Component
 * Allows teachers to:
 * - Select a group
 * - View numbered quizzes (كويز 1، كويز 2، كويز 3...)
 * - Add a new quiz or skip a quiz
 * - Grade students for today's quiz or past quizzes at any time
 * - View class average, highest score, and grading completion percentage
 */

export function renderTeacherQuizzesView(state = {}, groups = [], students = []) {
  const selectedGroupId = state.selectedGroupId || (groups[0]?.id || '');
  const activeGroup = groups.find(g => g.id === selectedGroupId) || groups[0] || null;
  const groupStudents = (students || []).filter(s => {
    if (!selectedGroupId) return true;
    if (String(s.group_id) === String(selectedGroupId) || String(s.groupId) === String(selectedGroupId)) return true;
    if (Array.isArray(s.group_ids) && s.group_ids.some(gid => String(gid) === String(selectedGroupId))) return true;
    if (s.group_name && activeGroup?.name && s.group_name.trim().toLowerCase() === activeGroup.name.trim().toLowerCase()) return true;
    return false;
  });

  const quizzes = state.quizzes || [
    { id: 1, number: 1, title: 'كويز 1: أساسيات المادة', maxScore: 10, date: '2026-09-01', skipped: false },
    { id: 2, number: 2, title: 'كويز 2: الفصل الأول', maxScore: 10, date: '2026-09-05', skipped: false },
    { id: 3, number: 3, title: 'كويز 3: مراجعة شاملة', maxScore: 10, date: '2026-09-08', skipped: false },
  ];

  const currentQuizNumber = state.currentQuizNumber || quizzes[quizzes.length - 1]?.number || 1;
  const currentQuiz = quizzes.find(q => q.number === currentQuizNumber) || quizzes[0] || {
    id: 1, number: 1, title: 'كويز 1', maxScore: 10, date: '2026-09-10', skipped: false
  };

  const scoresMap = state.scoresMap || {};
  const currentScores = scoresMap[currentQuiz.number] || {};

  // Compute statistics
  let gradedCount = 0;
  let totalScore = 0;
  let highestScore = 0;

  groupStudents.forEach(s => {
    const sc = currentScores[s.id];
    if (sc !== undefined && sc !== null && sc !== '') {
      gradedCount++;
      const num = Number(sc);
      totalScore += num;
      if (num > highestScore) highestScore = num;
    }
  });

  const avgScore = gradedCount > 0 ? (totalScore / gradedCount).toFixed(1) : '—';
  const completionRate = groupStudents.length > 0 ? Math.round((gradedCount / groupStudents.length) * 100) : 0;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title & Group Selector -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('reports', 22, 'var(--centrly-blue-700)')}</span>
              <span>الكويزات والامتحانات الدورية</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              رصد وتصحيح درجات الكويزات مرقمة تسلسلياً مع إمكانية رصد درجات اليوم لاحقاً أو تخطي الكويز.
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <label style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink);">المجموعة الدراسية:</label>
            <select 
              id="quizGroupSelect" 
              class="form-select" 
              style="width: 200px; font-weight: 700;"
              onchange="window.centrlyApp.switchQuizGroup(this.value)"
            >
              ${groups.map(g => `
                <option value="${escapeHtml(g.id)}" ${g.id === selectedGroupId ? 'selected' : ''}>
                  ${escapeHtml(g.name)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Quiz Navigation Tabs & Actions -->
      <div class="card" style="margin: 0; background: #f8fafc; border: 1px solid var(--centrly-line);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          
          <!-- Numbered Quiz Tabs -->
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink); margin-left: 0.5rem;">الكويز:</span>
            ${quizzes.map(q => {
              const isSelected = q.number === currentQuizNumber;
              return `
                <button 
                  class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" 
                  style="padding: 0.4rem 0.85rem; font-size: 0.85rem; font-weight: 700; border-radius: 8px; display: flex; align-items: center; gap: 0.35rem;"
                  onclick="window.centrlyApp.selectQuizNumber(${q.number})"
                >
                  <span>كويز ${q.number}</span>
                  ${q.skipped ? '<span style="font-size: 0.7rem; color: #f59e0b;">(مُتخطى)</span>' : ''}
                </button>
              `;
            }).join('')}

            <button 
              class="btn btn-secondary" 
              style="padding: 0.4rem 0.75rem; font-size: 0.85rem; font-weight: 700; border-radius: 8px; border-style: dashed;"
              onclick="window.centrlyApp.addNewQuiz()"
              title="إضافة كويز جديد"
            >
              ${getIcon('add', 14)}
              <span>كويز جديد</span>
            </button>
          </div>

          <!-- Quick Action Buttons: Skip, Save, and WhatsApp Batch Dispatch -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button 
              class="btn btn-secondary" 
              onclick="window.centrlyApp.skipCurrentQuiz(${currentQuiz.number})"
              style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: #b45309;"
              title="تخطي هذا الكويز والانتقال للكويز التالي"
            >
              ${getIcon('clock', 16, '#b45309')}
              <span>تخطي هذا الكويز</span>
            </button>
            <button 
              class="btn btn-primary" 
              onclick="window.centrlyApp.saveCurrentQuizScores()"
              style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;"
            >
              ${getIcon('check', 16)}
              <span>حفظ ورصد درجات الكويز</span>
            </button>
            <button 
              id="btnDispatchBatchQuizScoresTop"
              class="btn btn-primary" 
              onclick="window.centrlyApp.dispatchBatchQuizScores()"
              style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; background: #25D366; border-color: #25D366; color: #fff; box-shadow: 0 2px 8px rgba(37,211,102,0.25);"
              title="إرسال درجات الكويز لجميع أولياء الأمور عبر واتساب مع نظام الأمان وفواصل زحف عشوائية"
            >
              ${getIcon('whatsapp', 16, '#ffffff')}
              <span>إرسال درجات الكويز بالواتساب (${gradedCount} طلاب)</span>
            </button>
          </div>

        </div>
      </div>

      <!-- Quiz Overview KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">اسم الكويز الحالي</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${escapeHtml(currentQuiz.title || `كويز ${currentQuiz.number}`)}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            الدرجة العظمى: ${currentQuiz.maxScore || 10} درجات
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نسبة الطلاب المصحح لهم</div>
          <div style="font-size: 1.6rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
            ${completionRate}% <span style="font-size: 0.85rem; font-weight: 600; color: var(--centrly-text);">(${gradedCount} / ${groupStudents.length})</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            ${groupStudents.length - gradedCount > 0 ? `${groupStudents.length - gradedCount} طلاب لم تُرصد درجاتهم بعد` : 'تم رصد درجات كافة الطلاب'}
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #6366f1;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">متوسط الدرجات</div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #6366f1; margin-top: 0.35rem;">
            ${avgScore} <span style="font-size: 0.85rem; font-weight: 500;">/ ${currentQuiz.maxScore || 10}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            أعلى درجة مسجلة: ${highestScore} من ${currentQuiz.maxScore || 10}
          </div>
        </div>

      </div>

      <!-- Students Quiz Grading Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('students', 18, 'var(--centrly-blue-700)')}
              <span>كشف رصد درجات الطلاب (${escapeHtml(activeGroup?.name || 'المجموعة')})</span>
            </h3>
            <span style="font-size: 0.78rem; color: var(--centrly-text);">
              يمكنك إدخال الدرجة من لوحة المفاتيح والضغط على Tab للانتقال للطالب التالي
            </span>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button 
              id="btnSaveQuizScoresTable"
              class="btn btn-primary" 
              onclick="window.centrlyApp.saveCurrentQuizScores()"
              style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 800; font-size: 0.9rem; background: var(--centrly-blue-700); border-color: var(--centrly-blue-700); color: #fff; padding: 0.55rem 1.25rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(37, 99, 235, 0.25); cursor: pointer;"
              title="حفظ ورصد درجات الكويز وتثبيتها في قاعدة البيانات"
            >
              ${getIcon('check', 18, '#ffffff')}
              <span>حفظ ورصد درجات الكويز ✓</span>
            </button>
          </div>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 70px;">كود الطالب</th>
                <th>اسم الطالب</th>
                <th>هاتف ولي الأمر</th>
                <th style="width: 160px; text-align: center;">الدرجة (من ${currentQuiz.maxScore || 10})</th>
                <th>حالة التصحيح</th>
                <th>ملاحظات على الإجابة</th>
                <th style="width: 140px; text-align: center;">إشعار ولي الأمر</th>
              </tr>
            </thead>
            <tbody>
              ${groupStudents.length > 0 ? groupStudents.map(s => {
                const score = currentScores[s.id] !== undefined && currentScores[s.id] !== null ? currentScores[s.id] : '';
                const isGraded = score !== '';
                const maxScore = currentQuiz.maxScore || 10;
                let statusBadge = '<span class="badge badge-secondary">لم يُصحح بعد</span>';
                if (isGraded) {
                  const pct = (Number(score) / maxScore) * 100;
                  if (pct >= 85) statusBadge = '<span class="badge badge-success">ممتاز</span>';
                  else if (pct >= 65) statusBadge = '<span class="badge badge-blue">جيد</span>';
                  else statusBadge = '<span class="badge badge-danger">يحتاج متابعة</span>';
                }

                const deliveryStatus = state.deliveryStatusMap?.[currentQuiz.number]?.[s.id];

                return `
                  <tr>
                    <td style="font-family: monospace; font-weight: 700; color: var(--centrly-blue-800);">${escapeHtml(s.code || s.student_code || s.id.slice(0, 4))}</td>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(s.name)}</td>
                    <td dir="ltr" style="text-align: right; font-family: monospace; font-size: 0.85rem; color: var(--centrly-text);">${escapeHtml(s.parent_phone || '—')}</td>
                    <td style="text-align: center;">
                      <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                        <input 
                          type="number" 
                          min="0" 
                          max="${maxScore}" 
                          step="0.5"
                          class="form-input quiz-score-input" 
                          data-student-id="${escapeHtml(s.id)}"
                          value="${escapeHtml(score)}"
                          placeholder="—"
                          style="width: 80px; text-align: center; font-weight: 800; font-family: monospace; font-size: 1rem; border-color: ${isGraded ? 'var(--centrly-success)' : 'var(--centrly-line)'};"
                          oninput="window.centrlyApp.updateStudentQuizScore('${escapeHtml(s.id)}', this.value)"
                        >
                        <span style="font-size: 0.85rem; color: var(--centrly-text); font-weight: 600;">/ ${maxScore}</span>
                      </div>
                    </td>
                    <td>${statusBadge}</td>
                    <td>
                      <input 
                        type="text" 
                        class="form-input" 
                        data-note-student-id="${escapeHtml(s.id)}"
                        placeholder="ملاحظة خاصة على الأداء..."
                        style="padding: 0.3rem 0.6rem; font-size: 0.825rem;"
                        value="${escapeHtml(state.notesMap?.[currentQuiz.number]?.[s.id] || '')}"
                        onchange="window.centrlyApp.updateStudentQuizNote('${escapeHtml(s.id)}', this.value)"
                      >
                    </td>
                    <td style="text-align: center;">
                      ${(() => {
                        if (deliveryStatus === 'sent') {
                          return `
                            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                              <span class="badge badge-success" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">
                                ${getIcon('check', 12, '#15803d')} تم الإرسال
                              </span>
                              <button 
                                class="btn btn-secondary btn-sm" 
                                onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${escapeHtml(s.name).replace(/'/g, "\\'")}', '${escapeHtml(currentQuiz.title || `كويز ${currentQuiz.number}`)}')"
                                style="padding: 0.2rem 0.4rem;"
                                title="إعادة إرسال النتيجة لولي الأمر"
                              >
                                ${getIcon('whatsapp', 13, '#15803d')}
                              </button>
                            </div>
                          `;
                        }
                        if (deliveryStatus === 'failed') {
                          return `
                            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                              <span class="badge badge-danger" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">
                                لم يتم التسليم
                              </span>
                              <button 
                                class="btn btn-secondary btn-sm" 
                                onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${escapeHtml(s.name).replace(/'/g, "\\'")}', '${escapeHtml(currentQuiz.title || `كويز ${currentQuiz.number}`)}')"
                                style="padding: 0.2rem 0.4rem; color: #dc2626;"
                                title="إعادة المحاولة"
                              >
                                ${getIcon('whatsapp', 13, '#dc2626')} إعادة
                              </button>
                            </div>
                          `;
                        }
                        return `
                          <button 
                            class="btn btn-secondary btn-sm" 
                            onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${escapeHtml(s.name).replace(/'/g, "\\'")}', '${escapeHtml(currentQuiz.title || `كويز ${currentQuiz.number}`)}')"
                            style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #15803d;"
                            title="إرسال درجة الكويز لولي الأمر"
                          >
                            ${getIcon('whatsapp', 14, '#15803d')}
                            <span>إرسال</span>
                          </button>
                        `;
                      })()}
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا يوجد طلاب مقيدون في هذه المجموعة حالياً.
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
