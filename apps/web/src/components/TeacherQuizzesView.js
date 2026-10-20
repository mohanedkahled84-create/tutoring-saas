import { request } from "../services/api.js";
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

export function renderTeacherQuizzesView(state = {}, groups = [], students = [], isLoading = false, hasLoaded = true) {
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
    { id: 1, number: 1, title: 'كويز 1', maxScore: 10, date: '2026-09-01', skipped: false },
    { id: 2, number: 2, title: 'كويز 2', maxScore: 10, date: '2026-09-05', skipped: false },
    { id: 3, number: 3, title: 'كويز 3', maxScore: 10, date: '2026-09-08', skipped: false },
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

          <!-- Quick Action Buttons: Edit, Skip, Save, and WhatsApp Batch Dispatch -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button 
              class="btn btn-secondary" 
              onclick="window.centrlyApp.promptEditQuizTitle(${currentQuiz.number})"
              style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700; color: var(--centrly-blue-700);"
              title="تعديل اسم الكويز الحالي مباشرة"
            >
              ${getIcon('edit', 14)}
              <span>تعديل الاسم</span>
            </button>
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
          </div>

        </div>
      </div>

      <!-- Quiz Overview KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700); box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label for="quizTitleInput" style="font-size: 0.85rem; color: var(--centrly-text); font-weight: 800;">
              اسم / موضوع الكويز:
            </label>
            <span style="font-size: 0.75rem; color: var(--centrly-blue-700); font-weight: 800; background: #eff6ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bfdbfe; display: inline-flex; align-items: center; gap: 0.25rem;">
              ${getIcon('edit', 12)}
              <span>قابل للتعديل</span>
            </span>
          </div>
          <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem;">
            <input 
              id="quizTitleInput"
              type="text" 
              class="form-input" 
              value="${escapeHtml(currentQuiz.title || `كويز ${currentQuiz.number}`)}" 
              placeholder="اكتب اسم الكويز هنا..."
              style="font-size: 0.95rem; font-weight: 800; color: var(--centrly-ink); padding: 0.45rem 0.65rem; border: 2px solid var(--centrly-blue-700); background: #f8fafc; border-radius: 6px; flex: 1;"
              onchange="window.centrlyApp.updateQuizTitle(${currentQuiz.number}, this.value)"
              onblur="window.centrlyApp.updateQuizTitle(${currentQuiz.number}, this.value)"
              onkeydown="if(event.key === 'Enter'){ window.centrlyApp.updateQuizTitle(${currentQuiz.number}, this.value); this.blur(); }"
            />
            <button 
              class="btn btn-primary" 
              style="padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 800; white-space: nowrap;"
              onclick="window.centrlyApp.updateQuizTitle(${currentQuiz.number}, document.getElementById('quizTitleInput').value)"
              title="حفظ اسم الكويز"
            >
              حفظ
            </button>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem; font-size: 0.82rem; color: var(--centrly-text);">
            <span style="font-weight: 700;">الدرجة العظمى للكويز:</span>
            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <input 
                id="quizMaxScoreInput"
                type="number" 
                min="1" 
                max="200" 
                step="1"
                class="form-input" 
                value="${currentQuiz.maxScore || 10}" 
                style="width: 70px; text-align: center; padding: 0.25rem 0.35rem; font-weight: 800; font-size: 0.9rem; border: 1.5px solid var(--centrly-line); border-radius: 6px;"
                onchange="window.centrlyApp.updateQuizMaxScore(${currentQuiz.number}, this.value)"
                onblur="window.centrlyApp.updateQuizMaxScore(${currentQuiz.number}, this.value)"
                onkeydown="if(event.key === 'Enter'){ window.centrlyApp.updateQuizMaxScore(${currentQuiz.number}, this.value); this.blur(); }"
              />
              <span style="font-weight: 700;">درجات</span>
            </div>
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
              <span>حفظ ورصد درجات الكويز</span>
            </button>
          </div>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 70px;">كود الطالب</th>
                <th>اسم الطالب</th>
                <th style="width: 175px;">بيانات التواصل</th>
                <th style="width: 160px; text-align: center;">الدرجة (من ${currentQuiz.maxScore || 10})</th>
                <th>حالة التصحيح</th>
                <th>ملاحظات على الإجابة</th>
                <th style="width: 175px; text-align: center;">إشعار النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${((isLoading || !hasLoaded) && groupStudents.length === 0) ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2rem 1rem; background: #ffffff; border-bottom: 1px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; justify-content: center;">
                      <svg class="centrly-sleek-spinner" viewBox="0 0 50 50" style="width: 36px; height: 36px;">
                        <defs>
                          <linearGradient id="centrlySleekGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#1e3a8a" />
                            <stop offset="50%" stop-color="#2563eb" />
                            <stop offset="100%" stop-color="#60a5fa" />
                          </linearGradient>
                        </defs>
                        <circle class="spinner-track" cx="25" cy="25" r="20" fill="none" stroke-width="3.5" />
                        <circle class="spinner-head" cx="25" cy="25" r="20" fill="none" stroke="url(#centrlySleekGradient)" stroke-width="3.5" />
                      </svg>
                    </div>
                  </td>
                </tr>
                ${[1, 2, 3, 4, 5].map(() => `
                  <tr class="skeleton-row">
                    <td><span class="skeleton-box" style="width: 50px; height: 18px;"></span></td>
                    <td><span class="skeleton-box" style="width: 130px; height: 18px;"></span></td>
                    <td><span class="skeleton-box" style="width: 110px; height: 18px;"></span></td>
                    <td><span class="skeleton-box" style="width: 60px; height: 24px; border-radius: 6px; margin: 0 auto;"></span></td>
                    <td><span class="skeleton-box" style="width: 70px; height: 20px; border-radius: 10px;"></span></td>
                    <td><span class="skeleton-box" style="width: 90px; height: 18px;"></span></td>
                    <td><span class="skeleton-box" style="width: 80px; height: 24px; border-radius: 6px; margin: 0 auto;"></span></td>
                  </tr>
                `).join('')}
              ` : groupStudents.length > 0 ? groupStudents.map(s => {
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
                const hasParentPhone = Boolean(s.parent_phone && s.parent_phone.trim());
                const hasStudentPhone = Boolean((s.student_phone || s.phone) && (s.student_phone || s.phone).trim());
                const quizTitleSafe = escapeHtml(currentQuiz.title || `كويز ${currentQuiz.number}`).replace(/'/g, "\\'");
                const studentNameSafe = escapeHtml(s.name).replace(/'/g, "\\'");

                return `
                  <tr>
                    <td style="font-family: monospace; font-weight: 700; color: var(--centrly-blue-800);">${escapeHtml(s.code || s.student_code || s.id.slice(0, 4))}</td>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(s.name)}</td>
                    <td dir="ltr" style="text-align: right; font-size: 0.82rem;">
                      ${hasParentPhone ? `
                        <div style="font-family: monospace; color: var(--centrly-ink); font-weight: 600; font-size: 0.825rem;">
                          <span style="font-size: 0.7rem; font-family: sans-serif; color: var(--centrly-text); font-weight: 500;">ولي أمر:</span> ${escapeHtml(s.parent_phone)}
                        </div>
                      ` : ''}
                      ${hasStudentPhone ? `
                        <div style="font-family: monospace; color: #2563eb; font-weight: 600; font-size: 0.825rem; margin-top: 2px;">
                          <span style="font-size: 0.7rem; font-family: sans-serif; color: #64748b; font-weight: 500;">طالب:</span> ${escapeHtml(s.student_phone || s.phone)}
                        </div>
                      ` : (!hasParentPhone ? '<span style="color: var(--centrly-text);">—</span>' : '')}
                    </td>
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
                          onwheel="this.blur()"
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
                        const defaultTarget = hasParentPhone ? 'parent' : (hasStudentPhone ? 'student' : 'parent');
                        if (deliveryStatus === 'sent') {
                          return `
                            <div style="display: inline-flex; align-items: center; gap: 0.35rem; justify-content: center; flex-wrap: wrap;">
                              <span class="badge badge-success" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">
                                ${getIcon('check', 12, '#15803d')} تم الإرسال
                              </span>
                              ${hasParentPhone && hasStudentPhone ? `
                                <div style="display: inline-flex; gap: 0.2rem;">
                                  <button 
                                    class="btn btn-secondary btn-sm" 
                                    onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${studentNameSafe}', '${quizTitleSafe}', 'parent')"
                                    style="padding: 0.2rem 0.35rem; font-size: 0.7rem; color: #15803d;"
                                    title="إعادة إرسال لولي الأمر"
                                  >
                                    ${getIcon('whatsapp', 12, '#15803d')} ولي أمر
                                  </button>
                                  <button 
                                    class="btn btn-secondary btn-sm" 
                                    onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${studentNameSafe}', '${quizTitleSafe}', 'student')"
                                    style="padding: 0.2rem 0.35rem; font-size: 0.7rem; color: #2563eb;"
                                    title="إعادة إرسال للطالب"
                                  >
                                    ${getIcon('whatsapp', 12, '#2563eb')} طالب
                                  </button>
                                </div>
                              ` : `
                                <button 
                                  class="btn btn-secondary btn-sm" 
                                  onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${studentNameSafe}', '${quizTitleSafe}', '${defaultTarget}')"
                                  style="padding: 0.2rem 0.4rem;"
                                  title="إعادة إرسال النتيجة"
                                >
                                  ${getIcon('whatsapp', 13, '#15803d')}
                                </button>
                              `}
                            </div>
                          `;
                        }
                        if (deliveryStatus === 'failed') {
                          return `
                            <div style="display: inline-flex; align-items: center; gap: 0.35rem; justify-content: center;">
                              <span class="badge badge-danger" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;">
                                لم يتم التسليم
                              </span>
                              <button 
                                class="btn btn-secondary btn-sm" 
                                onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${studentNameSafe}', '${quizTitleSafe}', '${defaultTarget}')"
                                style="padding: 0.2rem 0.4rem; color: #dc2626;"
                                title="إعادة المحاولة"
                              >
                                ${getIcon('whatsapp', 13, '#dc2626')} إعادة
                              </button>
                            </div>
                          `;
                        }
                        if (hasParentPhone && hasStudentPhone) {
                          return `
                            <div style="display: inline-flex; align-items: center; gap: 0.35rem; justify-content: center; flex-wrap: wrap;">
                              <button 
                                class="btn btn-secondary btn-sm" 
                                onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${studentNameSafe}', '${quizTitleSafe}', 'parent')"
                                style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #15803d; font-weight: 700; padding: 0.25rem 0.55rem;"
                                title="إرسال درجة الكويز لولي الأمر عبر واتساب"
                              >
                                ${getIcon('whatsapp', 13, '#15803d')}
                                <span>ولي الأمر</span>
                              </button>
                              <button 
                                class="btn btn-secondary btn-sm" 
                                onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${studentNameSafe}', '${quizTitleSafe}', 'student')"
                                style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #2563eb; font-weight: 700; padding: 0.25rem 0.55rem;"
                                title="إرسال درجة الكويز للطالب عبر واتساب"
                              >
                                ${getIcon('whatsapp', 13, '#2563eb')}
                                <span>الطالب</span>
                              </button>
                            </div>
                          `;
                        } else if (hasStudentPhone) {
                          return `
                            <button 
                              class="btn btn-secondary btn-sm" 
                              onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${studentNameSafe}', '${quizTitleSafe}', 'student')"
                              style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #2563eb; font-weight: 700; padding: 0.25rem 0.55rem;"
                              title="إرسال درجة الكويز للطالب عبر واتساب"
                            >
                              ${getIcon('whatsapp', 14, '#2563eb')}
                              <span>الطالب</span>
                            </button>
                          `;
                        } else {
                          return `
                            <button 
                              class="btn btn-secondary btn-sm" 
                              onclick="window.centrlyApp.sendQuizScoreWhatsApp('${escapeHtml(s.id)}', '${studentNameSafe}', '${quizTitleSafe}', 'parent')"
                              style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #15803d; font-weight: 700; padding: 0.25rem 0.55rem;"
                              title="إرسال درجة الكويز لولي الأمر عبر واتساب"
                            >
                              ${getIcon('whatsapp', 14, '#15803d')}
                              <span>ولي الأمر</span>
                            </button>
                          `;
                        }
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

export function registerTeacherQuizzesActions(app) {
  // Teacher Quizzes Management & WhatsApp Integration (DEV-QUIZ)
  // ==========================================================================

  app.saveQuizzesToLocalStorage = function(groupId) {
    const gid = groupId || this.quizzesState.selectedGroupId;
    if (!gid) return;
    try {
      localStorage.setItem(`centrly_quizzes_${gid}`, JSON.stringify({
        quizzes: this.quizzesState.quizzes,
        scoresMap: this.quizzesState.scoresMap,
        notesMap: this.quizzesState.notesMap,
        deliveryStatusMap: this.quizzesState.deliveryStatusMap,
        currentQuizNumber: this.quizzesState.currentQuizNumber,
      }));
    } catch (_) {}
  }

  app.loadQuizzesForGroup = async function(groupId) {
    if (!groupId) return;
    // 1. Fast local cache recovery to prevent data loss on refresh
    const cacheKey = `centrly_quizzes_${groupId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.quizzes) && parsed.quizzes.length > 0) {
          parsed.quizzes.forEach(q => {
            if (q.title && (q.title.includes('أساسيات المادة') || q.title.includes('الفصل الأول') || q.title.includes('مراجعة شاملة'))) {
              q.title = `كويز ${q.number}`;
            }
          });
          this.quizzesState.quizzes = parsed.quizzes;
        }
        if (parsed.scoresMap) {
          this.quizzesState.scoresMap = { ...this.quizzesState.scoresMap, ...parsed.scoresMap };
        }
        if (parsed.notesMap) {
          this.quizzesState.notesMap = { ...this.quizzesState.notesMap, ...parsed.notesMap };
        }
        if (parsed.deliveryStatusMap) {
          this.quizzesState.deliveryStatusMap = { ...this.quizzesState.deliveryStatusMap, ...parsed.deliveryStatusMap };
        }
        if (parsed.currentQuizNumber) {
          this.quizzesState.currentQuizNumber = parsed.currentQuizNumber;
        }
      }
    } catch (_) {}

    // 2. Fetch authoritative data from backend Supabase API
    try {
      const res = await request(`/quizzes?group_id=${groupId}`);
      if (res?.success && Array.isArray(res.quizzes) && res.quizzes.length > 0) {
        this.quizzesState.quizzes = res.quizzes.map(q => {
          let cleanTitle = q.title || `كويز ${q.quiz_number}`;
          if (cleanTitle.includes('أساسيات المادة') || cleanTitle.includes('الفصل الأول') || cleanTitle.includes('مراجعة شاملة')) {
            cleanTitle = `كويز ${q.quiz_number}`;
          }
          return {
            id: q.id,
            number: q.quiz_number,
            title: cleanTitle,
            maxScore: Number(q.max_score || 10),
            date: q.quiz_date || new Date().toISOString().slice(0, 10),
            skipped: Boolean(q.is_skipped),
          };
        });

        if (res.scores_map) {
          this.quizzesState.scoresMap = {
            ...this.quizzesState.scoresMap,
            ...res.scores_map,
          };
        }
        if (res.notes_map) {
          this.quizzesState.notesMap = {
            ...this.quizzesState.notesMap,
            ...res.notes_map,
          };
        }
        if (res.delivery_status_map) {
          this.quizzesState.deliveryStatusMap = {
            ...this.quizzesState.deliveryStatusMap,
            ...res.delivery_status_map,
          };
        }

        this.saveQuizzesToLocalStorage(groupId);
      }
    } catch (err) {
      console.warn('[Centrly] Could not fetch quizzes from backend, using cached state:', err);
    }
  }

  app.switchQuizGroup = async function(groupId) {
    this.quizzesState.selectedGroupId = groupId;
    this.renderMainContent();
    await this.loadQuizzesForGroup(groupId);
    this.renderMainContent();
  }

  app.selectQuizNumber = function(quizNum) {
    this.quizzesState.currentQuizNumber = quizNum;
    this.saveQuizzesToLocalStorage();
    this.renderMainContent();
  }

  app.addNewQuiz = function() {
    const nextNum = (this.quizzesState.quizzes.length > 0)
      ? Math.max(...this.quizzesState.quizzes.map(q => q.number)) + 1
      : 1;
    const today = new Date().toISOString().slice(0, 10);
    const newQuizObj = {
      id: `quiz-tmp-${Date.now()}`,
      number: nextNum,
      title: `كويز ${nextNum}`,
      maxScore: 10,
      date: today,
      skipped: false,
    };
    this.quizzesState.quizzes.push(newQuizObj);
    this.quizzesState.currentQuizNumber = nextNum;
    this.saveQuizzesToLocalStorage();

    // Persist new quiz definition in background
    if (this.quizzesState.selectedGroupId) {
      request('/quizzes', {
        method: 'POST',
        body: {
          group_id: this.quizzesState.selectedGroupId,
          quiz_number: nextNum,
          title: `كويز ${nextNum}`,
          max_score: 10,
          quiz_date: today,
          is_skipped: false,
        },
      }).then(res => {
        if (res?.quiz?.id) {
          newQuizObj.id = res.quiz.id;
          this.saveQuizzesToLocalStorage();
        }
      }).catch(() => {});
    }

    this.showToast(`تمت إضافة كويز ${nextNum} بنجاح`, 'success');
    this.renderMainContent();
  }

  app.skipCurrentQuiz = function(quizNum) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.skipped = true;
      const nextQuiz = this.quizzesState.quizzes.find(q => q.number > quizNum && !q.skipped);
      if (nextQuiz) {
        this.quizzesState.currentQuizNumber = nextQuiz.number;
      }
      this.saveQuizzesToLocalStorage();

      // Persist skipped status in background
      if (this.quizzesState.selectedGroupId) {
        request('/quizzes', {
          method: 'POST',
          body: {
            group_id: this.quizzesState.selectedGroupId,
            quiz_number: quizNum,
            title: quiz.title || `كويز ${quizNum}`,
            max_score: quiz.maxScore || 10,
            is_skipped: true,
          },
        }).catch(() => {});
      }

      this.showToast(`تم تخطي كويز ${quizNum}`, 'info');
      this.renderMainContent();
    }
  }

  app.promptEditQuizTitle = function(quizNum) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    const currentTitle = quiz?.title || `كويز ${quizNum}`;
    const bodyHtml = `
      <form id="formEditQuizTitle" onsubmit="event.preventDefault(); window.centrlyApp.confirmEditQuizTitle(${quizNum});">
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700;">اسم الكويز / الاختبار</label>
          <input type="text" id="inputEditQuizTitle" class="form-input" value="${escapeHtml(currentTitle)}" placeholder="اسم الكويز / الاختبار" autofocus required>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.35rem;">
            أدخل عنواناً مميزاً للكويز لتسهيل تمييزه في تقارير الطلاب.
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 800;">حفظ الاسم</button>
        </div>
      </form>
    `;
    this.showModal(`تعديل اسم الكويز رقم (${quizNum})`, bodyHtml);
    setTimeout(() => {
      document.getElementById('inputEditQuizTitle')?.focus();
    }, 150);
  }

  app.confirmEditQuizTitle = function(quizNum) {
    const newTitle = document.getElementById('inputEditQuizTitle')?.value?.trim();
    this.closeModal();
    this.updateQuizTitle(quizNum, newTitle);
  }

  app.updateQuizTitle = function(quizNum, newTitle) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.title = newTitle ? newTitle.trim() : `كويز ${quizNum}`;
      this.saveQuizzesToLocalStorage();

      if (this.quizzesState.selectedGroupId) {
        request('/quizzes', {
          method: 'POST',
          body: {
            id: quiz.id && quiz.id.length > 20 ? quiz.id : undefined,
            group_id: this.quizzesState.selectedGroupId,
            quiz_number: quizNum,
            title: quiz.title,
            max_score: quiz.maxScore || 10,
            is_skipped: Boolean(quiz.skipped),
          },
        }).then(res => {
          if (res?.quiz?.id) {
            quiz.id = res.quiz.id;
            this.saveQuizzesToLocalStorage();
          }
        }).catch(() => {});
      }
      this.showToast('تم تحديث عنوان الكويز بنجاح', 'info');
      this.renderMainContent();
    }
  }

  app.updateQuizMaxScore = function(quizNum, newMaxScore) {
    const num = Number(newMaxScore);
    if (isNaN(num) || num <= 0) return;
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.maxScore = num;
      this.saveQuizzesToLocalStorage();

      if (this.quizzesState.selectedGroupId) {
        request('/quizzes', {
          method: 'POST',
          body: {
            id: quiz.id && quiz.id.length > 20 ? quiz.id : undefined,
            group_id: this.quizzesState.selectedGroupId,
            quiz_number: quizNum,
            title: quiz.title || `كويز ${quizNum}`,
            max_score: num,
            is_skipped: Boolean(quiz.skipped),
          },
        }).then(res => {
          if (res?.quiz?.id) {
            quiz.id = res.quiz.id;
            this.saveQuizzesToLocalStorage();
          }
        }).catch(() => {});
      }
      this.showToast(`تم تحديث الدرجة العظمى إلى (${num} درجات)`, 'info');
      this.renderMainContent();
    }
  }

  app.updateStudentQuizScore = function(studentId, score) {
    const currQuiz = this.quizzesState.currentQuizNumber || 1;
    if (!this.quizzesState.scoresMap[currQuiz]) {
      this.quizzesState.scoresMap[currQuiz] = {};
    }
    this.quizzesState.scoresMap[currQuiz][studentId] = score;
    this.saveQuizzesToLocalStorage();
  }

  app.updateStudentQuizNote = function(studentId, note) {
    const currQuiz = this.quizzesState.currentQuizNumber || 1;
    if (!this.quizzesState.notesMap[currQuiz]) {
      this.quizzesState.notesMap[currQuiz] = {};
    }
    this.quizzesState.notesMap[currQuiz][studentId] = note;
    this.saveQuizzesToLocalStorage();
  }

  app.saveCurrentQuizScores = async function() {
    if (this.quizzesState.isSaving) return;
    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = this.quizzesState.quizzes.find(q => q.number === currQuizNum) || { maxScore: 10 };
    const scores = this.quizzesState.scoresMap[currQuizNum] || {};
    const notes = this.quizzesState.notesMap[currQuizNum] || {};

    const count = Object.keys(scores).filter(k => scores[k] !== '' && scores[k] !== null).length;
    if (count === 0) {
      this.showToast('يرجى إدخال درجة طالب واحد على الأقل قبل الحفظ', 'warning');
      return;
    }

    this.quizzesState.isSaving = true;
    try {
      this.saveQuizzesToLocalStorage();
      await request('/quizzes/scores', {
        method: 'POST',
        body: {
          group_id: this.quizzesState.selectedGroupId,
          quiz_number: currQuizNum,
          quiz_title: currentQuiz.title || `كويز ${currQuizNum}`,
          max_score: currentQuiz.maxScore || 10,
          scores,
          notes,
        },
      });

      // Synchronize in-memory with reportsState
      if (this.reportsState) {
        const month = this.reportsState.period?.month || (new Date().getMonth() + 1);
        const year = this.reportsState.period?.year || new Date().getFullYear();
        request(`/reports/monthly?month=${month}&year=${year}`).then(rep => {
          if (rep?.leaderboard) {
            this.reportsState.leaderboard = rep.leaderboard;
            this.reportsState.average_score = rep.average_score || 0;
          }
        }).catch(() => {});
      }

      this.showToast(`تم حفظ وتثبيت درجات كويز ${currQuizNum} لـ (${count}) طالب بنجاح! وستظهر فوراً في بوابات المتابعة`, 'success');
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل حفظ درجات الكويز: ${err.message || 'خطأ في الخادم'}`, 'danger');
    } finally {
      this.quizzesState.isSaving = false;
    }
  }

  app.sendQuizScoreWhatsApp = async function(studentId, studentName, quizTitle, target = 'both') {
    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = this.quizzesState.quizzes.find(q => q.number === currQuizNum) || { maxScore: 10 };
    const score = this.quizzesState.scoresMap[currQuizNum]?.[studentId];
    const note = this.quizzesState.notesMap[currQuizNum]?.[studentId] || '';

    if (score === undefined || score === null || score === '') {
      this.showToast(`يرجى رصد درجة الطالب (${studentName}) أولاً قبل إرسال الإشعار`, 'warning');
      return;
    }

    const student = (this.students || []).find(s => String(s.id) === String(studentId));
    const rawParentPhone = student?.parent_phone || student?.parentPhone || '';
    const rawStudentPhone = student?.student_phone || student?.studentPhone || student?.phone || '';

    const cleanPhone = (phone) => {
      let p = (phone || '').replace(/[\s\-\+\(\)]/g, '');
      if (p.startsWith('00')) p = p.slice(2);
      if (p.startsWith('01') && p.length === 11) p = '20' + p.slice(1);
      return p;
    };

    const cleanParent = cleanPhone(rawParentPhone);
    const cleanStudent = cleanPhone(rawStudentPhone);

    const maxScore = currentQuiz.maxScore || 10;
    const numScore = Number(score);
    const percentage = (numScore / maxScore) * 100;
    const rating = percentage >= 85 ? 'ممتاز 🌟' : percentage >= 65 ? 'جيد 👍' : 'يحتاج لمزيد من المذاكرة والاجتهاد 📝';
    const displayTitle = (quizTitle && quizTitle.trim()) ? quizTitle.trim() : `كويز ${currQuizNum}`;

    const rawTeacher = this.user?.name || 'المعلم';
    const teacherName = rawTeacher.startsWith('مستر') || rawTeacher.startsWith('أ.') || rawTeacher.startsWith('أستاذ')
      ? rawTeacher
      : `مستر ${rawTeacher}`;

    const studentMsg = `أهلاً بك يا (${studentName})، نتمنى لك دوام التفوق والتميز دائماً!\n\n📊 *نتيجة تقييم:* ${displayTitle}\n🎯 *درجتك:* ${numScore} من ${maxScore} (${rating})\n${note && note.trim() ? `📝 *ملاحظة المعلم:* ${note.trim()}\n` : ''}\nمع أطيب التمنيات لك بدوام التميز والإنجاز.\nمع تحيات: ${teacherName}`;

    const parentMsg = `السلام عليكم ورحمة الله وبركاته، تحية طيبة لولي أمر الطالب/ة (${studentName}).\n\nيسعدنا إحاطة سيادتكم علماً بنتيجة الاختبار الأخير:\n📊 *الاختبار:* ${displayTitle}\n🎯 *الدرجة المحققة:* ${numScore} من ${maxScore} (${rating})\n${note && note.trim() ? `📝 *ملاحظة المعلم:* ${note.trim()}\n` : ''}\nشاكرين لكم حسن تعاونكم وحرصكم المستمر على متابعة تفوق الطالب.\nمع تحيات: ${teacherName}`;

    if (!this.quizzesState.deliveryStatusMap) this.quizzesState.deliveryStatusMap = {};
    if (!this.quizzesState.deliveryStatusMap[currQuizNum]) this.quizzesState.deliveryStatusMap[currQuizNum] = {};

    if (target === 'student') {
      if (!cleanStudent || cleanStudent.length < 9) {
        this.showToast(`رقم هاتف الطالب غير مسجل للطالب "${studentName}".`, 'warning');
        return;
      }
      const waUrl = `https://wa.me/${cleanStudent}?text=${encodeURIComponent(studentMsg)}`;
      window.open(waUrl, '_blank');
      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = 'sent';
      this.saveQuizzesToLocalStorage();
      this.showToast(`تم فتح محادثة واتساب للطالب (${studentName}) بنجاح! 💬`, 'success');
      this.renderMainContent();
      return;
    }

    if (target === 'parent') {
      if (!cleanParent || cleanParent.length < 9) {
        this.showToast(`رقم هاتف ولي الأمر غير مسجل للطالب "${studentName}".`, 'warning');
        return;
      }
      const waUrl = `https://wa.me/${cleanParent}?text=${encodeURIComponent(parentMsg)}`;
      window.open(waUrl, '_blank');
      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = 'sent';
      this.saveQuizzesToLocalStorage();
      this.showToast(`تم فتح محادثة واتساب لولي أمر (${studentName}) بنجاح! 💬`, 'success');
      this.renderMainContent();
      return;
    }

    // target === 'both' or default
    if (cleanParent && cleanStudent) {
      const parentWaUrl = `https://wa.me/${cleanParent}?text=${encodeURIComponent(parentMsg)}`;
      const studentWaUrl = `https://wa.me/${cleanStudent}?text=${encodeURIComponent(studentMsg)}`;

      // Open parent chat immediately
      window.open(parentWaUrl, '_blank');

      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = 'sent';
      this.saveQuizzesToLocalStorage();
      this.renderMainContent();

      // Show instant modal to open student chat as well
      this.showModal(
        `إرسال النتيجة: ${studentName}`,
        `<div style="text-align: center; padding: 1.25rem 0.5rem;" dir="rtl">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🎉</div>
          <h3 style="font-weight: 800; font-size: 1.1rem; color: #1e293b; margin-bottom: 0.4rem;">تم فتح محادثة ولي الأمر بنجاح!</h3>
          <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 1.25rem; line-height: 1.6;">تم فتح واتساب لولي الأمر (${escapeHtml(rawParentPhone)}) وتجهيز نص النتيجة.<br>اضغط بالأسفل لفتح محادثة الطالب أيضاً بنقرة واحدة:</p>
          <div style="display: flex; flex-direction: column; gap: 0.6rem; max-width: 320px; margin: 0 auto;">
            <a href="${studentWaUrl}" target="_blank" onclick="window.centrlyApp.closeModal(); window.centrlyApp.showToast('تم فتح محادثة الطالب (${escapeHtml(studentName)}) بنجاح! 💬', 'success');" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: #2563eb; border-color: #2563eb; font-weight: 700; text-decoration: none; padding: 0.65rem 1rem;">
              <span>💬 فتح محادثة الطالب (${escapeHtml(rawStudentPhone)})</span>
            </a>
            <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()" style="font-size: 0.85rem;">
              تم الاكتفاء بولي الأمر
            </button>
          </div>
        </div>`,
        ''
      );
      return;
    }

    if (cleanParent) {
      const waUrl = `https://wa.me/${cleanParent}?text=${encodeURIComponent(parentMsg)}`;
      window.open(waUrl, '_blank');
      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = 'sent';
      this.saveQuizzesToLocalStorage();
      this.showToast(`تم فتح محادثة واتساب لولي أمر (${studentName}) بنجاح! 💬`, 'success');
      this.renderMainContent();
      return;
    }

    if (cleanStudent) {
      const waUrl = `https://wa.me/${cleanStudent}?text=${encodeURIComponent(studentMsg)}`;
      window.open(waUrl, '_blank');
      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = 'sent';
      this.saveQuizzesToLocalStorage();
      this.showToast(`تم فتح محادثة واتساب للطالب (${studentName}) بنجاح! 💬`, 'success');
      this.renderMainContent();
      return;
    }

    this.showToast(`لا يوجد رقم هاتف مسجل للطالب أو لولي أمره لإرسال النتيجة.`, 'warning');
  }

  app.dispatchBatchQuizScores = function() {
    if (this.sessionState.isDispatchingQuizWhatsApp) {
      this.showToast('عملية الإرسال قيد التنفيذ بالفعل مع فواصل الأمان الفائق...', 'warning');
      return;
    }

    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = this.quizzesState.quizzes.find(q => q.number === currQuizNum) || { maxScore: 10 };
    const scores = this.quizzesState.scoresMap[currQuizNum] || {};
    const notes = this.quizzesState.notesMap[currQuizNum] || {};

    const selectedGroupId = this.quizzesState.selectedGroupId;
    const groupStudents = (this.students || []).filter(s => {
      if (!selectedGroupId) return true;
      if (String(s.group_id) === String(selectedGroupId) || String(s.groupId) === String(selectedGroupId)) return true;
      if (Array.isArray(s.group_ids) && s.group_ids.some(gid => String(gid) === String(selectedGroupId))) return true;
      return false;
    });

    const studentsToDispatch = groupStudents
      .filter(s => scores[s.id] !== undefined && scores[s.id] !== null && scores[s.id] !== '')
      .map(s => ({
        student_id: s.id,
        student_name: s.name,
        parent_phone: s.parent_phone || '',
        student_phone: s.student_phone || s.phone || '',
        score: Number(scores[s.id]),
        note: notes[s.id] || undefined,
      }));

    if (studentsToDispatch.length === 0) {
      this.showToast('لا يوجد طلاب مرصودة درجاتهم في هذا الكويز للإرسال الجماعي. يرجى رصد الدرجات أولاً.', 'warning');
      return;
    }

    const existing = document.getElementById('centrlyConfirmModal');
    if (existing) existing.remove();

    const modalEl = document.createElement('div');
    modalEl.id = 'centrlyConfirmModal';
    modalEl.className = 'modal-overlay';
    modalEl.style.cssText = `
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      overflow-y: auto;
    `;
    modalEl.innerHTML = `
      <div class="modal-dialog" dir="rtl" style="background: #ffffff; border-radius: 14px; max-width: 480px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid var(--centrly-line); margin: auto; max-height: calc(100vh - 2rem); display: flex; flex-direction: column;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--centrly-line); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink);">
            إرسال درجات الكويز عبر واتساب
          </h3>
          <button onclick="document.getElementById('centrlyConfirmModal')?.remove()" style="background: transparent; border: none; cursor: pointer; color: var(--centrly-text); display: flex; align-items: center;">${getIcon('close', 16, 'currentColor')}</button>
        </div>
        <div style="padding: 1.5rem; font-size: 0.925rem; color: var(--centrly-ink); line-height: 1.6;">
          <p style="margin: 0 0 1rem 0;">
            هل أنت متأكد من رغبتك في إرسال درجات (<strong>${studentsToDispatch.length}</strong>) طالب عبر الواتساب؟
            <br>
            <span style="font-size: 0.825rem; color: var(--centrly-text);">سيتم إرسال الرسائل بفواصل زمنية تلقائية لضمان وصولها بسلاسة.</span>
          </p>

          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 1rem;">
            <div style="font-weight: 800; font-size: 0.875rem; color: var(--centrly-ink); margin-bottom: 0.65rem;">
              اختر جهة استلام النتيجة:
            </div>
            <label style="display: flex; align-items: flex-start; gap: 0.6rem; margin-bottom: 0.6rem; cursor: pointer; font-size: 0.88rem;">
              <input type="radio" name="quizBatchTarget" value="both" checked style="margin-top: 3px;" />
              <div>
                <strong>ولي الأمر والطالب معاً</strong> <span style="font-size: 0.75rem; color: #15803d; background: #dcfce7; padding: 1px 6px; border-radius: 4px; font-weight: 700;">موصى به</span>
                <div style="font-size: 0.78rem; color: var(--centrly-text);">إرسال رسالة تقرير لولي الأمر، ورسالة تشجيعية منفصلة للطالب</div>
              </div>
            </label>
            <label style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; cursor: pointer; font-size: 0.88rem;">
              <input type="radio" name="quizBatchTarget" value="parents" />
              <span>أولياء الأمور فقط</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.88rem;">
              <input type="radio" name="quizBatchTarget" value="students" />
              <span>الطلاب فقط</span>
            </label>
          </div>
        </div>
        <div style="padding: 1rem 1.5rem; background: var(--centrly-surface); border-top: 1px solid var(--centrly-line); display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button id="confirmModalCancelBtn" class="btn" style="background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: 8px; cursor: pointer;">
            إلغاء
          </button>
          <button id="confirmModalActionBtn" class="btn" style="background: #25D366; color: #ffffff; border: none; font-weight: 800; padding: 0.5rem 1.4rem; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(37,211,102,0.35);">
            بدء الإرسال الآمن (${studentsToDispatch.length} طالب)
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    document.getElementById('confirmModalCancelBtn').onclick = () => {
      modalEl.remove();
    };

    document.getElementById('confirmModalActionBtn').onclick = async () => {
      const selectedTarget = document.querySelector('input[name="quizBatchTarget"]:checked')?.value || 'both';
      modalEl.remove();

      if (this.sessionState.isDispatchingQuizWhatsApp) return;
      this.sessionState.isDispatchingQuizWhatsApp = true;
      try {
        const targetLabel = selectedTarget === 'both' ? 'لأولياء الأمور والطلاب' : (selectedTarget === 'students' ? 'للطلاب' : 'لأولياء الأمور');
        this.showToast(`بدأت عملية الإرسال الآمن لدرجات الكويز ${targetLabel} بأعلى معايير الأمان...`, 'info');
        const res = await request('/quizzes/dispatch-scores', {
          method: 'POST',
          body: {
            group_id: selectedGroupId,
            quiz_number: currQuizNum,
            quiz_title: currentQuiz.title || `كويز ${currQuizNum}`,
            max_score: currentQuiz.maxScore || 10,
            students: studentsToDispatch,
            target: selectedTarget,
          },
        });

        if (!this.quizzesState.deliveryStatusMap) this.quizzesState.deliveryStatusMap = {};
        if (!this.quizzesState.deliveryStatusMap[currQuizNum]) this.quizzesState.deliveryStatusMap[currQuizNum] = {};

        if (Array.isArray(res?.results)) {
          res.results.forEach(r => {
            const sid = r.student_id || r.id;
            if (sid) {
              this.quizzesState.deliveryStatusMap[currQuizNum][sid] = (r.status === 'sent' || r.delivered) ? 'sent' : 'failed';
            }
          });
        } else {
          studentsToDispatch.forEach(s => {
            this.quizzesState.deliveryStatusMap[currQuizNum][s.student_id] = 'sent';
          });
        }

        this.saveQuizzesToLocalStorage();
        this.showToast(`تم إتمام إرسال درجات الكويز! (المرسل: ${res.sent_count || res.sent || studentsToDispatch.length} ، الفاشل: ${res.failed_count || res.failed || 0})`, 'success');
        this.renderMainContent();
      } catch (err) {
        this.showToast(`حدث خطأ أثناء الإرسال الجماعي: ${err.message || 'خطأ في الخادم'}`, 'danger');
      } finally {
        this.sessionState.isDispatchingQuizWhatsApp = false;
      }
    };
  }
}
