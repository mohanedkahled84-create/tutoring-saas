import { isUserPro } from "../utils/proGating.js";
import { request } from "../services/api.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Advanced Teacher Quizzes & Examination Engine
 * 5 Comprehensive Modules:
 * 1. roster: كشف ورصد الدرجات (In-class roster & WhatsApp dispatch)
 * 2. online_builder: إنشاء امتحان أونلاين (Online Exam Bank + Question-by-Question Wizard + Time Window)
 * 3. online_grading: تصحيح الامتحانات الإلكترونية (Eye manual essay grading + Graded results overview)
 * 4. paper_builder: إنشاء امتحان ورقي (Paper Exam Creator + Stealth Model Barcodes + A4 Printable Sheets)
 * 5. paper_scanner: تصحيح الامتحانات الورقية (Camera & Photo Barcode/OMR Bubble Sheet Scanner)
 */

export function renderTeacherQuizzesView(state = {}, groups = [], students = [], isLoading = false, hasLoaded = true, currentUser = null, currentRoute = 'online-quizzes') {
    const user = currentUser || (typeof window !== 'undefined' ? window.centrlyApp?.user : null);
  const userEmail = (user?.email || '').toLowerCase();
  const isAdmin = user?.role === 'admin' || user?.is_superadmin;
  const isPro = isUserPro(user);

  // تحديد الوجهة والتبويب النشط بهدوء ووضوح
  let effectiveRoute = currentRoute || (typeof window !== 'undefined' ? window.centrlyApp?.currentRoute : '') || 'online-quizzes';
  if (!['online-quizzes', 'paper-exams', 'quizzes'].includes(effectiveRoute)) {
    if (state.activeSubTab === 'roster') effectiveRoute = 'quizzes';
    else if (state.activeSubTab === 'paper_builder' || state.activeSubTab === 'paper_scanner') effectiveRoute = 'paper-exams';
    else effectiveRoute = 'online-quizzes';
  }

  let activeSubTab = state.activeSubTab;
  if (effectiveRoute === 'online-quizzes') {
    if (activeSubTab !== 'online_grading') activeSubTab = 'online_builder';
  } else if (effectiveRoute === 'paper-exams') {
    if (activeSubTab !== 'paper_scanner') activeSubTab = 'paper_builder';
  } else if (effectiveRoute === 'quizzes') {
    activeSubTab = 'roster';
  }
  state.activeSubTab = activeSubTab;

  if (!state.selectedGroupId && Array.isArray(groups) && groups.length > 0) {
    state.selectedGroupId = groups[0].id;
  }
  const selectedGroupId = state.selectedGroupId || (groups[0]?.id || '');
  const activeGroup = selectedGroupId === 'all' ? { id: 'all', name: 'جميع المجموعات (الكل)' } : (groups.find(g => g.id === selectedGroupId) || groups[0] || null);

  const groupStudents = (students || []).filter(s => {
    if (!selectedGroupId || selectedGroupId === 'all') return true;
    if (String(s.group_id) === String(selectedGroupId) || String(s.groupId) === String(selectedGroupId)) return true;
    if (Array.isArray(s.group_ids) && s.group_ids.some(gid => String(gid) === String(selectedGroupId))) return true;
    if (s.group_name && activeGroup?.name && s.group_name.trim().toLowerCase() === activeGroup.name.trim().toLowerCase()) return true;
    return false;
  });

  // Scope manual quizzes specifically to the selected group
  let groupQuizzesList = (state.groupQuizzes && selectedGroupId && state.groupQuizzes[selectedGroupId])
    ? state.groupQuizzes[selectedGroupId]
    : (state.quizzes || []);

  if (!groupQuizzesList || groupQuizzesList.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    groupQuizzesList = [
      { id: `quiz-${selectedGroupId || 'default'}-1`, group_id: selectedGroupId, number: 1, title: 'كويز 1', maxScore: 10, date: today, skipped: false },
      { id: `quiz-${selectedGroupId || 'default'}-2`, group_id: selectedGroupId, number: 2, title: 'كويز 2', maxScore: 10, date: today, skipped: false },
      { id: `quiz-${selectedGroupId || 'default'}-3`, group_id: selectedGroupId, number: 3, title: 'كويز 3', maxScore: 10, date: today, skipped: false },
    ];
  }

  const quizzes = groupQuizzesList.filter(q => {
    if (!q.group_id || q.group_id === 'all') return true;
    return !selectedGroupId || String(q.group_id) === String(selectedGroupId);
  });

  const currentQuizNumber = state.currentQuizNumber || quizzes[quizzes.length - 1]?.number || 1;
  const currentQuiz = quizzes.find(q => q.number === currentQuizNumber) || quizzes[0] || {
    id: `quiz-${selectedGroupId || 'default'}-1`, group_id: selectedGroupId, number: 1, title: 'كويز 1', maxScore: 10, date: new Date().toISOString().slice(0, 10), skipped: false
  };

  const pendingSubmissions = state.pendingSubmissions || [];
  const pendingCount = pendingSubmissions.length;
  const onlineSubmissions = state.onlineSubmissions || [];
  const filteredOnlineSubmissions = (!selectedGroupId || selectedGroupId === 'all')
    ? onlineSubmissions
    : onlineSubmissions.filter(sub => !sub.group_id || String(sub.group_id).trim() === String(selectedGroupId).trim());
  const gradedSubmissions = (filteredOnlineSubmissions || []).filter(sub => sub.status === 'approved' || sub.is_graded || sub.status === 'graded');
  // Filter quizzes by group
  const filterByGroup = (list) => {
    if (!selectedGroupId || selectedGroupId === 'all') return list;
    return list.filter(q => {
      if (!q.group_id) return true; // legacy unassigned fallback
      if (q.group_id === 'all') return true;
      if (String(q.group_id).trim() === String(selectedGroupId).trim()) return true;
      if (Array.isArray(q.group_ids) && q.group_ids.some(gid => String(gid).trim() === String(selectedGroupId).trim())) return true;
      if (Array.isArray(q.target_group_ids) && q.target_group_ids.some(gid => String(gid).trim() === String(selectedGroupId).trim())) return true;
      return false;
    });
  };

  const allRich = state.richQuizzes || [];
  const onlineQuizzes = filterByGroup(allRich.filter(q => q.exam_mode !== 'paper'));
  const paperQuizzes = filterByGroup(allRich.filter(q => q.exam_mode === 'paper'));

  return `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;" dir="rtl">
      <style>
        @keyframes centrlySpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
      
      <!-- Top Title & Group Selector Header Card (Calm Minimal Swiss) -->
      <div class="card" style="margin: 0; padding: 0.75rem 1rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          
          <!-- Route Title & Active Group Pill (Clean minimal, no top switcher tabs) -->
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <h2 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;">
              ${effectiveRoute === 'online-quizzes' ? 'الكويزات الإلكترونية (أونلاين)' :
                effectiveRoute === 'paper-exams' ? 'الامتحانات الورقية وبابل شيت' :
                'رصد درجات الكويزات يدوياً'}
            </h2>
            <span style="font-size: 0.72rem; color: #64748b; font-weight: 600; background: #f8fafc; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">
              ${escapeHtml(activeGroup?.name || 'المجموعة الحالية')}
            </span>
          </div>

          <!-- Group Switcher (Clean, compact) -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.76rem; color: #64748b; font-weight: 600;">المجموعة:</span>
            <select 
              id="quizGroupSelect" 
              class="form-select" 
              style="height: 32px; font-size: 0.78rem; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 10px; color: #0f172a; min-width: 175px;"
              onchange="window.centrlyApp.switchQuizGroup(this.value)"
            >
              ${groups.length > 1 ? `<option value="all" ${selectedGroupId === 'all' ? 'selected' : ''}>جميع المجموعات (الكل)</option>` : ''}
              ${groups.map(g => `
                <option value="${escapeHtml(g.id)}" ${g.id === selectedGroupId ? 'selected' : ''}>
                  ${escapeHtml(g.name)}
                </option>
              `).join('')}
            </select>
          </div>

        </div>

        <!-- Contextual Action Strip -->
        ${effectiveRoute === 'online-quizzes' ? `
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem; margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <button type="button" onclick="window.centrlyApp.switchQuizSubTab('online_builder')"
                style="height: 30px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; border-radius: 5px; border: 1px solid ${activeSubTab === 'online_builder' ? '#0f172a' : '#e2e8f0'}; background: ${activeSubTab === 'online_builder' ? '#0f172a' : '#ffffff'}; color: ${activeSubTab === 'online_builder' ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <span>نماذج وبنك الكويزات</span>
                <span style="font-size: 0.68rem; padding: 1px 6px; border-radius: 8px; font-weight: 800; background: ${activeSubTab === 'online_builder' ? '#334155' : '#f1f5f9'}; color: ${activeSubTab === 'online_builder' ? '#ffffff' : '#334155'};">
                  ${state.isLoadingRichQuizzes ? '<span style="display:inline-block; animation: centrlySpin 0.75s linear infinite; width:8px; height:8px; border:1.5px solid #cbd5e1; border-top-color:#ffffff; border-radius:50%; vertical-align:middle;"></span>' : onlineQuizzes.length}
                </span>
              </button>

              <button type="button" onclick="window.centrlyApp.switchQuizSubTab('online_grading', 'graded')"
                style="height: 30px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; border-radius: 5px; border: 1px solid ${(activeSubTab === 'online_grading' && (state.gradingViewMode || 'graded') === 'graded') ? '#0f172a' : '#e2e8f0'}; background: ${(activeSubTab === 'online_grading' && (state.gradingViewMode || 'graded') === 'graded') ? '#0f172a' : '#ffffff'}; color: ${(activeSubTab === 'online_grading' && (state.gradingViewMode || 'graded') === 'graded') ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <span>نتائج ودرجات الطلاب (المعتمدة)</span>
                <span style="font-size: 0.68rem; padding: 1px 6px; border-radius: 8px; font-weight: 800; background: ${(activeSubTab === 'online_grading' && (state.gradingViewMode || 'graded') === 'graded') ? '#10b981' : '#ecfdf5'}; color: ${(activeSubTab === 'online_grading' && (state.gradingViewMode || 'graded') === 'graded') ? '#ffffff' : '#065f46'};">
                  ${gradedSubmissions.length}
                </span>
              </button>

              <button type="button" onclick="window.centrlyApp.switchQuizSubTab('online_grading', 'pending')"
                style="height: 30px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; border-radius: 5px; border: 1px solid ${(activeSubTab === 'online_grading' && state.gradingViewMode === 'pending') ? '#0f172a' : '#e2e8f0'}; background: ${(activeSubTab === 'online_grading' && state.gradingViewMode === 'pending') ? '#0f172a' : '#ffffff'}; color: ${(activeSubTab === 'online_grading' && state.gradingViewMode === 'pending') ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <span>تصحيح المقالي</span>
                ${pendingCount > 0 ? `
                  <span style="background: #ef4444; color: #ffffff; font-size: 0.68rem; padding: 1px 6px; border-radius: 8px; font-weight: 800;">
                    ${pendingCount}
                  </span>
                ` : `
                  <span style="font-size: 0.68rem; padding: 1px 6px; border-radius: 8px; font-weight: 800; background: #f1f5f9; color: #64748b;">0</span>
                `}
              </button>
            </div>

            <div>
              <button type="button" onclick="window.centrlyApp.startNewOnlineExamWizard()"
                style="height: 30px; padding: 0 13px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                <span>+ إنشاء كويز أونلاين جديد</span>
              </button>
            </div>
          </div>
        ` : ''}

        ${effectiveRoute === 'paper-exams' ? `
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem; margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" onclick="window.centrlyApp.switchQuizSubTab('paper_builder')"
                style="height: 28px; padding: 0 11px; font-size: 0.74rem; font-weight: 700; border-radius: 5px; border: 1px solid ${activeSubTab === 'paper_builder' ? '#0f172a' : '#e2e8f0'}; background: ${activeSubTab === 'paper_builder' ? '#0f172a' : '#ffffff'}; color: ${activeSubTab === 'paper_builder' ? '#ffffff' : '#475569'}; cursor: pointer;">
                نماذج الامتحانات الورقية (${state.isLoadingRichQuizzes ? '<span style="display:inline-block; animation: centrlySpin 0.75s linear infinite; width:9px; height:9px; border:1.5px solid #cbd5e1; border-top-color:#0f172a; border-radius:50%; vertical-align:middle;"></span>' : paperQuizzes.length})
              </button>
              <button type="button" onclick="window.centrlyApp.switchQuizSubTab('paper_scanner')"
                style="height: 28px; padding: 0 11px; font-size: 0.74rem; font-weight: 700; border-radius: 5px; border: 1px solid ${activeSubTab === 'paper_scanner' ? '#0f172a' : '#e2e8f0'}; background: ${activeSubTab === 'paper_scanner' ? '#0f172a' : '#ffffff'}; color: ${activeSubTab === 'paper_scanner' ? '#ffffff' : '#475569'}; cursor: pointer;">
                تصحيح الورقي بالماسح الضوئي (الكاميرا)
              </button>
            </div>

            <div>
              <button type="button" onclick="window.centrlyApp.startNewPaperExam()"
                style="height: 30px; padding: 0 13px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                <span>+ إنشاء امتحان ورقي جديد</span>
              </button>
            </div>
          </div>
        ` : ''}

      </div>

      <!-- Tab Content Views -->
      ${activeSubTab === 'online_builder' ? renderOnlineBuilderTab(state, groups, activeGroup, quizzes, currentQuiz, gradedSubmissions) : ''}
      ${activeSubTab === 'online_grading' ? renderOnlineGradingTab(state, groups, activeGroup, pendingSubmissions, onlineSubmissions) : ''}
      ${activeSubTab === 'paper_builder' ? renderPaperBuilderTab(state, groups, activeGroup, quizzes, currentQuiz) : ''}
      ${activeSubTab === 'paper_scanner' ? renderPaperScannerTab(state, groups, activeGroup, quizzes, currentQuiz, groupStudents) : ''}
      ${activeSubTab === 'roster' ? renderRosterTab(state, groups, students, activeGroup, groupStudents, quizzes, currentQuiz, isLoading, hasLoaded) : ''}

      <!-- Unsaved Exam Exit Dialog Modal -->
      ${state.exitPromptMode ? renderUnsavedExamExitModal(state) : ''}

    </div>
  `;
}

function getBadgeStyle(isActive, isGreen = false) {
  if (isActive) {
    if (isGreen) {
      return `padding: 0.6rem 1.15rem; font-size: 0.88rem; font-weight: 800; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.5rem; background: #ecfdf5; color: #065f46; border: 2px solid #10b981; box-shadow: 0 2px 6px rgba(16,185,129,0.15); cursor: pointer; transition: all 0.15s ease;`;
    }
    return `padding: 0.6rem 1.15rem; font-size: 0.88rem; font-weight: 800; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.5rem; background: #eff6ff; color: #1e40af; border: 2px solid var(--centrly-blue-700); box-shadow: 0 2px 6px rgba(37,99,235,0.15); cursor: pointer; transition: all 0.15s ease;`;
  }
  return `padding: 0.6rem 1.15rem; font-size: 0.88rem; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.5rem; background: #f8fafc; color: var(--centrly-ink); border: 1.5px solid var(--centrly-line); cursor: pointer; transition: all 0.15s ease;`;
}

function renderUnsavedExamExitModal(state) {
  const mode = state.exitPromptMode || 'online'; // 'online' | 'paper'
  const isOnline = mode === 'online';
  const qz = isOnline ? state.activeOnlineQuiz : state.activePaperQuiz;
  const isExistingPublished = Boolean(qz?._isExistingPublished || (qz?.id && !qz.is_draft));
  const qCount = qz?.questions?.filter(q => (q.text && q.text.trim()) || q.image_url)?.length || 0;
  const examTitle = qz?.title || (isOnline ? 'الامتحان الإلكتروني' : 'الامتحان الورقي');

  return `
    <div style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.72); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px); font-family: 'Cairo', sans-serif;" dir="rtl">
      <div style="background: #ffffff; border-radius: 12px; max-width: 480px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); border: 1px solid #e2e8f0; overflow: hidden; animation: centrlyFadeIn 0.2s ease;">
        
        <!-- Header -->
        <div style="background: ${isExistingPublished ? '#f0fdf4' : '#fffbeb'}; border-bottom: 1px solid ${isExistingPublished ? '#bbf7d0' : '#fef3c7'}; padding: 1.15rem 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 42px; height: 42px; border-radius: 50%; background: ${isExistingPublished ? '#dcfce7' : '#fef3c7'}; border: 1.5px solid ${isExistingPublished ? '#86efac' : '#fde68a'}; display: flex; align-items: center; justify-content: center; color: ${isExistingPublished ? '#15803d' : '#b45309'}; flex-shrink: 0;">
            ${isExistingPublished ? getIcon('check', 22, '#15803d') : getIcon('archive', 22, '#b45309')}
          </div>
          <div>
            <h3 style="font-size: 0.98rem; font-weight: 800; color: ${isExistingPublished ? '#166534' : '#92400e'}; margin: 0;">
              ${isExistingPublished ? 'الرجوع من تعديل الامتحان' : 'لم تقم بحفظ الامتحان بعد!'}
            </h3>
            <span style="font-size: 0.76rem; color: ${isExistingPublished ? '#15803d' : '#b45309'}; font-weight: 700;">
              ${escapeHtml(examTitle)} • ${isExistingPublished ? 'الامتحان منشور بالفعل للطلاب' : `(${qCount} أسئلة مضافة)`}
            </span>
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 1.25rem;">
          <p style="font-size: 0.85rem; color: #334155; line-height: 1.6; margin: 0 0 1.25rem 0; font-weight: 600;">
            ${isExistingPublished 
              ? 'أنت الآن بصدد الخروج من وضع التعديل. هل ترغب في <b>الرجوع لقائمة الامتحانات المنشورة دون تطبيق تعديلات جديدة</b> (سيبقى الامتحان الأصلي منشوراً كما هو دون أي تغيير)، أم ترغب في <b>حفظ التعديلات كمسودة مؤقتة في الأرشيف</b>؟'
              : 'أنت الآن بصدد مغادرة صفحة إعداد الامتحان دون حفظه. هل ترغب في <b>حفظه في الأرشيف (مسودة)</b> للرجوع إليه وإكماله في أي وقت، أم تريد <b>إلغاء وتجاهل هذه المسودة</b>؟'
            }
          </p>

          <!-- Action Buttons -->
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            
            ${isExistingPublished ? `
              <!-- Button 1: Return to Published (Keep published untouched) -->
              <button 
                type="button" 
                onclick="window.centrlyApp.discardUnsavedExam('${mode}')"
                style="width: 100%; height: 44px; background: #0f172a; color: #ffffff; border: none; border-radius: 8px; font-size: 0.84rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 4px rgba(15,23,42,0.15); transition: background 0.15s ease;"
                onmouseover="this.style.background='#1e293b'"
                onmouseout="this.style.background='#0f172a'"
              >
                ${getIcon('check', 16, '#ffffff')}
                <span>الرجوع (سيبقى الامتحان منشوراً كما هو دون مساس)</span>
              </button>

              <!-- Button 2: Save modifications as draft in archive -->
              <button 
                type="button" 
                onclick="window.centrlyApp.saveExamToArchive('${mode}')"
                style="width: 100%; height: 38px; background: #fffdfa; color: #b45309; border: 1.5px solid #fde68a; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.15s ease;"
                onmouseover="this.style.background='#fef3c7'"
                onmouseout="this.style.background='#fffdfa'"
              >
                ${getIcon('archive', 15, '#b45309')}
                <span>حفظ التعديلات كمسودة جديدة في الأرشيف</span>
              </button>
            ` : `
              <!-- Button 1: Save to Archive (Draft) -->
              <button 
                type="button" 
                onclick="window.centrlyApp.saveExamToArchive('${mode}')"
                style="width: 100%; height: 42px; background: #0f172a; color: #ffffff; border: none; border-radius: 8px; font-size: 0.84rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 4px rgba(15,23,42,0.15); transition: background 0.15s ease;"
                onmouseover="this.style.background='#1e293b'"
                onmouseout="this.style.background='#0f172a'"
              >
                ${getIcon('archive', 16, '#f59e0b')}
                <span>حفظ في الأرشيف (مسودة للاستكمال لاحقاً)</span>
              </button>

              <!-- Button 2: Discard / Delete Draft -->
              <button 
                type="button" 
                onclick="window.centrlyApp.discardUnsavedExam('${mode}')"
                style="width: 100%; height: 38px; background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.15s ease;"
                onmouseover="this.style.background='#fee2e2'"
                onmouseout="this.style.background='#fef2f2'"
              >
                ${getIcon('trash', 15, '#dc2626')}
                <span>إلغاء وتجاهل هذه المسودة</span>
              </button>
            `}

            <!-- Button 3: Stay and Continue Editing -->
            <button 
              type="button" 
              onclick="window.centrlyApp.dismissExitPrompt()"
              style="width: 100%; height: 36px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"
              onmouseover="this.style.background='#f1f5f9'"
              onmouseout="this.style.background='#f8fafc'"
            >
              <span>الاستمرار ومتابعة التعديل الآن</span>
            </button>

          </div>
        </div>

      </div>
    </div>
  `;
}

// ============================================================================
// TAB 1: ROSTER (كشف ورصد الدرجات)
// ============================================================================
function renderRosterTab(state, groups, students, activeGroup, groupStudents, quizzes, currentQuiz, isLoading, hasLoaded) {
  const currentQuizNumber = state.currentQuizNumber || currentQuiz.number || 1;
  const scoresMap = state.scoresMap || {};
  const currentScores = scoresMap[currentQuiz.number] || {};

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
    <!-- Quiz Navigation Tabs & Actions Bar (Swiss Minimal) -->
    <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        
        <!-- Numbered Quiz Tabs -->
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 0.78rem; font-weight: 700; color: #64748b; margin-left: 0.4rem;">الكويز:</span>
          ${quizzes.map(q => {
            const isSelected = q.number === currentQuizNumber;
            const displayTitle = q.title || `كويز ${q.number}`;
            return `
              <button 
                id="quizTabBtn_${q.number}"
                type="button"
                style="height: 30px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; border-radius: 5px; border: 1px solid ${isSelected ? '#0f172a' : '#e2e8f0'}; background: ${isSelected ? '#0f172a' : '#ffffff'}; color: ${isSelected ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.15s ease;"
                onclick="window.centrlyApp.selectQuizNumber(${q.number})"
                title="${escapeHtml(displayTitle)}"
              >
                <span>${escapeHtml(displayTitle)}</span>
                ${q.skipped ? '<span style="font-size: 0.65rem; color: #d97706;">(مُتخطى)</span>' : ''}
              </button>
            `;
          }).join('')}

          <button 
            type="button"
            style="height: 30px; padding: 0 10px; font-size: 0.76rem; font-weight: 700; border-radius: 5px; border: 1px dashed #cbd5e1; background: #f8fafc; color: #475569; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
            onclick="window.centrlyApp.addNewQuiz()"
            title="إضافة كويز جديد"
          >
            ${getIcon('add', 12)}
            <span>كويز جديد</span>
          </button>
        </div>

        <!-- Quick Action Buttons -->
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button 
            type="button"
            onclick="window.centrlyApp.skipCurrentQuiz(${currentQuiz.number})"
            style="height: 30px; padding: 0 11px; font-size: 0.76rem; font-weight: 600; border-radius: 5px; border: 1px solid #e2e8f0; background: #ffffff; color: #b45309; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
            title="تخطي هذا الكويز والانتقال للكويز التالي"
          >
            ${getIcon('clock', 13, '#b45309')}
            <span>تخطي</span>
          </button>
          <button 
            type="button"
            onclick="window.centrlyApp.saveCurrentQuizScores()"
            style="height: 30px; padding: 0 14px; font-size: 0.76rem; font-weight: 700; border-radius: 5px; border: none; background: #0f172a; color: #ffffff; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
            title="حفظ الكويز وتثبيت كافة بياناته ودرجاته"
          >
            ${getIcon('check', 13, '#ffffff')}
            <span>حفظ الكويز والدرجات</span>
          </button>
        </div>

      </div>
    </div>

    <!-- Quiz Overview KPI Summary Cards (Swiss Minimal) -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
      
      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label for="quizTitleInput" style="font-size: 0.78rem; color: #64748b; font-weight: 700;">
            موضوع الكويز والدرجة العظمى:
          </label>
        </div>
        <div style="margin-top: 0.35rem; display: flex; gap: 0.5rem; align-items: center;">
          <input 
            id="quizTitleInput"
            type="text" 
            class="form-input" 
            value="${escapeHtml(currentQuiz.title || `كويز ${currentQuiz.number}`)}" 
            placeholder="اسم الكويز..."
            style="font-size: 0.85rem; font-weight: 700; color: #0f172a; height: 32px; padding: 0 8px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 5px; flex: 1;"
            oninput="window.centrlyApp.onQuizTitleLiveInput(${currentQuiz.number}, this.value)"
            onchange="window.centrlyApp.onQuizTitleLiveInput(${currentQuiz.number}, this.value)"
            onkeydown="if(event.key === 'Enter'){ window.centrlyApp.saveCurrentQuizScores(); this.blur(); }"
          />
          <div style="display: inline-flex; align-items: center; gap: 0.25rem;">
            <input 
              id="quizMaxScoreInput"
              type="number" 
              min="1" 
              max="200" 
              step="1"
              class="form-input" 
              value="${currentQuiz.maxScore || 10}" 
              style="width: 55px; height: 32px; text-align: center; padding: 0; font-weight: 800; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 5px; background: #f8fafc;"
              oninput="window.centrlyApp.onQuizMaxScoreLiveInput(${currentQuiz.number}, this.value)"
              onkeydown="if(event.key === 'Enter'){ window.centrlyApp.saveCurrentQuizScores(); this.blur(); }"
            />
            <span style="font-size: 0.74rem; font-weight: 700; color: #64748b;">درجة</span>
          </div>
        </div>
      </div>

      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">
        <div style="font-size: 0.78rem; color: #64748b; font-weight: 700;">نسبة الطلاب المصحح لهم</div>
        <div style="font-size: 1.35rem; font-weight: 900; color: #0f172a; margin-top: 0.25rem;">
          ${completionRate}% <span style="font-size: 0.78rem; font-weight: 600; color: #64748b;">(${gradedCount} من ${groupStudents.length})</span>
        </div>
        <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
          ${groupStudents.length - gradedCount > 0 ? `${groupStudents.length - gradedCount} طلاب لم تُرصد درجاتهم بعد` : 'تم رصد درجات كافة الطلاب'}
        </div>
      </div>

      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem;">
        <div style="font-size: 0.78rem; color: #64748b; font-weight: 700;">متوسط درجات المجموعة</div>
        <div style="font-size: 1.35rem; font-weight: 900; color: #0f172a; margin-top: 0.25rem;">
          ${avgScore} <span style="font-size: 0.78rem; font-weight: 600; color: #64748b;">/ ${currentQuiz.maxScore || 10}</span>
        </div>
        <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
          أعلى درجة مسجلة: ${highestScore} من ${currentQuiz.maxScore || 10}
        </div>
      </div>

    </div>

    <!-- Students Quiz Grading Table Card (Swiss Minimal) -->
    <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
        <div>
          <h3 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;">
            كشف رصد درجات الطلاب (${escapeHtml(activeGroup?.name || 'المجموعة')})
          </h3>
          <span style="font-size: 0.74rem; color: #64748b;">
            أدخل الدرجة واضغط Tab للانتقال للطالب التالي
          </span>
        </div>

        <div>
          <button 
            id="btnSaveQuizScoresTable"
            type="button"
            onclick="window.centrlyApp.saveCurrentQuizScores()"
            style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
          >
            ${getIcon('check', 14, '#ffffff')}
            <span>حفظ ورصد درجات الكويز</span>
          </button>
        </div>
      </div>

      <div style="overflow-x: auto; margin-top: 0.75rem;">
        <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 700;">
              <th style="padding: 8px 10px; width: 80px; text-align: right;">كود الطالب</th>
              <th style="padding: 8px 10px; text-align: right;">اسم الطالب</th>
              <th style="padding: 8px 10px; width: 160px; text-align: right;">بيانات التواصل</th>
              <th style="padding: 8px 10px; width: 140px; text-align: center;">الدرجة (من ${currentQuiz.maxScore || 10})</th>
              <th style="padding: 8px 10px; width: 110px; text-align: center;">حالة الرصد</th>
              <th style="padding: 8px 10px; text-align: right;">ملاحظات</th>
              <th style="padding: 8px 10px; width: 130px; text-align: center;">إشعار النتيجة</th>
            </tr>
          </thead>
          <tbody>
            ${groupStudents.length > 0 ? groupStudents.map(s => {
              const score = currentScores[s.id] !== undefined && currentScores[s.id] !== null ? currentScores[s.id] : '';
              const isGraded = score !== '';
              const maxScore = currentQuiz.maxScore || 10;
              let statusBadge = '<span style="font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: #f1f5f9; color: #64748b;">لم يرصد</span>';
              if (isGraded) {
                const pct = (Number(score) / maxScore) * 100;
                if (pct >= 85) statusBadge = '<span style="font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;">ممتاز</span>';
                else if (pct >= 65) statusBadge = '<span style="font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;">جيد جداً</span>';
                else if (pct >= 50) statusBadge = '<span style="font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: #fffbeb; color: #92400e; border: 1px solid #fde68a;">مقبول</span>';
                else statusBadge = '<span style="font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;">يحتاج متابعة</span>';
              }

              const deliveryStatus = state.deliveryStatusMap?.[currentQuiz.number]?.[s.id] || 'pending';

              return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 10px; font-weight: 700; color: #475569; font-family: monospace;">${escapeHtml(s.student_code || s.code || '—')}</td>
                  <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">${escapeHtml(s.name || s.full_name || 'طالب')}</td>
                  <td style="padding: 8px 10px; font-size: 0.74rem; color: #64748b;">
                    ${s.parent_phone ? `<div>ولى الأمر: ${escapeHtml(s.parent_phone)}</div>` : ''}
                    ${s.student_phone || s.phone ? `<div>الطالب: ${escapeHtml(s.student_phone || s.phone)}</div>` : ''}
                  </td>
                  <td style="padding: 8px 10px; text-align: center;">
                    <input 
                      type="number"
                      step="0.5"
                      min="0"
                      max="${maxScore}"
                      class="form-input"
                      value="${score !== '' ? score : ''}"
                      placeholder="—"
                      style="width: 65px; height: 30px; text-align: center; font-weight: 800; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 5px; background: #f8fafc;"
                      onchange="window.centrlyApp.updateStudentQuizScore('${s.id}', this.value)"
                    />
                  </td>
                  <td style="padding: 8px 10px; text-align: center;">${statusBadge}</td>
                  <td style="padding: 8px 10px;">
                    <input 
                      type="text" 
                      class="form-input" 
                      value="${escapeHtml(state.notesMap?.[currentQuiz.number]?.[s.id] || '')}" 
                      placeholder="ملاحظة..."
                      style="font-size: 0.76rem; height: 30px; width: 100%; border: 1px solid #e2e8f0; border-radius: 5px; padding: 0 8px;"
                      onchange="window.centrlyApp.updateStudentQuizNote('${s.id}', this.value)"
                    />
                  </td>
                  <td style="padding: 8px 10px; text-align: center;">
                    <button 
                      type="button"
                      style="height: 28px; padding: 0 9px; font-size: 0.72rem; font-weight: 700; color: #059669; background: #ffffff; border: 1px solid #d1fae5; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                      onclick="window.centrlyApp.sendQuizScoreWhatsApp('${s.id}', '${escapeHtml(s.name)}', '${escapeHtml(currentQuiz.title)}', 'both')"
                      title="إرسال إشعار النتيجة لولي الأمر والطالب"
                    >
                      ${getIcon('whatsapp', 13, '#059669')}
                      <span>${deliveryStatus === 'sent' ? 'إعادة الإرسال' : 'إرسال واتساب'}</span>
                    </button>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b; font-size: 0.82rem;">
                  لا يوجد طلاب مقيدون في هذه المجموعة حالياً.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================================================
// HELPER: MULTI-GROUP SELECTOR COMPONENT (اختيار كذا مجموعة مع بعض)
// ============================================================================
function renderMultiGroupSelector(prefix, groupsList, targetGroupIds, targetGroupId, isDropdownOpen) {
  const groups = Array.isArray(groupsList) ? groupsList : [];
  let selectedIds = Array.isArray(targetGroupIds) && targetGroupIds.length > 0
    ? targetGroupIds
    : (targetGroupId && targetGroupId !== 'all' ? [targetGroupId] : groups.map(g => g.id));

  const isAll = (targetGroupId === 'all') || (groups.length > 0 && selectedIds.length === groups.length);

  let labelText = '';
  if (isAll) {
    labelText = `جميع المجاميع (${groups.length} مجموعات)`;
  } else if (selectedIds.length === 1) {
    const single = groups.find(g => g.id === selectedIds[0]);
    labelText = single ? single.name : 'مجموعة واحدة محددة';
  } else if (selectedIds.length > 1) {
    labelText = `${selectedIds.length} مجموعات محددة`;
  } else {
    labelText = 'اختر المجموعات المستهدفة...';
  }

  return `
    <div style="position: relative;" id="${prefix}GroupSelectorContainer">
      <button 
        type="button" 
        id="${prefix}GroupDropdownBtn"
        onclick="window.centrlyApp.toggleGroupDropdown('${prefix}')"
        style="width: 100%; height: 34px; padding: 0 10px; font-size: 0.82rem; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; color: #0f172a; display: flex; justify-content: space-between; align-items: center; cursor: pointer; text-align: right;"
      >
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 88%;">
          ${escapeHtml(labelText)}
        </span>
        <span style="font-size: 0.72rem; color: #64748b; margin-right: 4px;">▼</span>
      </button>

      <!-- Dropdown Popover List -->
      ${isDropdownOpen ? `
        <div 
          id="${prefix}GroupDropdownMenu" 
          style="position: absolute; top: calc(100% + 4px); right: 0; left: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.12); z-index: 1000; padding: 6px; max-height: 240px; overflow-y: auto;"
        >
          <!-- Option: All Groups -->
          <label style="display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 800; color: #0f172a; background: ${isAll ? '#eff6ff' : 'transparent'};">
            <input 
              type="checkbox" 
              ${isAll ? 'checked' : ''} 
              onchange="window.centrlyApp.toggleAllGroupsSelect('${prefix}', this.checked)"
              style="width: 15px; height: 15px; cursor: pointer; accent-color: #2563eb;"
            />
            <span>تحديد جميع المجاميع (${groups.length})</span>
          </label>

          <div style="height: 1px; background: #e2e8f0; margin: 4px 0;"></div>

          <!-- Individual Group Checkboxes -->
          ${groups.map(g => {
            const isChecked = isAll || selectedIds.includes(g.id);
            return `
              <label style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 5px; cursor: pointer; font-size: 0.82rem; font-weight: 600; color: #1e293b; transition: background 0.15s ease;"
                onmouseenter="this.style.background='#f8fafc'" onmouseleave="this.style.background='transparent'">
                <input 
                  type="checkbox" 
                  value="${escapeHtml(g.id)}"
                  ${isChecked ? 'checked' : ''}
                  onchange="window.centrlyApp.toggleSingleGroupSelect('${prefix}', '${escapeHtml(g.id)}', this.checked)"
                  style="width: 15px; height: 15px; cursor: pointer; accent-color: #2563eb;"
                />
                <span style="flex: 1;">${escapeHtml(g.name)}</span>
              </label>
            `;
          }).join('')}
          
          <div style="padding-top: 6px; border-top: 1px solid #f1f5f9; text-align: left;">
            <button 
              type="button" 
              onclick="window.centrlyApp.toggleGroupDropdown('${prefix}')"
              style="padding: 2px 10px; font-size: 0.72rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 4px; cursor: pointer;"
            >
              تم
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Selected Badges Row (Below Button) -->
      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
        ${isAll ? `
          <span style="font-size: 0.72rem; font-weight: 700; background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
            جميع المجاميع (${groups.length})
          </span>
        ` : selectedIds.map(gid => {
          const gObj = groups.find(g => g.id === gid);
          if (!gObj) return '';
          return `
            <span style="font-size: 0.72rem; font-weight: 700; background: #f8fafc; color: #1e293b; padding: 2px 7px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; gap: 4px;">
              <span>${escapeHtml(gObj.name)}</span>
              <span onclick="event.stopPropagation(); window.centrlyApp.toggleSingleGroupSelect('${prefix}', '${escapeHtml(gid)}', false)" style="cursor: pointer; color: #94a3b8; font-weight: 900; font-size: 0.8rem; margin-right: 2px;" title="إزالة">✕</span>
            </span>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ============================================================================
// TAB 2: ONLINE BUILDER (إنشاء امتحان أونلاين - سؤال بسؤال + وقت الامتحان)
// ============================================================================
function renderOnlineBuilderTab(state, groups, activeGroup, quizzes, currentQuiz, gradedSubmissions = []) {
  const viewMode = state.onlineViewMode || 'list'; // 'list' | 'wizard'
  const selectedGroupId = state.selectedGroupId || (groups[0]?.id || '');
  const allRich = state.richQuizzes || [];
  const richQuizzes = allRich.filter(q => {
    if (q.exam_mode === 'paper') return false;
    if (!selectedGroupId || selectedGroupId === 'all') return true;
    if (!q.group_id || q.group_id === 'all') return true;
    if (String(q.group_id).trim() === String(selectedGroupId).trim()) return true;
    if (Array.isArray(q.group_ids) && q.group_ids.some(gid => String(gid).trim() === String(selectedGroupId).trim())) return true;
    if (Array.isArray(q.target_group_ids) && q.target_group_ids.some(gid => String(gid).trim() === String(selectedGroupId).trim())) return true;
    return false;
  });

  const allDrafts = state.examDrafts || [];
  const onlineDrafts = allDrafts.filter(d => (d.exam_mode || 'online') !== 'paper');
  const activeListTab = state.onlineListTab || 'published'; // 'published' | 'drafts'

  if (viewMode === 'list') {
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Header Bar with Filter Tabs and New Exam Button -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem;">
          <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <button 
              type="button" 
              onclick="window.centrlyApp.setOnlineListTab('published')"
              style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease; ${activeListTab === 'published' ? 'background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.06);' : 'background: transparent; color: #64748b;'}"
            >
              الامتحانات المنشورة (${richQuizzes.length})
            </button>
            <button 
              type="button" 
              onclick="window.centrlyApp.setOnlineListTab('drafts')"
              style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px; ${activeListTab === 'drafts' ? 'background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.06);' : 'background: transparent; color: #64748b;'}"
            >
              ${getIcon('archive', 13, activeListTab === 'drafts' ? '#b45309' : '#64748b')}
              <span>الأرشيف والمسودات</span>
              ${onlineDrafts.length > 0 ? `<span style="background: #f59e0b; color: #ffffff; font-size: 0.7rem; font-weight: 800; padding: 1px 6px; border-radius: 10px;">${onlineDrafts.length}</span>` : ''}
            </button>
          </div>

          <button type="button" onclick="window.centrlyApp.startNewOnlineExamWizard()"
            style="height: 30px; padding: 0 14px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
            <span>+ إنشاء امتحان إلكتروني جديد</span>
          </button>
        </div>

        ${activeListTab === 'drafts' ? `
          <!-- Drafts / Archive View -->
          ${onlineDrafts.length === 0 ? `
            <div class="card" style="text-align: center; padding: 3rem 1.5rem; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px;">
              <div style="color: #94a3b8; margin-bottom: 0.5rem; display: flex; justify-content: center;">${getIcon('archive', 36, '#94a3b8')}</div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem;">الأرشيف فارغ حالياً</div>
              <p style="font-size: 0.78rem; color: #64748b; margin: 0 auto; max-width: 420px; line-height: 1.5;">
                عندما تقوم بإعداد امتحان إلكتروني وتختار حفظه في الأرشيف (مسودة) بدلاً من حذفه، سيظهر هنا فوراً لتستأنف كتابته وتعديله ونشره متى شئت.
              </p>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
              ${onlineDrafts.map(d => {
                const qCount = d.questions?.length || 0;
                const dateStr = d.archived_at ? new Date(d.archived_at).toLocaleDateString('ar-EG') : 'مسودة حديثة';
                return `
                  <div class="card" style="margin: 0; border: 1.5px dashed #f59e0b; border-radius: 8px; background: #fffdfa; padding: 1.1rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.65rem;">
                        <span style="font-weight: 800; font-size: 0.95rem; color: #0f172a; line-height: 1.4;">
                          ${escapeHtml(d.title || 'مسودة امتحان إلكتروني')}
                        </span>
                        <span style="font-size: 0.72rem; font-weight: 800; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap;">
                          ${getIcon('archive', 11, '#b45309')}
                          <span>مسودة بالأرشيف</span>
                        </span>
                      </div>
                      <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem;">
                        <span style="background: #ffffff; border: 1px solid #e2e8f0; color: #475569; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                          المادة: ${escapeHtml(d.subject || 'الفيزياء')}
                        </span>
                        <span style="background: #ffffff; border: 1px solid #e2e8f0; color: #475569; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                          ${qCount} أسئلة
                        </span>
                        <span style="background: #ffffff; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                          محفوظ بتاريخ: ${escapeHtml(dateStr)}
                        </span>
                      </div>
                    </div>
                    <div style="display: flex; gap: 0.45rem; align-items: center; margin-top: 1rem; padding-top: 0.65rem; border-top: 1px solid #fed7aa;">
                      <button 
                        type="button" 
                        style="flex: 1; height: 32px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px;"
                        onclick="window.centrlyApp.resumeExamDraft('${escapeHtml(d.id)}', 'online')"
                      >
                        ${getIcon('edit', 12, '#ffffff')}
                        <span>استئناف وتعديل</span>
                      </button>
                      <button 
                        type="button" 
                        style="height: 32px; font-size: 0.75rem; font-weight: 700; background: #fef2f2; color: #dc2626; border-radius: 5px; border: 1px solid #fecaca; cursor: pointer; padding: 0 10px; display: inline-flex; align-items: center; gap: 4px;"
                        onclick="window.centrlyApp.deleteExamDraft('${escapeHtml(d.id)}')"
                        title="حذف هذه المسودة نهائياً"
                      >
                        ${getIcon('trash', 12, '#dc2626')}
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        ` : `
        <!-- Online Exams Cards Grid / Loading / Empty (Swiss Minimal) -->
        ${state.isLoadingRichQuizzes ? `
          <!-- Loading State (Calm Minimal Swiss) -->
          <div class="card" style="text-align: center; padding: 3.5rem 1.5rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 0.85rem;">
              <span style="width: 20px; height: 20px; border: 2.5px solid #cbd5e1; border-top-color: #0f172a; border-radius: 50%; display: inline-block; animation: centrlySpin 0.75s linear infinite;"></span>
            </div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.35rem;">
              جاري تحميل الكويزات والامتحانات الإلكترونية...
            </div>
            <p style="font-size: 0.78rem; color: #64748b; margin: 0 auto; max-width: 420px; line-height: 1.5;">
              يتم الآن جلب بيانات بنك الكويزات المنشأة لهذه المجموعة من السيرفر، لحظات وستظهر الامتحانات...
            </p>
          </div>
          <!-- Clean Calm Skeletons -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; opacity: 0.45;">
            <div class="card" style="margin: 0; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 1.1rem; height: 150px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="height: 14px; width: 55%; background: #e2e8f0; border-radius: 4px; margin-bottom: 0.8rem;"></div>
                <div style="display: flex; gap: 0.4rem; margin-bottom: 0.6rem;">
                  <div style="height: 18px; width: 60px; background: #f1f5f9; border-radius: 4px;"></div>
                  <div style="height: 18px; width: 50px; background: #f1f5f9; border-radius: 4px;"></div>
                  <div style="height: 18px; width: 70px; background: #f1f5f9; border-radius: 4px;"></div>
                </div>
              </div>
              <div style="height: 28px; width: 100%; background: #f1f5f9; border-radius: 4px;"></div>
            </div>
            <div class="card" style="margin: 0; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 1.1rem; height: 150px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="height: 14px; width: 65%; background: #e2e8f0; border-radius: 4px; margin-bottom: 0.8rem;"></div>
                <div style="display: flex; gap: 0.4rem; margin-bottom: 0.6rem;">
                  <div style="height: 18px; width: 60px; background: #f1f5f9; border-radius: 4px;"></div>
                  <div style="height: 18px; width: 50px; background: #f1f5f9; border-radius: 4px;"></div>
                  <div style="height: 18px; width: 70px; background: #f1f5f9; border-radius: 4px;"></div>
                </div>
              </div>
              <div style="height: 28px; width: 100%; background: #f1f5f9; border-radius: 4px;"></div>
            </div>
          </div>
        ` : richQuizzes.length > 0 ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
            ${richQuizzes.map(rq => {
              const qCount = rq.questions?.length || 0;
              const dateStr = rq.available_date || 'متاح دائماً';
              const timeWindowStr = (rq.start_time && rq.end_time) 
                ? `من ${rq.start_time} إلى ${rq.end_time}` 
                : 'بدون قيد زمني';
              const totalPoints = (rq.questions || []).reduce((sum, q) => sum + Number(q.points || 1), 0) || rq.max_score || 10;
              const targetGroup = groups.find(g => String(g.id) === String(rq.group_id));
              const groupLabel = rq.group_id === 'all' ? 'جميع المجاميع' : (targetGroup?.name || activeGroup?.name || 'مجموعة محددة');

              return `
                <div class="card" style="margin: 0; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 1.1rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                  
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.65rem;">
                      <span style="font-weight: 800; font-size: 0.95rem; color: #0f172a; line-height: 1.4;">
                        ${escapeHtml(rq.title)}
                      </span>
                      <span style="font-size: 0.72rem; font-weight: 700; background: #f1f5f9; color: #334155; padding: 2px 7px; border-radius: 4px; white-space: nowrap;">
                        كويز ${rq.quiz_number}
                      </span>
                    </div>

                    <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem;">
                      <span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        المادة: ${escapeHtml(rq.subject || 'الفيزياء')}
                      </span>
                      <span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        ${qCount} أسئلة
                      </span>
                      <span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        ${totalPoints} درجات
                      </span>
                      <span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        ${rq.time_limit_minutes || 20} دقيقة
                      </span>
                      <span style="background: #f1f5f9; color: #0f172a; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        المجموعة: ${escapeHtml(groupLabel)}
                      </span>
                    </div>

                    <!-- Time Window Info -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.55rem 0.75rem; font-size: 0.75rem; color: #475569; display: flex; flex-direction: column; gap: 0.2rem;">
                      <div><b>تاريخ الإتاحة:</b> ${escapeHtml(dateStr)}</div>
                      <div><b>فترة الإتاحة:</b> ${escapeHtml(timeWindowStr)}</div>
                    </div>
                  </div>

                  <!-- Actions (Edit, Grades, Archive, Delete) -->
                  <div style="display: flex; gap: 0.4rem; align-items: center; margin-top: 1rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9; flex-wrap: wrap;">
                    <button 
                      type="button" 
                      style="flex: 1 1 100px; height: 30px; font-size: 0.75rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;"
                      onclick="window.centrlyApp.editOnlineExamWizard('${escapeHtml(rq.id)}')"
                    >
                      ${getIcon('edit', 12)}
                      <span>تعديل</span>
                    </button>
                    <button 
                      type="button" 
                      style="height: 30px; font-size: 0.75rem; font-weight: 600; background: #f8fafc; color: #334155; border-radius: 5px; border: 1px solid #e2e8f0; cursor: pointer; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;"
                      onclick="window.centrlyApp.switchToRosterForQuiz(${rq.quiz_number})"
                      title="عرض كشف درجات هذا الكويز"
                    >
                      <span>كشف الدرجات</span>
                    </button>
                    <button 
                      type="button" 
                      style="height: 30px; font-size: 0.74rem; font-weight: 600; background: #fffdfa; color: #b45309; border-radius: 5px; border: 1px solid #fde68a; cursor: pointer; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;"
                      onclick="window.centrlyApp.archiveOnlineExam('${escapeHtml(rq.id)}')"
                      title="نقل الامتحان إلى الأرشيف والمسودات لإخفائه عن الطلاب"
                    >
                      ${getIcon('archive', 11, '#b45309')}
                      <span>أرشفة</span>
                    </button>
                    <button 
                      type="button" 
                      style="height: 30px; font-size: 0.74rem; font-weight: 600; background: #fef2f2; color: #dc2626; border-radius: 5px; border: 1px solid #fecaca; cursor: pointer; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;"
                      onclick="window.centrlyApp.deleteOnlineExam('${escapeHtml(rq.id)}')"
                      title="حذف هذا الامتحان نهائياً"
                    >
                      ${getIcon('trash', 11, '#dc2626')}
                      <span>حذف</span>
                    </button>
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- Empty State -->
          <div class="card" style="text-align: center; padding: 3rem 1.5rem; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px;">
            <div style="font-weight: 800; font-size: 1rem; color: #0f172a; margin-bottom: 0.35rem;">لا توجد امتحانات إلكترونية منشأة لهذه المجموعة بعد</div>
            <p style="font-size: 0.8rem; color: #64748b; max-width: 440px; margin: 0 auto 1.25rem auto;">
              ابدأ الآن بإنشاء أول امتحان إلكتروني، وحدد عدد الأسئلة ليقوم النظام بإرشادك لتعبئتها سؤالاً بسؤال.
            </p>
            <button 
              type="button" 
              style="height: 32px; padding: 0 16px; font-size: 0.8rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer;"
              onclick="window.centrlyApp.startNewOnlineExamWizard()"
            >
              + ابدأ إنشاء أول امتحان إلكتروني الآن
            </button>
          </div>
        `}
      `}

        <!-- Results Table Card inside Online Builder -->
        ${gradedSubmissions && gradedSubmissions.length > 0 ? `
          <div style="margin-top: 0.5rem;">
            ${renderOnlineGradingResultsCard(gradedSubmissions, activeGroup, false, state)}
          </div>
        ` : ''}

      </div>
    `;
  }

  // WIZARD MODE: Step 1 or Step 2
  const wizardStep = state.wizardStep || 1;
  const activeQuiz = state.activeOnlineQuiz || {
    id: null,
    quiz_number: currentQuiz.number || 1,
    title: '',
    subject: activeGroup?.subject || 'الفيزياء',
    target_group_id: selectedGroupId,
    question_count: 10,
    time_limit_minutes: 20,
    available_date: new Date().toISOString().slice(0, 10),
    start_time: '18:00',
    end_time: '22:00',
    exam_mode: 'online',
    questions: []
  };

  const currentQIdx = state.currentQuestionIndex || 0;
  const totalQuestions = activeQuiz.questions?.length || activeQuiz.question_count || 10;
  const currentQ = activeQuiz.questions?.[currentQIdx] || {
    id: `q_${currentQIdx + 1}`,
    type: 'mcq',
    text: '',
    image_url: '',
    choices: ['', '', '', ''],
    correct_index: 0,
    points: 2
  };

  if (wizardStep === 1) {
    // STEP 1: Exam Settings & Time Window (Swiss Minimal)
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        
        <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div>
              <div style="font-size: 0.74rem; font-weight: 700; color: #64748b; margin-bottom: 0.15rem;">
                الخطوة 1 من 2
              </div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">
                إعداد وضوابط الامتحان الإلكتروني وتحديد المجموعة
              </h3>
            </div>

            <button 
              type="button" 
              style="height: 30px; padding: 0 12px; font-size: 0.76rem; font-weight: 600; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer;"
              onclick="window.centrlyApp.cancelOnlineExamWizard()"
            >
              إلغاء والعودة للقائمة
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
            
            <!-- Multi-Group Selector in Wizard Step 1 -->
            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155; margin-bottom: 0.35rem; display: block;">
                المجموعات المستهدفة بالامتحان:
              </label>
              ${renderMultiGroupSelector('online', groups, activeQuiz.target_group_ids, activeQuiz.target_group_id || selectedGroupId, state.groupDropdownState?.online)}
            </div>

            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">عنوان / موضوع الامتحان:</label>
              <input 
                type="text" 
                id="wizardTitle" 
                class="form-input" 
                value="${escapeHtml(activeQuiz.title || '')}" 
                placeholder="مثال: امتحان الباب الأول - قانون كيرشوف"
                style="font-weight: 700; height: 34px; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">اسم المادة الدراسية:</label>
              <input 
                type="text" 
                id="wizardSubject" 
                class="form-input" 
                value="${escapeHtml(activeQuiz.subject || 'الفيزياء')}" 
                placeholder="مثال: مادة الفيزياء"
                style="font-weight: 700; height: 34px; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">رقم الكويز التسلسلي:</label>
              <input 
                type="number" 
                id="wizardQuizNumber" 
                class="form-input" 
                value="${activeQuiz.quiz_number || 1}" 
                min="1" 
                step="1"
                style="font-weight: 700; height: 34px; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">إجمالي عدد أسئلة الامتحان:</label>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input 
                  type="number" 
                  id="wizardQuestionCount" 
                  class="form-input" 
                  value="${activeQuiz.questions?.length || activeQuiz.question_count || 10}" 
                  min="1" 
                  max="100" 
                  step="1"
                  style="text-align: center; font-weight: 800; font-size: 0.9rem; width: 90px; height: 34px;"
                />
                <span style="font-size: 0.8rem; font-weight: 700; color: #64748b;">سؤال</span>
              </div>
            </div>

            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">زمن الامتحان للتايمر (بالدقائق):</label>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input 
                  type="number" 
                  id="wizardTimeLimit" 
                  class="form-input" 
                  value="${activeQuiz.time_limit_minutes || 20}" 
                  min="1" 
                  max="240"
                  style="text-align: center; font-weight: 800; font-size: 0.9rem; width: 90px; height: 34px;"
                />
                <span style="font-size: 0.8rem; font-weight: 700; color: #64748b;">دقيقة</span>
              </div>
            </div>

            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">تاريخ إتاحة الامتحان:</label>
              <input 
                type="date" 
                id="wizardAvailableDate" 
                class="form-input" 
                value="${activeQuiz.available_date || new Date().toISOString().slice(0, 10)}" 
                style="font-weight: 700; height: 34px; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">وقت بداية الامتحان (ساعة البدء):</label>
              <input 
                type="time" 
                id="wizardStartTime" 
                class="form-input" 
                value="${activeQuiz.start_time || '18:00'}" 
                style="font-weight: 700; height: 34px; font-size: 0.82rem;"
              />
            </div>

            <div>
              <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">وقت نهاية الامتحان (ساعة الإغلاق):</label>
              <input 
                type="time" 
                id="wizardEndTime" 
                class="form-input" 
                value="${activeQuiz.end_time || '22:00'}" 
                style="font-weight: 700; height: 34px; font-size: 0.82rem;"
              />
            </div>

          </div>

          <!-- Explanatory Notice -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem 0.85rem; margin-top: 1.25rem; font-size: 0.76rem; color: #475569; line-height: 1.5;">
            <b>تنبيه:</b> سيتم فتح رابط الامتحان للطلاب في هذا اليوم فقط من وقت البدء حتى وقت النهاية المحدد. وبمجرد أن يبدأ الطالب، سيبدأ التايمر الخاص به بالعد التنازلي.
          </div>

          <!-- Wizard Action Bar -->
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
            <button 
              type="button" 
              style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer;"
              onclick="window.centrlyApp.cancelOnlineExamWizard()"
            >
              إلغاء
            </button>
            <button 
              type="button" 
              style="height: 32px; padding: 0 16px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
              onclick="window.centrlyApp.proceedToQuestionsStep()"
            >
              <span>ابدأ بكتابة الأسئلة</span>
              ${getIcon('arrowRight', 14, '#ffffff')}
            </button>
          </div>

        </div>

      </div>
    `;
  }

  // STEP 2: Question-by-Question Builder (سؤال بسؤال - Swiss Minimal)
  const isMcq = currentQ.type !== 'essay';
  const isImageOnly = currentQ.format === 'image_only' || (currentQ.format !== 'standard' && !currentQ.text?.trim() && !!currentQ.image_url);
  const progressPct = Math.round(((currentQIdx + 1) / totalQuestions) * 100);

  return `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      
      <!-- Top Stepper Toolbar (Swiss Minimal) -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1.15rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; font-size: 0.74rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                السؤال ${currentQIdx + 1} من ${totalQuestions}
              </span>
              <span style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                ${escapeHtml(activeQuiz.title || 'امتحان أونلاين')} (${escapeHtml(activeQuiz.subject || 'الفيزياء')})
              </span>
            </div>
            <div style="font-size: 0.76rem; color: #64748b; margin-top: 0.2rem;">
              يمكنك التنقل بين الأسئلة عبر أرقام الانتقال السريع أو زر "السؤال التالي".
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button 
              type="button" 
              style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
              onclick="window.centrlyApp.backToWizardStep1()"
            >
              ${getIcon('edit', 13)}
              <span>تعديل بيانات الامتحان</span>
            </button>

            <button 
              type="button" 
              style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
              onclick="window.centrlyApp.saveOnlineExamNow()"
            >
              ${getIcon('check', 13, '#ffffff')}
              <span>حفظ ونشر الامتحان</span>
            </button>
          </div>
        </div>

        <!-- Visual Progress Bar -->
        <div style="width: 100%; height: 4px; background: #f1f5f9; border-radius: 2px; margin-top: 0.75rem; overflow: hidden;">
          <div style="height: 100%; background: #0f172a; width: ${progressPct}%; transition: width 0.2s ease;"></div>
        </div>

        <!-- Question Fast Jumpers (1, 2, 3 ... N) -->
        <div style="display: flex; gap: 0.35rem; overflow-x: auto; padding: 0.65rem 0 0.15rem 0; margin-top: 0.35rem; align-items: center;">
          <span style="font-size: 0.76rem; font-weight: 700; color: #64748b; margin-left: 0.4rem; white-space: nowrap;">الانتقال السريع:</span>
          ${Array.from({ length: totalQuestions }).map((_, idx) => {
            const isCur = idx === currentQIdx;
            const qData = activeQuiz.questions?.[idx];
            const hasContent = qData && (qData.text?.trim() || qData.image_url);

            return `
              <button 
                type="button"
                style="min-width: 30px; height: 30px; border-radius: 5px; font-weight: 700; font-size: 0.78rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; border: 1px solid ${isCur ? '#0f172a' : (hasContent ? '#cbd5e1' : '#e2e8f0')}; background: ${isCur ? '#0f172a' : (hasContent ? '#f8fafc' : '#ffffff')}; color: ${isCur ? '#ffffff' : (hasContent ? '#0f172a' : '#94a3b8')};"
                onclick="window.centrlyApp.jumpToQuestion(${idx})"
                title="سؤال ${idx + 1}"
              >
                ${idx + 1}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Current Question Card (Swiss Minimal) -->
      <div class="card" style="margin: 0; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        
        <!-- Question Type, Format & Points Toolbar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 0.85rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span style="background: #0f172a; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">
              ${currentQIdx + 1}
            </span>
            
            <!-- Type Selector: MCQ vs Essay -->
            <div style="display: inline-flex; background: #f8fafc; padding: 2px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <button 
                type="button" 
                style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 700; border-radius: 4px; border: 1px solid ${isMcq ? '#0f172a' : 'transparent'}; background: ${isMcq ? '#0f172a' : 'transparent'}; color: ${isMcq ? '#ffffff' : '#475569'}; cursor: pointer;"
                onclick="window.centrlyApp.updateCurrentQuestionType('mcq')"
              >
                اختيار من متعدد (MCQ)
              </button>
              <button 
                type="button" 
                style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 700; border-radius: 4px; border: 1px solid ${!isMcq ? '#0f172a' : 'transparent'}; background: ${!isMcq ? '#0f172a' : 'transparent'}; color: ${!isMcq ? '#ffffff' : '#475569'}; cursor: pointer;"
                onclick="window.centrlyApp.updateCurrentQuestionType('essay')"
              >
                سؤال مقالي (Essay)
              </button>
            </div>

            <!-- Format Selector: Standard Text vs Image-Only -->
            <div style="display: inline-flex; background: #f8fafc; padding: 2px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <button 
                type="button" 
                style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 700; border-radius: 4px; border: 1px solid ${!isImageOnly ? '#0f172a' : 'transparent'}; background: ${!isImageOnly ? '#0f172a' : 'transparent'}; color: ${!isImageOnly ? '#ffffff' : '#475569'}; cursor: pointer;"
                onclick="window.centrlyApp.setWizardQuestionFormat('standard')"
              >
                سؤال نصي
              </button>
              <button 
                type="button" 
                style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 700; border-radius: 4px; border: 1px solid ${isImageOnly ? '#0f172a' : 'transparent'}; background: ${isImageOnly ? '#0f172a' : 'transparent'}; color: ${isImageOnly ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                onclick="window.centrlyApp.setWizardQuestionFormat('image_only')"
                title="تفعيل وضع صورة السؤال بالكامل من الكتاب أو المذكرة دون الحاجة لكتابة نص"
              >
                ${getIcon('camera', 13)}
                <span>السؤال صورة بالكامل</span>
              </button>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <label style="font-size: 0.78rem; font-weight: 700; color: #64748b;">درجة السؤال:</label>
            <input 
              type="number" 
              id="currentQPoints" 
              class="form-input" 
              value="${currentQ.points || 2}" 
              min="0.5" 
              step="0.5" 
              style="width: 60px; height: 30px; text-align: center; font-weight: 800; font-size: 0.88rem; border: 1px solid #cbd5e1; border-radius: 4px;"
              onchange="window.centrlyApp.updateCurrentQuestionField('points', this.value)"
            />
            <span style="font-size: 0.76rem; font-weight: 600; color: #64748b;">درجات</span>
          </div>
        </div>

        <!-- Question Body (Image-Only vs Standard Text) -->
        ${isImageOnly ? `
          <!-- Image-Only Hero Box -->
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; text-align: center;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem; text-align: right;">
              <div>
                <span style="font-size: 0.88rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                  ${getIcon('camera', 16)}
                  <span>صورة السؤال بالكامل (قص / لقطة شاشة من كتاب أو مذكرة):</span>
                </span>
                <span style="font-size: 0.74rem; color: #64748b;">
                  صيغة المسألة معروضة بالصورة كاملة دون الحاجة لكتابة أي نص.
                </span>
              </div>

              <div style="display: flex; align-items: center; gap: 0.45rem;">
                <input 
                  type="file" 
                  id="wizardQImageInput" 
                  accept="image/*" 
                   
                  style="display: none;" 
                  onchange="window.centrlyApp.handleWizardImageUpload(this.files[0])"
                />
                <button 
                  type="button" 
                  style="height: 30px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                  onclick="document.getElementById('wizardQImageInput').click()"
                >
                  ${getIcon('upload', 13, '#ffffff')}
                  <span>${currentQ.image_url ? 'تغيير صورة السؤال' : 'رفع / تصوير صورة السؤال'}</span>
                </button>

                ${currentQ.image_url ? `
                  <button 
                    type="button" 
                    style="height: 30px; padding: 0 9px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                    onclick="window.centrlyApp.removeWizardImage()"
                    title="إزالة الصورة"
                  >
                    ${getIcon('delete', 13, '#b91c1c')}
                    <span>حذف الصورة</span>
                  </button>
                ` : ''}
              </div>
            </div>

            ${currentQ.image_url ? `
              <div style="background: #ffffff; padding: 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; max-width: 100%;">
                <img 
                  src="${escapeHtml(currentQ.image_url)}" 
                  alt="صورة السؤال بالكامل" 
                  style="max-height: 260px; max-width: 100%; border-radius: 4px; object-fit: contain;"
                />
              </div>
            ` : `
              <div 
                style="padding: 1.5rem 1rem; border: 1px dashed #cbd5e1; background: #ffffff; border-radius: 6px; cursor: pointer;"
                onclick="document.getElementById('wizardQImageInput').click()"
              >
                <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a; margin-bottom: 0.2rem;">
                  اضغط هنا لاختيار أو التقاط صورة السؤال
                </div>
                <div style="font-size: 0.74rem; color: #64748b;">
                  (أو الصق لقطة الشاشة مباشرة بالضغط على <b>Ctrl + V</b> في أي مكان في الصفحة)
                </div>
              </div>
            `}

            <!-- Optional heading for the teacher -->
            <div style="margin-top: 0.65rem; text-align: right;">
              <details style="font-size: 0.78rem; color: #64748b;">
                <summary style="cursor: pointer; font-weight: 600; color: #475569;">
                  + إضافة عنوان أو ملاحظة نصية اختيارية تظهر فوق الصورة
                </summary>
                <input 
                  type="text" 
                  class="form-input" 
                  value="${escapeHtml(currentQ.text || '')}" 
                  placeholder="ملاحظة أو عنوان اختياري (اتركه فارغاً إذا كنت تريد الصورة فقط)..." 
                  style="margin-top: 0.4rem; font-size: 0.82rem; height: 32px;"
                  onchange="window.centrlyApp.updateCurrentQuestionField('text', this.value)"
                />
              </details>
            </div>

          </div>
        ` : `
          <!-- Standard Question Text Textarea & Secondary Image Upload -->
          <div style="margin-bottom: 0.85rem;">
            <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem; display: block;">
              نص السؤال ${currentQIdx + 1}:
            </label>
            <textarea 
              id="currentQText"
              class="form-input form-textarea" 
              rows="4" 
              placeholder="اكتب صيغة السؤال هنا بوضوح وبالتفصيل..."
              style="font-size: 0.95rem; font-weight: 600; width: 100%; min-height: 120px; height: auto; padding: 0.75rem 0.85rem; line-height: 1.6; border: 1.5px solid #cbd5e1; border-radius: 6px; resize: vertical;"
              onchange="window.centrlyApp.updateCurrentQuestionField('text', this.value)"
            >${escapeHtml(currentQ.text || '')}</textarea>
          </div>

          <!-- Question Image Upload (Mobile / Desktop) -->
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 0.65rem 0.85rem; margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="color: #64748b;">${getIcon('camera', 20)}</div>
              <div>
                <span style="font-size: 0.78rem; font-weight: 700; color: #0f172a; display: block;">صورة مسألة أو رسم توضيحي للسؤال (اختياري):</span>
                <span style="font-size: 0.72rem; color: #64748b;">التقط صورة بالكاميرا أو اختر صورة أو اضغط Ctrl+V</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <input 
                type="file" 
                id="wizardQImageInput" 
                accept="image/*" 
                 
                style="display: none;" 
                onchange="window.centrlyApp.handleWizardImageUpload(this.files[0])"
              />
              <button 
                type="button" 
                style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                onclick="document.getElementById('wizardQImageInput').click()"
              >
                ${getIcon('upload', 13)}
                <span>${currentQ.image_url ? 'تغيير الصورة' : 'رفع / تصوير صورة'}</span>
              </button>

              ${currentQ.image_url ? `
                <button 
                  type="button" 
                  style="height: 28px; padding: 0 8px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                  onclick="window.centrlyApp.removeWizardImage()"
                  title="إزالة الصورة"
                >
                  ${getIcon('delete', 13, '#b91c1c')}
                  <span>حذف الصورة</span>
                </button>
              ` : ''}
            </div>

            ${currentQ.image_url ? `
              <div style="width: 100%; margin-top: 0.5rem; text-align: center;">
                <img 
                  src="${escapeHtml(currentQ.image_url)}" 
                  alt="صورة السؤال" 
                  style="max-height: 180px; max-width: 100%; border-radius: 4px; border: 1px solid #cbd5e1;"
                />
                <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 0.5rem; background: #ffffff; padding: 0.4rem 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.78rem; font-weight: 700; color: #1e293b; flex-wrap: wrap;">
                  <span>موضع الصورة في الورقة المطبوعة:</span>
                  <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                    <input 
                      type="radio" 
                      name="wizardImgPlacement" 
                      value="side" 
                      ${currentQ.image_placement !== 'bottom' ? 'checked' : ''} 
                      onchange="window.centrlyApp.updateCurrentQuestionField('image_placement', 'side')"
                      style="accent-color: #0f172a;"
                    />
                    <span>بجانب السؤال (قياسي)</span>
                  </label>
                  <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                    <input 
                      type="radio" 
                      name="wizardImgPlacement" 
                      value="bottom" 
                      ${currentQ.image_placement === 'bottom' ? 'checked' : ''} 
                      onchange="window.centrlyApp.updateCurrentQuestionField('image_placement', 'bottom')"
                      style="accent-color: #0f172a;"
                    />
                    <span>أسفل السؤال بعرض كامل (صورة كبيرة)</span>
                  </label>
                </div>
              </div>
            ` : ''}
          </div>
        `}

        <!-- MCQ Choices or Essay Model Answer -->
        ${isMcq ? `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.45rem;">
              <span style="font-size: 0.78rem; font-weight: 700; color: #334155;">
                خيارات الإجابة (اختر الدائرة المقابلة للإجابة الصحيحة):
              </span>
              ${isImageOnly ? `
                <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">
                  إذا كانت الاختيارات موجودة بالصورة، اختر الدائرة الصحيحة فقط دون كتابة نص
                </span>
              ` : ''}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.65rem;">
              ${['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => {
                const isCorrect = Number(currentQ.correct_index) === optIdx;
                return `
                  <div style="display: flex; align-items: center; gap: 0.5rem; background: ${isCorrect ? '#f8fafc' : '#ffffff'}; border: 1px solid ${isCorrect ? '#0f172a' : '#e2e8f0'}; border-radius: 6px; padding: 0.45rem 0.65rem; transition: all 0.15s ease;">
                    <input 
                      type="radio" 
                      name="correctChoiceRadio" 
                      value="${optIdx}" 
                      ${isCorrect ? 'checked' : ''} 
                      style="width: 18px; height: 18px; cursor: pointer; accent-color: #0f172a;"
                      onchange="window.centrlyApp.setWizardCorrectChoice(${optIdx})"
                    />
                    <span style="font-weight: 800; font-size: 0.88rem; color: ${isCorrect ? '#0f172a' : '#64748b'}; width: 22px;">(${letter})</span>
                    <input 
                      type="text" 
                      class="form-input" 
                      value="${escapeHtml(currentQ.choices?.[optIdx] || '')}" 
                      placeholder="${isImageOnly ? `خيار (${letter}) - اختياري...` : `خيار (${letter})...`}" 
                      style="flex: 1; padding: 0.35rem 0.45rem; font-size: 0.85rem; font-weight: 600; border: none; background: transparent;"
                      onchange="window.centrlyApp.updateWizardChoice(${optIdx}, this.value)"
                    />
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : `
          <!-- Essay Model Answer Box -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem;">
            <label style="font-size: 0.78rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem;">
              <span>الإجابة النموذجية الاسترشادية:</span>
            </label>
            <textarea 
              class="form-input form-textarea" 
              rows="3" 
              placeholder="اكتب خطوات الحل أو الإجابة النموذجية المعتمدة ليسترشد بها المعلم أثناء التصحيح..."
              style="font-size: 0.88rem; font-weight: 600; width: 100%; min-height: 90px; height: auto; padding: 0.65rem 0.75rem; border: 1.5px solid #cbd5e1; background: #ffffff; border-radius: 6px; resize: vertical;"
              onchange="window.centrlyApp.updateCurrentQuestionField('model_answer', this.value)"
            >${escapeHtml(currentQ.model_answer || '')}</textarea>
          </div>
        `}

        <!-- Step Navigation Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem; margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 0.85rem;">
          
          <button 
            type="button" 
            style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; ${currentQIdx === 0 ? 'opacity: 0.4; cursor: not-allowed;' : ''}"
            ${currentQIdx === 0 ? 'disabled' : ''}
            onclick="window.centrlyApp.prevQuestion()"
          >
            ${getIcon('arrowRight', 14)}
            <span>السؤال السابق</span>
          </button>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button 
              type="button" 
              style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 600; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer;"
              onclick="window.centrlyApp.cancelOnlineExamWizard()"
            >
              إلغاء والعودة
            </button>

            ${currentQIdx < totalQuestions - 1 ? `
              <button 
                type="button" 
                style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                onclick="window.centrlyApp.nextQuestion()"
              >
                <span>السؤال التالي</span>
                ${getIcon('arrowLeft', 14, '#ffffff')}
              </button>
            ` : `
              <button 
                type="button" 
                style="height: 32px; padding: 0 16px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                onclick="window.centrlyApp.saveOnlineExamNow()"
              >
                ${getIcon('check', 13, '#ffffff')}
                <span>إنهاء وحفظ الامتحان</span>
              </button>
            `}
          </div>

        </div>

      </div>

    </div>
  `;
}

// ============================================================================
// ONLINE RESULTS COMPONENT (نتائج ودرجات الامتحانات الإلكترونية)
// ============================================================================
function renderOnlineGradingResultsCard(gradedSubmissions = [], activeGroup = null, showCreateBtn = true, state = {}) {
  const allList = Array.isArray(gradedSubmissions) ? gradedSubmissions : [];
  const appQuizzesState = window.centrlyApp?.quizzesState || {};
  const currentFilter = (state && state.gradingFilterQuizNumber !== undefined && state.gradingFilterQuizNumber !== null)
    ? String(state.gradingFilterQuizNumber)
    : (appQuizzesState.gradingFilterQuizNumber || 'all');

  // Extract distinct quizzes from submissions and richQuizzes
  const quizMap = new Map();
  allList.forEach(s => {
    const qNum = s.quiz_number !== undefined ? String(s.quiz_number) : (s.quiz_id ? String(s.quiz_id) : '1');
    const qTitle = s.quiz_title || `كويز ${qNum}`;
    if (!quizMap.has(qNum)) {
      quizMap.set(qNum, { number: qNum, title: qTitle, count: 0 });
    }
    quizMap.get(qNum).count++;
  });

  const richList = (state && state.richQuizzes) || appQuizzesState.richQuizzes || [];
  richList.forEach(rq => {
    const qNum = String(rq.quiz_number || 1);
    const qTitle = rq.title || `كويز ${qNum}`;
    if (!quizMap.has(qNum)) {
      quizMap.set(qNum, { number: qNum, title: qTitle, count: 0 });
    }
  });

  const availableQuizzes = Array.from(quizMap.values()).sort((a, b) => Number(a.number) - Number(b.number));

  // Filter submissions by chosen quiz
  const list = (currentFilter === 'all')
    ? allList
    : allList.filter(s => String(s.quiz_number) === currentFilter || String(s.quiz_id) === currentFilter);

  return `
    <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1.15rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.65rem;">
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
            <span>نتائج ودرجات الامتحانات الإلكترونية المعتمدة</span>
            <span style="font-size: 0.7rem; font-weight: 700; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 4px;">
              الدرجة الإجمالية كاملة (موضوعي + مقالي)
            </span>
          </h4>
          <p style="font-size: 0.76rem; color: #64748b; margin: 0.2rem 0 0 0;">
            تظهر هنا درجات الطلاب المعتمدة للاختبارات الإلكترونية عبر هواتفهم شاملة التصحيح التلقائي والمقالي.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <!-- Dropdown Quiz Filter -->
          <div style="display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 3px 8px;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #1e293b; white-space: nowrap;">تصفية حسب الكويز:</span>
            <select 
              style="height: 28px; font-size: 0.76rem; font-weight: 700; color: #0f172a; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; outline: none; cursor: pointer; padding: 0 6px;"
              onchange="window.centrlyApp.setGradingQuizFilter(this.value)"
            >
              <option value="all" ${currentFilter === 'all' ? 'selected' : ''}>جميع الامتحانات (${allList.length} نتيجة)</option>
              ${availableQuizzes.map(q => `
                <option value="${q.number}" ${currentFilter === String(q.number) ? 'selected' : ''}>
                  ${escapeHtml(q.title || 'كويز ' + q.number)} (${q.count} طلاب)
                </option>
              `).join('')}
            </select>
          </div>

          <span style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; font-size: 0.74rem; font-weight: 700; padding: 4px 8px; border-radius: 4px; white-space: nowrap;">
            المعروض: ${list.length}
          </span>

          <button 
            type="button"
            style="height: 28px; width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 5px; color: #64748b; cursor: pointer;"
            onclick="window.centrlyApp.loadOnlineSubmissions(); window.centrlyApp.renderMainContent();"
            title="تحديث البيانات"
          >
            ${getIcon('refresh', 12)}
          </button>
        </div>
      </div>

      ${list.length > 0 ? `
        <div style="overflow-x: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: right;">
                <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">كود الطالب</th>
                <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">اسم الطالب</th>
                <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">الامتحان الإلكتروني</th>
                <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b; text-align: center;">الدرجة المحققة (الكاملة)</th>
                <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b; text-align: center;">النسبة المئوية</th>
                <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b; text-align: center;">تاريخ الحل</th>
                <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">نوع التقييم</th>
                <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b; text-align: center;">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(sub => {
                const rawScore = sub.total_score !== undefined && sub.total_score !== null
                  ? sub.total_score
                  : (sub.final_score !== undefined && sub.final_score !== null
                      ? sub.final_score
                      : (sub.score !== undefined && sub.score !== null
                          ? sub.score
                          : ((Number(sub.mcq_score || 0)) + (Number(sub.essay_score || 0)))));
                const numScore = Number(rawScore || 0);
                const maxSc = Number(sub.max_score || 10);
                const pct = Math.round((numScore / (maxSc || 1)) * 100);

                const hasEssay = Boolean(sub.has_essay || sub.essay_score !== undefined || (sub.essay_answers && Object.keys(sub.essay_answers).length > 0));
                let badge = '<span style="background: #f8fafc; color: #475569; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">تصحيح تلقائي 100%</span>';
                if (hasEssay) {
                  badge = '<span style="background: #ecfdf5; color: #065f46; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 3px;"><span>معتمد وشامل المقالي</span> ✔</span>';
                }

                return `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 0.65rem 0.75rem; font-family: monospace; font-weight: 700; font-size: 0.85rem; color: #0f172a;">${escapeHtml(sub.student_code || '—')}</td>
                    <td style="padding: 0.65rem 0.75rem; font-weight: 700; font-size: 0.85rem; color: #0f172a;">${escapeHtml(sub.student_name || 'طالب')}</td>
                    <td style="padding: 0.65rem 0.75rem; font-weight: 600; font-size: 0.8rem; color: #475569;">${escapeHtml(sub.quiz_title || `كويز ${sub.quiz_number || 1}`)}</td>
                    <td style="padding: 0.65rem 0.75rem; text-align: center;">
                      <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">${numScore} / ${maxSc}</div>
                      ${hasEssay ? `
                        <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px; font-weight: 600;">
                          (موضوعي: ${sub.mcq_score ?? 0} + مقالي: ${sub.essay_score !== undefined ? sub.essay_score : Math.max(0, numScore - Number(sub.mcq_score || 0))})
                        </div>
                      ` : ''}
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: center;">
                      <span style="background: ${pct >= 85 ? '#ecfdf5' : pct >= 50 ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${pct >= 85 ? '#a7f3d0' : pct >= 50 ? '#bbf7d0' : '#fecaca'}; border-radius: 4px; padding: 2px 7px; font-weight: 800; font-size: 0.78rem; color: ${pct >= 85 ? '#166534' : pct >= 50 ? '#15803d' : '#991b1b'};">
                        ${pct}%
                      </span>
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: center; font-size: 0.74rem; color: #64748b;">${escapeHtml((sub.submitted_at || '').slice(0, 16).replace('T', ' '))}</td>
                    <td style="padding: 0.65rem 0.75rem;">${badge}</td>
                    <td style="padding: 0.65rem 0.75rem; text-align: center;">
                      <button 
                        type="button" 
                        style="height: 26px; padding: 0 8px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #166534; border: 1px solid #86efac; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                        onclick="window.centrlyApp.sendQuizScoreWhatsApp('${sub.student_code || sub.student_id}', '${escapeHtml(sub.student_name)}', '${escapeHtml(sub.quiz_title || `كويز ${sub.quiz_number || 1}`)}', 'both', ${numScore}, ${maxSc})"
                      >
                        ${getIcon('whatsapp', 12, '#166534')}
                        <span>واتساب</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div style="text-align: center; padding: 2.2rem 1.5rem; background: #fafafa; border: 1px dashed #cbd5e1; border-radius: 8px;">
          <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a; margin-bottom: 0.25rem;">
            ${currentFilter !== 'all' ? 'لا توجد نتائج مسجلة لهذا الكويز حتى الآن' : 'لا توجد درجات معتمدة للامتحانات الإلكترونية بعد'}
          </div>
          <p style="font-size: 0.78rem; color: #64748b; margin: 0 auto 0.75rem auto; max-width: 440px; line-height: 1.5;">
            ${currentFilter !== 'all' ? 'يمكنك اختيار كويز آخر من القائمة بالأعلى أو الضغط أدناه للعودة لعرض كافة النتائج.' : 'هذا القسم يعرض نتائج الامتحانات التي سلمها الطلاب إلكترونياً بعد اعتماد درجاتها كاملة.'}
          </p>
          ${currentFilter !== 'all' ? `
            <button 
              type="button" 
              style="height: 30px; padding: 0 14px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer;"
              onclick="window.centrlyApp.setGradingQuizFilter('all')"
            >
              عرض نتائج جميع الامتحانات
            </button>
          ` : (showCreateBtn ? `
            <button 
              type="button" 
              style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer;"
              onclick="window.centrlyApp.switchQuizSubTab('online_builder')"
            >
              + إنشاء كويز أونلاين جديد للطلاب
            </button>
          ` : '')}
        </div>
      `}
    </div>
  `;
}

// ============================================================================
// TAB 2: ONLINE GRADING (تصحيح الامتحانات الإلكترونية)
// ============================================================================
function renderOnlineGradingTab(state, groups, activeGroup, pendingSubmissions, onlineSubmissions) {
  const submissionsList = Array.isArray(onlineSubmissions) ? onlineSubmissions : [];
  const gradedSubmissions = submissionsList.filter(sub => sub.status === 'approved' || sub.is_graded || sub.status === 'graded');
  const pending = Array.isArray(pendingSubmissions) ? pendingSubmissions : [];
  const gradingViewMode = state.gradingViewMode || (pending.length > 0 ? 'pending' : 'graded'); // 'pending' (مقالي) | 'graded' (النتائج)

  return `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      
      <!-- Grading Header & Sub-Switcher (Calm Swiss Minimalist) -->
      <div class="card" style="margin: 0; padding: 0.85rem 1.15rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
          <div>
            <h3 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
              <span>تصحيح الامتحانات الإلكترونية واعتماد الدرجات</span>
            </h3>
            <p style="font-size: 0.78rem; color: #64748b; margin: 0.2rem 0 0 0;">
              الأسئلة الاختيارية تُصحح تلقائياً فورياً، والأسئلة المقالية تُراجع هنا مع نموذج الإجابة لاعتماد الدرجة النهائية.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button 
              type="button" 
              style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; border-radius: 5px; border: 1px solid ${gradingViewMode === 'graded' ? '#0f172a' : '#e2e8f0'}; background: ${gradingViewMode === 'graded' ? '#0f172a' : '#ffffff'}; color: ${gradingViewMode === 'graded' ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
              onclick="window.centrlyApp.switchGradingViewMode('graded')"
            >
              <span>النتائج والدرجات المعتمدة</span>
              ${gradedSubmissions.length > 0 ? `
                <span style="background: ${gradingViewMode === 'graded' ? '#10b981' : '#ecfdf5'}; color: ${gradingViewMode === 'graded' ? '#ffffff' : '#065f46'}; font-size: 0.68rem; padding: 1px 6px; border-radius: 10px; font-weight: 800;">
                  ${gradedSubmissions.length}
                </span>
              ` : ''}
            </button>

            <button 
              type="button" 
              style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; border-radius: 5px; border: 1px solid ${gradingViewMode === 'pending' ? '#0f172a' : '#e2e8f0'}; background: ${gradingViewMode === 'pending' ? '#0f172a' : '#ffffff'}; color: ${gradingViewMode === 'pending' ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
              onclick="window.centrlyApp.switchGradingViewMode('pending')"
            >
              <span>امتحانات تحتاج تصحيح يدوي (مقالي)</span>
              ${pending.length > 0 ? `
                <span style="background: ${gradingViewMode === 'pending' ? '#ef4444' : '#fee2e2'}; color: ${gradingViewMode === 'pending' ? '#ffffff' : '#991b1b'}; font-size: 0.68rem; padding: 1px 6px; border-radius: 10px; font-weight: 800;">
                  ${pending.length}
                </span>
              ` : ''}
            </button>

            <button 
              type="button" 
              style="height: 32px; width: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 5px; color: #64748b; cursor: pointer;"
              onclick="window.centrlyApp.loadOnlineSubmissions(); window.centrlyApp.renderMainContent();"
              title="تحديث البيانات"
            >
              ${getIcon('refresh', 13)}
            </button>
          </div>
        </div>
      </div>

      <!-- VIEW A: PENDING ESSAY SUBMISSIONS -->
      ${gradingViewMode === 'pending' ? `
        ${pending.length > 0 ? pending.map((sub, sIdx) => {
          const questions = Array.isArray(sub.questions) ? sub.questions : [];
          let essayQuestions = questions.filter(q => q.type === 'essay');
          if (essayQuestions.length === 0 && sub.essay_answers && Object.keys(sub.essay_answers).length > 0) {
            essayQuestions = Object.keys(sub.essay_answers).map((k, i) => ({
              id: k,
              text: `سؤال مقالي (${i + 1})`,
              points: 5,
              model_answer: 'لا توجد إجابة نموذجية مسجلة'
            }));
          }
          const mcqScore = sub.mcq_score || 0;
          const totalMcq = sub.total_mcq_points || 0;
          const studentGroup = (groups || []).find(g => String(g.id).trim() === String(sub.group_id).trim());
          const groupBadge = studentGroup ? `<span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${escapeHtml(studentGroup.name)}</span>` : '';

          return `
            <div class="card" style="margin: 0; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 8px; padding: 1rem;">
              
              <!-- Student Header -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.65rem; margin-bottom: 0.75rem; flex-wrap: gap; gap: 0.65rem;">
                <div>
                  <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a; display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                    <span>${escapeHtml(sub.student_name || 'طالب')}</span>
                    <span style="font-size: 0.76rem; color: #64748b; font-weight: 600;">(كود: ${escapeHtml(sub.student_code || '1006')})</span>
                    ${groupBadge}
                  </div>
                  <div style="font-size: 0.74rem; color: #64748b; margin-top: 0.15rem;">
                    ${escapeHtml(sub.quiz_title || 'كويز إلكتروني')} • كويز ${sub.quiz_number || 1} • تاريخ التسليم: ${escapeHtml((sub.submitted_at || '').slice(0, 16).replace('T', ' '))}
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 0.25rem 0.65rem; text-align: center;">
                    <span style="font-size: 0.68rem; color: #64748b; font-weight: 600; display: block;">درجة الاختياري (تلقائي)</span>
                    <span style="font-weight: 800; color: #0f172a; font-size: 0.88rem;">${mcqScore} / ${totalMcq}</span>
                  </div>
                </div>
              </div>

              <!-- Essay Questions to Grade -->
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${essayQuestions.map((eq, eqIdx) => {
                  const qRealIdx = questions.findIndex(q => q === eq || (eq.id && q.id === eq.id));
                  const studentAns = 
                    sub.essay_answers?.[eq.id] || 
                    (qRealIdx >= 0 && sub.essay_answers?.[qRealIdx]) || 
                    sub.essay_answers?.[eqIdx] || 
                    sub.answers?.[eq.id] || 
                    (qRealIdx >= 0 && sub.answers?.[qRealIdx]) || 
                    sub.answers?.[eqIdx + 1] || 
                    sub.answers?.[eqIdx] || 
                    'لم يكتب إجابة';

                  const fieldKey = eq.id || String(eqIdx);

                  return `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem;">
                      
                      <div style="font-weight: 700; font-size: 0.85rem; color: #0f172a; margin-bottom: 0.35rem;">
                        سؤال مقالي (${eqIdx + 1}): ${escapeHtml(eq.text || '')}
                      </div>

                      ${eq.image_url ? `
                        <div style="margin-bottom: 0.45rem;">
                          <img src="${escapeHtml(eq.image_url)}" alt="صورة السؤال" style="max-height: 130px; border-radius: 5px; border: 1px solid #cbd5e1;" />
                        </div>
                      ` : ''}

                      <!-- Model Answer Box -->
                      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 5px; padding: 0.5rem 0.7rem; margin-bottom: 0.5rem;">
                        <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; margin-bottom: 0.15rem;">
                          الإجابة النموذجية الاسترشادية:
                        </div>
                        <div style="font-size: 0.8rem; color: #334155; line-height: 1.5;">
                          ${escapeHtml(eq.model_answer || 'لا توجد إجابة نموذجية مسجلة')}
                        </div>
                      </div>

                      <!-- Student Written Answer Box -->
                      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 5px; padding: 0.55rem 0.75rem; margin-bottom: 0.55rem;">
                        <div style="font-size: 0.72rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem;">
                          حل وإجابة الطالب:
                        </div>
                        <div style="font-size: 0.85rem; font-weight: 600; color: #0f172a; line-height: 1.6; white-space: pre-wrap;">
                          ${escapeHtml(studentAns)}
                        </div>
                      </div>

                      <!-- Score Input for this Question -->
                      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                          <label style="font-size: 0.78rem; font-weight: 700; color: #0f172a;">تقدير درجة المقالي:</label>
                          <input 
                            type="number" 
                            id="essay_pts_${sub.id}_${fieldKey}" 
                            min="0" 
                            max="${eq.points || 5}" 
                            step="0.5" 
                            value="${eq.points || 5}" 
                            class="form-input" 
                            style="width: 65px; height: 30px; text-align: center; font-weight: 800; font-size: 0.88rem; border: 1px solid #cbd5e1; border-radius: 4px;"
                          />
                          <span style="font-size: 0.76rem; font-weight: 600; color: #64748b;">من ${eq.points || 5} درجات</span>
                        </div>
                      </div>

                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Grading Footer Actions -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 0.65rem; margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
                <input 
                  type="text" 
                  id="grading_note_${sub.id}" 
                  class="form-input" 
                  placeholder="ملاحظة أو تعليق للطالب على حله المقالي (اختياري)..." 
                  style="flex: 1; min-width: 220px; height: 32px; font-size: 0.78rem; border: 1px solid #cbd5e1; border-radius: 4px;"
                />

                <button 
                  type="button" 
                  style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  onclick="window.centrlyApp.submitManualEssayGrade('${sub.id}', '${sub.student_code || sub.student_id || '1006'}', ${sub.quiz_number || 1})"
                >
                  ${getIcon('check', 13, '#ffffff')}
                  <span>اعتماد الدرجة النهائية وتثبيتها</span>
                </button>
              </div>

            </div>
          `;
        }).join('') : `
          <div style="text-align: center; padding: 2.5rem 1.5rem; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px;">
            <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a; margin-bottom: 0.25rem;">لا توجد أسئلة مقالية معلقة في انتظار التصحيح</div>
            <p style="font-size: 0.78rem; color: #64748b; margin: 0;">
              كافة إجابات الطلاب مصححة بالكامل، أو لم يقم الطلاب بتسليم امتحانات مقالية جديدة بعد.
            </p>
          </div>
        `}
      ` : `
        <!-- VIEW B: GRADED RESULTS OVERVIEW -->
        ${renderOnlineGradingResultsCard(gradedSubmissions, activeGroup, true, state)}
      `}

    </div>
  `;
}

// ============================================================================

// ============================================================================
// PAPER EXAM & BUBBLE SHEET RENDER HELPERS (Full Page Fit, Shuffled MCQs & Essay Ruled Lines)
// ============================================================================
function getStealthModelQuestions(quiz, modelLetter = 'A') {
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  if (questions.length === 0) return [];

  // Strictly separate MCQs and Essay questions:
  // MCQs always appear first (1 .. M), Essay questions always appear at the end (M+1 .. N)
  const mcqs = questions.filter(q => q.type !== 'essay');
  const essays = questions.filter(q => q.type === 'essay');

  let processedMcqs = [];

  if (modelLetter === 'B') {
    // Model B: Reverse MCQ question order, rotate choices by +1
    const reversedMcqs = [...mcqs].reverse();
    processedMcqs = reversedMcqs.map((q, idx) => {
      const origChoices = Array.isArray(q.choices) && q.choices.length === 4 
        ? q.choices 
        : [q.choices?.[0] || '', q.choices?.[1] || '', q.choices?.[2] || '', q.choices?.[3] || ''];
      
      // Rotate choices: [c1, c2, c3, c0]
      const shiftedChoices = [origChoices[1], origChoices[2], origChoices[3], origChoices[0]];
      const origCorrect = Number(q.correct_index !== undefined && q.correct_index !== null ? q.correct_index : (q.correct_answer ?? 0));
      // Choice at index k moves to (k - 1 + 4) % 4
      const shiftedCorrect = (origCorrect - 1 + 4) % 4;

      return {
        ...q,
        choices: shiftedChoices,
        correct_index: shiftedCorrect,
        correct_answer: shiftedCorrect,
        original_index: questions.indexOf(q),
        model_number: 2
      };
    });
  } else if (modelLetter === 'C') {
    // Model C: Alternate interleaved MCQ order (odds then evens), rotate choices by +2
    const evens = mcqs.filter((_, i) => i % 2 === 0);
    const odds = mcqs.filter((_, i) => i % 2 !== 0);
    const permutedMcqs = [...odds, ...evens];

    processedMcqs = permutedMcqs.map((q, idx) => {
      const origChoices = Array.isArray(q.choices) && q.choices.length === 4 
        ? q.choices 
        : [q.choices?.[0] || '', q.choices?.[1] || '', q.choices?.[2] || '', q.choices?.[3] || ''];
      
      // Rotate choices: [c2, c3, c0, c1]
      const shiftedChoices = [origChoices[2], origChoices[3], origChoices[0], origChoices[1]];
      const origCorrect = Number(q.correct_index !== undefined && q.correct_index !== null ? q.correct_index : (q.correct_answer ?? 0));
      // Choice at index k moves to (k - 2 + 4) % 4
      const shiftedCorrect = (origCorrect - 2 + 4) % 4;

      return {
        ...q,
        choices: shiftedChoices,
        correct_index: shiftedCorrect,
        correct_answer: shiftedCorrect,
        original_index: questions.indexOf(q),
        model_number: 3
      };
    });
  } else {
    // Model A: Original MCQ order and original choices
    processedMcqs = mcqs.map((q, idx) => ({
      ...q,
      original_index: questions.indexOf(q),
      model_number: 1
    }));
  }

  // Essay questions ALWAYS stay at the end in their original order with custom answer lines
  const processedEssays = essays.map((eq, eIdx) => ({
    ...eq,
    essay_lines: Math.max(1, Number(eq.essay_lines) || 4),
    original_index: questions.indexOf(eq),
    model_number: modelLetter === 'B' ? 2 : (modelLetter === 'C' ? 3 : 1)
  }));

  return [...processedMcqs, ...processedEssays];
}

function getModelInfo(quiz, modelLetter) {
  const selectedModel = modelLetter || 'A';
  const modelCode = selectedModel === 'A' ? '01' : selectedModel === 'B' ? '02' : '03';
  const examCode = quiz?.exam_code || `EX-${quiz?.quiz_number || 1}`;
  const barcodeSerial = `REF-${(quiz?.subject || 'PHY').slice(0, 3)}-${examCode}-${modelCode}`;
  return { selectedModel, modelCode, examCode, barcodeSerial };
}

function renderExamSheetHtml(targetQuiz, modelLetter = 'A', studentNumber = null, totalStudents = null, isPrint = false) {
  const { selectedModel, modelCode, examCode, barcodeSerial } = getModelInfo(targetQuiz, modelLetter);
  const questions = getStealthModelQuestions(targetQuiz, selectedModel);
  const totalPoints = questions.reduce((s, q) => s + Number(q.points || 1), 0);

  const containerClass = isPrint ? 'centrly-exam-sheet' : 'printable-exam-paper';
  // Full Page Fit: In print mode, min-height and height fill the full A4 page (calc(297mm - 16mm)) with flex space-between
  const containerStyle = isPrint 
    ? 'box-sizing: border-box; width: 100%; min-height: 278mm; padding: 7mm 8mm; background: #ffffff; color: #000000; font-family: "Cairo", sans-serif; direction: rtl; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid #000000;'
    : 'background: #ffffff; border: 2px solid #000000; border-radius: 4px; padding: 1.25rem 1.15rem; box-shadow: 0 4px 14px rgba(0,0,0,0.08); font-family: "Cairo", sans-serif; width: 100%; max-width: 800px; min-height: 1020px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden; direction: rtl; display: flex; flex-direction: column; justify-content: space-between;';

  return `
    <div class="${containerClass}" style="${containerStyle}">
      
      <!-- Top Section: Header & Student Info -->
      <div style="flex-shrink: 0;">
        <!-- Compact Exam Header (Fits cleanly on A4) -->
        <div style="border-bottom: 2px solid #000000; padding-bottom: 0.5rem; margin-bottom: 0.65rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
            <div style="text-align: right; flex: 1; min-width: 180px;">
              <h1 style="font-size: 1.25rem; font-weight: 900; margin: 0 0 0.15rem 0; color: #000000; line-height: 1.25;">
                امتحان مادة ${escapeHtml(targetQuiz.subject || 'الفيزياء')}
              </h1>
              <div style="font-size: 0.82rem; font-weight: 800; color: #222222; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                <span>${escapeHtml(targetQuiz.title || 'اختبار دوري')}</span>
                <span>•</span>
                <span style="font-family: monospace; font-weight: 900; background: #f1f5f9; padding: 1px 6px; border-radius: 3px; border: 1px solid #cbd5e1; font-size: 0.78rem;">
                  كود: ${escapeHtml(examCode)}
                </span>

                ${studentNumber ? `
                  <span style="font-size: 0.72rem; font-weight: 800; color: #0f172a; background: #e2e8f0; padding: 1px 6px; border-radius: 3px;">
                    طالب (${studentNumber} من ${totalStudents})
                  </span>
                ` : ''}
              </div>
            </div>

            <!-- Stealth Barcode in Header -->
            <div style="border: 1.5px solid #000000; padding: 0.25rem 0.6rem; border-radius: 3px; text-align: center; background: #ffffff; flex-shrink: 0;">
              <div style="font-family: monospace; font-size: 0.72rem; font-weight: 900; letter-spacing: 1px; color: #000000; line-height: 1;">
                ||||| | |||| ||| |||| | ||
              </div>
              <div style="font-family: monospace; font-size: 0.65rem; font-weight: 800; color: #333333; margin-top: 2px;">
                ${escapeHtml(barcodeSerial)}
              </div>
            </div>
          </div>

          <!-- Responsive Student Info Line -->
          <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem; padding-top: 0.45rem; border-top: 1px dashed #000000; font-size: 0.82rem; font-weight: 800;">
            <div style="flex: 2; min-width: 140px; display: flex; align-items: baseline; gap: 4px;">
              <span style="white-space: nowrap;">اسم الطالب:</span>
              <div style="flex: 1; border-bottom: 1.5px dotted #000000; min-height: 12px;"></div>
            </div>
            <div style="flex: 1.2; min-width: 110px; display: flex; align-items: baseline; gap: 4px;">
              <span style="white-space: nowrap;">المجموعة:</span>
              <div style="flex: 1; border-bottom: 1.5px dotted #000000; min-height: 12px;"></div>
            </div>
            <div style="flex: 1; min-width: 90px; display: flex; align-items: baseline; gap: 4px;">
              <span style="white-space: nowrap;">كود الطالب:</span>
              <div style="flex: 1; border-bottom: 1.5px dotted #000000; min-height: 12px;"></div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 0.35rem; font-size: 0.78rem; font-weight: 700; color: #444444;">
            <span>الزمن المخصص: <b>${targetQuiz.time_limit_minutes || 30} دقيقة</b></span>
            <span>الدرجة العظمى: <b>${totalPoints} درجات</b></span>
          </div>
        </div>
      </div>

      <!-- Center Section: Questions List (MCQs First, Essay at the End) -->
      <div class="centrly-questions-container" style="flex: 1 1 auto; display: flex; flex-direction: column; gap: 0.65rem;">
        ${questions.map((q, idx) => {
          const hasImage = !!q.image_url;
          const hasText = !!(q.text && q.text.trim());
          const isImageOnly = (q.format === 'image_only') || (!hasText && hasImage);
          const isWideImage = q.image_placement === 'bottom' || q.image_size === 'large';
          const isMcq = q.type !== 'essay';
          const pointsText = `[${q.points || 1} درجات]`;
          const essayLineCount = Math.max(1, Number(q.essay_lines) || 4);

          // Auto-detect choice column layout
          const maxChoiceLen = (q.choices || []).reduce((max, c) => Math.max(max, (c || '').length), 0);
          const choiceGridCols = maxChoiceLen > 28 ? '1fr' : 'repeat(2, 1fr)';

          const renderChoices = (paddingRight = '1.25rem') => `
            <div style="display: grid; grid-template-columns: ${choiceGridCols}; gap: 0.35rem 0.65rem; padding-right: ${paddingRight}; width: 100%;">
              ${['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => {
                const optText = q.choices?.[optIdx]?.trim();
                return `
                  <div style="font-size: 0.84rem; font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
                    <span style="display: inline-block; width: 18px; height: 18px; border: 1.5px solid #000000; border-radius: 50%; text-align: center; line-height: 16px; font-weight: 900; font-size: 0.74rem; flex-shrink: 0;">${letter}</span>
                    <span>${optText ? escapeHtml(optText) : ''}</span>
                  </div>
                `;
              }).join('')}
            </div>
          `;

          const renderEssayLines = () => `
            <div style="margin-top: 0.45rem; width: 100%; display: flex; flex-direction: column; gap: 0;">
              ${Array.from({ length: essayLineCount }).map((_, lIdx) => `
                <div style="height: 27px; border-bottom: 1.2px dotted #444444; width: 100%; display: flex; align-items: flex-end; padding-bottom: 1px;">
                  <span style="font-size: 0.65rem; color: #888888; font-family: monospace; user-select: none;">${lIdx + 1}.</span>
                </div>
              `).join('')}
            </div>
          `;

          // CASE 1: Standard Question with Normal Image -> SIDE-BY-SIDE (الوضع القياسي في امتحانات الثانوية)
          if (hasImage && !isImageOnly && !isWideImage) {
            return `
              <div class="no-split-question" style="break-inside: avoid !important; page-break-inside: avoid !important; padding-bottom: 0.45rem; border-bottom: 1px dashed #cbd5e1;">
                <div style="display: flex; gap: 0.85rem; align-items: flex-start; justify-content: space-between;">
                  <!-- Right Column: Question Text + Choices / Ruled Lines -->
                  <div style="flex: 1 1 0%; min-width: 0;">
                    <div style="font-weight: 800; font-size: 0.90rem; line-height: 1.5; text-align: right; margin-bottom: 0.4rem;">
                      <span style="font-weight: 900; margin-left: 0.25rem;">(${idx + 1})</span>
                      <span>${escapeHtml(q.text)}</span>
                      <span style="font-size: 0.76rem; font-weight: 700; color: #555555; margin-right: 0.35rem;">${pointsText}</span>
                    </div>

                    ${isMcq ? renderChoices('0.35rem') : renderEssayLines()}
                  </div>

                  <!-- Left Column: Figure Box (الشكل المقابل) -->
                  <div style="flex-shrink: 0; width: 220px; max-width: 36%; text-align: center;">
                    <div style="display: inline-block; border: 1.5px solid #000000; border-radius: 4px; padding: 4px; background: #ffffff; width: 100%; box-sizing: border-box;">
                      <img 
                        src="${escapeHtml(q.image_url)}" 
                        alt="صورة السؤال" 
                        style="max-height: 140px; max-width: 100%; width: auto; object-fit: contain; display: block; margin: 0 auto;" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            `;
          }

          // CASE 2: Image-Only Question (Hero Image centered)
          if (isImageOnly) {
            return `
              <div class="no-split-question" style="break-inside: avoid !important; page-break-inside: avoid !important; padding-bottom: 0.45rem; border-bottom: 1px dashed #cbd5e1;">
                <div style="margin-bottom: 0.45rem;">
                  <div style="font-weight: 800; font-size: 0.90rem; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
                    <span><span style="font-weight: 900; margin-left: 0.25rem;">(${idx + 1})</span> ${q.text ? escapeHtml(q.text) : 'سؤال مصور من المسألة الموضحة أدناه:'}</span>
                    <span style="font-size: 0.76rem; font-weight: 700; color: #555555;">${pointsText}</span>
                  </div>
                  <div style="text-align: center; margin: 0.4rem 0;">
                    <img 
                      src="${escapeHtml(q.image_url)}" 
                      alt="صورة السؤال" 
                      style="max-height: 280px; max-width: 95%; border: 1.5px solid #000000; border-radius: 4px; padding: 4px; object-fit: contain;" 
                    />
                  </div>
                </div>
                ${isMcq ? renderChoices('1.25rem') : renderEssayLines()}
              </div>
            `;
          }

          // CASE 3: Wide / Large Image (Centered below Question Text)
          if (hasImage && isWideImage) {
            return `
              <div class="no-split-question" style="break-inside: avoid !important; page-break-inside: avoid !important; padding-bottom: 0.45rem; border-bottom: 1px dashed #cbd5e1;">
                <div style="margin-bottom: 0.45rem;">
                  <div style="font-weight: 800; font-size: 0.90rem; line-height: 1.5; text-align: right; margin-bottom: 0.35rem;">
                    <span style="font-weight: 900; margin-left: 0.25rem;">(${idx + 1})</span>
                    <span>${escapeHtml(q.text)}</span>
                    <span style="font-size: 0.76rem; font-weight: 700; color: #555555; margin-right: 0.35rem;">${pointsText}</span>
                  </div>

                  <div style="text-align: center; margin: 0.45rem 0;">
                    <div style="display: inline-block; border: 1.5px solid #000000; border-radius: 4px; padding: 4px; background: #ffffff;">
                      <img 
                        src="${escapeHtml(q.image_url)}" 
                        alt="صورة السؤال" 
                        style="max-height: 230px; max-width: 440px; width: auto; object-fit: contain; display: block; margin: 0 auto;" 
                      />
                    </div>
                  </div>
                </div>
                ${isMcq ? renderChoices('1.25rem') : renderEssayLines()}
              </div>
            `;
          }

          // CASE 4: Standard Question without Image
          return `
            <div class="no-split-question" style="break-inside: avoid !important; page-break-inside: avoid !important; padding-bottom: 0.45rem; border-bottom: 1px dashed #cbd5e1;">
              <div style="font-weight: 800; font-size: 0.88rem; line-height: 1.45; margin-bottom: 0.45rem; text-align: right;">
                <span style="font-weight: 900; margin-left: 0.25rem;">(${idx + 1})</span>
                <span>${escapeHtml(q.text || '')}</span>
                <span style="font-size: 0.75rem; font-weight: 700; color: #555555; margin-right: 0.35rem;">${pointsText}</span>
              </div>
              ${isMcq ? renderChoices('1.25rem') : renderEssayLines()}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Bottom Pinned Footer Notice -->
      <div style="text-align: center; margin-top: auto; padding-top: 0.6rem; border-top: 1.5px solid #000000; font-weight: 800; font-size: 0.82rem; color: #111111; flex-shrink: 0;">
        « مع أطيب التمنيات لكم بالنجاح والتفوق الباهر »
      </div>

    </div>
  `;
}

function renderBubbleSheetHtml(targetQuiz, modelLetter = 'A', studentNumber = null, totalStudents = null, isPrint = false) {
  const { selectedModel, modelCode, examCode, barcodeSerial } = getModelInfo(targetQuiz, modelLetter);

  const containerClass = isPrint ? 'centrly-bubble-sheet' : 'printable-bubble-sheet';
  const containerStyle = isPrint 
    ? 'box-sizing: border-box; width: 100%; min-height: 278mm; height: 278mm; padding: 7mm 8mm; background: #ffffff; color: #000000; font-family: "Cairo", sans-serif; direction: rtl; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid #000000;'
    : 'background: #ffffff; border: 2px solid #000000; border-radius: 4px; padding: 1.25rem 1.15rem; box-shadow: 0 4px 14px rgba(0,0,0,0.08); font-family: "Cairo", sans-serif; width: 100%; max-width: 800px; min-height: 1020px; margin: 0 auto; box-sizing: border-box; overflow-x: hidden; direction: rtl; display: flex; flex-direction: column; justify-content: space-between;';

  const mcqQuestions = (targetQuiz?.questions || []).filter(q => q.type !== 'essay');
  const essayQuestions = (targetQuiz?.questions || []).filter(q => q.type === 'essay');
  const totalQ = Math.max(1, mcqQuestions.length > 0 ? mcqQuestions.length : 10);

  // Dynamic layout: 1 column vertically if few questions (<= 15), 2 columns if 16-36, 3 columns if > 36
  let numCols = 1;
  if (totalQ > 36) {
    numCols = 3;
  } else if (totalQ > 15) {
    numCols = 2;
  } else {
    numCols = 1;
  }

  const baseCount = Math.floor(totalQ / numCols);
  const remainder = totalQ % numCols;
  const colCounts = [];
  for (let c = 0; c < numCols; c++) {
    colCounts.push(baseCount + (c < remainder ? 1 : 0));
  }

  let runningStart = 1;
  const colStartNums = [];
  for (let c = 0; c < numCols; c++) {
    colStartNums.push(runningStart);
    runningStart += colCounts[c];
  }

  const isSingleCol = numCols === 1;
  const gridContainerStyle = isSingleCol
    ? 'border: 1.5px solid #000000; padding: 0.85rem 1.25rem; display: flex; justify-content: center;'
    : `border: 1.5px solid #000000; padding: 0.75rem 1rem; display: grid; grid-template-columns: repeat(${numCols}, 1fr); gap: ${numCols === 3 ? '1rem' : '1.5rem'};`;

  const colBoxStyle = isSingleCol
    ? 'width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 0.35rem;'
    : 'display: flex; flex-direction: column; gap: 0.25rem;';

  const bubbleSize = isSingleCol ? '20px' : (numCols === 3 ? '16px' : '18px');
  const bubbleFontSize = isSingleCol ? '0.72rem' : (numCols === 3 ? '0.64rem' : '0.68rem');
  const bubbleGap = isSingleCol ? '1.15rem' : (numCols === 3 ? '0.55rem' : '0.75rem');
  const rowPadding = isSingleCol ? '3.5px 0' : '1.5px 0';
  const headerGap = isSingleCol ? '1.45rem' : (numCols === 3 ? '0.75rem' : '1rem');

  return `
    <div class="${containerClass}" style="${containerStyle}">
      
      <div>
        <!-- OMR Scanner Alignment Markers -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
          <div style="width: 18px; height: 18px; background: #000000;"></div>
          <div style="text-align: center;">
            <h2 style="font-size: 1.15rem; font-weight: 900; margin: 0; color: #000000; line-height: 1.2;">
              ورقة إجابة بابل شيت (OMR Answer Sheet)
            </h2>
            <div style="font-size: 0.78rem; font-weight: 800; color: #333333; margin-top: 0.15rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; flex-wrap: wrap;">
              <span>${escapeHtml(targetQuiz.subject || 'الفيزياء')}</span>
              <span>•</span>
              <span>${escapeHtml(targetQuiz.title || '')}</span>
              <span>•</span>
              <span style="font-family: monospace; font-weight: 900; background: #eee; padding: 1px 6px; border-radius: 3px; border: 1px solid #aaa; font-size: 0.75rem;">
                كود: ${escapeHtml(examCode)}
              </span>

              ${studentNumber ? `
                <span style="font-size: 0.72rem; font-weight: 800; color: #0f172a; background: #e2e8f0; padding: 1px 6px; border-radius: 3px;">
                  طالب (${studentNumber} من ${totalStudents})
                </span>
              ` : ''}
            </div>
          </div>
          <div style="width: 18px; height: 18px; background: #000000;"></div>
        </div>

        <!-- Student Info and Code Shading Box -->
        <div style="border: 1.5px solid #000000; padding: 0.65rem 0.85rem; margin-bottom: 0.75rem; display: grid; grid-template-columns: 1.8fr 1.2fr; gap: 1rem; align-items: center;">
          <div>
            <div style="display: flex; align-items: baseline; gap: 4px; font-size: 0.82rem; font-weight: 800; margin-bottom: 0.4rem;">
              <span style="white-space: nowrap;">اسم الطالب:</span>
              <div style="flex: 1; border-bottom: 1.5px dotted #000000; min-height: 12px;"></div>
            </div>
            <div style="display: flex; align-items: baseline; gap: 4px; font-size: 0.82rem; font-weight: 800; margin-bottom: 0.4rem;">
              <span style="white-space: nowrap;">المجموعة:</span>
              <div style="flex: 1; border-bottom: 1.5px dotted #000000; min-height: 12px;"></div>
            </div>
            
            <!-- Barcode on Bubble Sheet -->
            <div style="display: inline-block; border: 1px solid #000000; padding: 0.2rem 0.5rem; border-radius: 3px; margin-top: 0.25rem;">
              <div style="font-family: monospace; font-size: 0.68rem; font-weight: 900; letter-spacing: 1px;">|||| | ||||| ||| ||| | ||</div>
              <div style="font-family: monospace; font-size: 0.62rem; font-weight: 800; color: #333333;">${escapeHtml(barcodeSerial)}</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.4rem; border-radius: 3px; margin-top: 0.45rem; font-size: 0.7rem; line-height: 1.4; color: #333333;">
              <b>تعليمات التظليل:</b> ظلل الدائرة كاملة بالقلم الجاف أو الرصاص، لا تظلل أكثر من دائرة لنفس السؤال، وظلل كودك بدقة.
            </div>
          </div>

          <!-- Student Code Shading Grid -->
          <div style="border: 1px solid #000000; padding: 0.35rem; text-align: center; background: #ffffff;">
            <div style="font-weight: 900; font-size: 0.78rem; margin-bottom: 0.25rem; color: #000000;">تظليل كود الطالب (4 خانات)</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; font-size: 0.68rem;">
              ${[1, 2, 3, 4].map(col => `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 1px;">
                  <span style="font-weight: 900; border-bottom: 1px solid #000000; width: 100%; display: block; font-size: 0.65rem;">خانة ${col}</span>
                  ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                    <span style="width: 14px; height: 14px; border: 1.2px solid #000000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 800;">
                      ${num}
                    </span>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Answer Bubbles Grid -->
        <div style="${gridContainerStyle}">
          ${Array.from({ length: numCols }).map((_, colIdx) => {
            const countThisCol = colCounts[colIdx];
            const startNum = colStartNums[colIdx];
            return `
              <div style="${colBoxStyle}">
                <div style="display: flex; justify-content: space-between; border-bottom: 1.5px solid #000000; padding-bottom: 0.25rem; font-weight: 900; font-size: ${isSingleCol ? '0.85rem' : '0.78rem'};">
                  <span style="width: 28px;">سؤال</span>
                  <div style="display: flex; gap: ${headerGap}; padding-left: 0.4rem;">
                    <span>أ</span>
                    <span>ب</span>
                    <span>ج</span>
                    <span>د</span>
                  </div>
                </div>

                ${Array.from({ length: countThisCol }).map((_, rIdx) => {
                  const qNum = startNum + rIdx;
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: ${rowPadding}; border-bottom: ${isSingleCol ? '1px dotted #e2e8f0' : 'none'};">
                      <span style="font-weight: 900; font-size: ${isSingleCol ? '0.85rem' : '0.8rem'}; width: 28px;">${qNum}</span>
                      <div style="display: flex; gap: ${bubbleGap};">
                        ${['أ', 'ب', 'ج', 'د'].map(l => `
                          <span style="width: ${bubbleSize}; height: ${bubbleSize}; border: 1.4px solid #000000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${bubbleFontSize}; font-weight: 800;">
                            ${l}
                          </span>
                        `).join('')}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>

        ${essayQuestions.length > 0 ? `
          <!-- Essay Grading Box for Examiner -->
          <div style="border: 1.5px solid #000000; padding: 0.65rem 0.85rem; margin-top: 0.75rem; background: #fafafa;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.2px solid #000000; padding-bottom: 0.3rem; margin-bottom: 0.45rem;">
              <span style="font-weight: 900; font-size: 0.82rem; color: #000000;">رصد درجات الأسئلة المقالية (${essayQuestions.length} أسئلة) — خاص بالمصحح</span>
              <span style="font-size: 0.72rem; color: #475569; font-weight: 700;">(تُجاب في كراسة الأسئلة الورقية)</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(${Math.min(essayQuestions.length, 6)}, 1fr); gap: 8px; text-align: center;">
              ${essayQuestions.map((eq, eIdx) => {
                const qNum = mcqQuestions.length + eIdx + 1;
                const maxPts = eq.points || 2;
                return `
                  <div style="border: 1.2px solid #000000; padding: 4px; background: #ffffff; border-radius: 3px;">
                    <div style="font-weight: 900; font-size: 0.74rem; border-bottom: 1px solid #000000; padding-bottom: 2px; margin-bottom: 3px; background: #f1f5f9;">سؤال ${qNum}</div>
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 800; min-height: 18px; display: flex; align-items: center; justify-content: center;">... / ${maxPts}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Bottom Markers -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.65rem;">
        <div style="width: 18px; height: 18px; background: #000000;"></div>
        <span style="font-size: 0.7rem; font-weight: 700; color: #555555;">Centrly OMR Optical Mark Recognition System</span>
        <div style="width: 18px; height: 18px; background: #000000;"></div>
      </div>

    </div>
  `;
}


// TAB 4: PAPER BUILDER (إنشاء امتحان ورقي ونماذج باركود ذكية A4)
// ============================================================================
function renderPaperBuilderTab(state, groups, activeGroup, quizzes, currentQuiz) {
  const paperMode = state.paperViewMode || 'list'; // 'list' | 'preview' | 'create'
  const selectedGroupId = state.selectedGroupId || (groups[0]?.id || '');
  const allRich = state.richQuizzes || [];
  const paperQuizzes = allRich.filter(q => {
    if (q.exam_mode !== 'paper') return false;
    if (!selectedGroupId) return true;
    if (!q.group_id || q.group_id === 'all') return true;
    if (String(q.group_id).trim() === String(selectedGroupId).trim()) return true;
    if (Array.isArray(q.target_group_ids) && q.target_group_ids.some(gid => String(gid).trim() === String(selectedGroupId).trim())) return true;
    if (Array.isArray(q.group_ids) && q.group_ids.some(gid => String(gid).trim() === String(selectedGroupId).trim())) return true;
    return false;
  });

  const allDrafts = state.examDrafts || [];
  const paperDrafts = allDrafts.filter(d => (d.exam_mode || '') === 'paper');
  const activePaperListTab = state.paperListTab || 'published'; // 'published' | 'drafts'

  const selectedQuizId = state.printQuizId || paperQuizzes[0]?.id || null;
  const targetQuiz = paperQuizzes.find(q => q.id === selectedQuizId) || paperQuizzes[0] || allRich.find(q => q.id === selectedQuizId && q.exam_mode === 'paper') || null;

  if (paperMode === 'list') {
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Header Bar with Filter Tabs and New Paper Exam Button -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem;">
          <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <button 
              type="button" 
              onclick="window.centrlyApp.setPaperListTab('published')"
              style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease; ${activePaperListTab === 'published' ? 'background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.06);' : 'background: transparent; color: #64748b;'}"
            >
              الامتحانات الورقية (${paperQuizzes.length})
            </button>
            <button 
              type="button" 
              onclick="window.centrlyApp.setPaperListTab('drafts')"
              style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px; ${activePaperListTab === 'drafts' ? 'background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.06);' : 'background: transparent; color: #64748b;'}"
            >
              ${getIcon('archive', 13, activePaperListTab === 'drafts' ? '#b45309' : '#64748b')}
              <span>الأرشيف والمسودات</span>
              ${paperDrafts.length > 0 ? `<span style="background: #f59e0b; color: #ffffff; font-size: 0.7rem; font-weight: 800; padding: 1px 6px; border-radius: 10px;">${paperDrafts.length}</span>` : ''}
            </button>
          </div>

          <button type="button" onclick="window.centrlyApp.startNewPaperExam()"
            style="height: 30px; padding: 0 14px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
            <span>+ إنشاء امتحان ورقي جديد</span>
          </button>
        </div>

        ${activePaperListTab === 'drafts' ? `
          <!-- Paper Drafts / Archive View -->
          ${paperDrafts.length === 0 ? `
            <div class="card" style="text-align: center; padding: 3rem 1.5rem; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px;">
              <div style="color: #94a3b8; margin-bottom: 0.5rem; display: flex; justify-content: center;">${getIcon('archive', 36, '#94a3b8')}</div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem;">الأرشيف فارغ حالياً</div>
              <p style="font-size: 0.78rem; color: #64748b; margin: 0 auto; max-width: 420px; line-height: 1.5;">
                عندما تقوم بإعداد امتحان ورقي وتختار حفظه في الأرشيف (مسودة) بدلاً من حذفه، سيظهر هنا فوراً لتستأنف كتابته وتعديله وطباعته متى شئت.
              </p>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
              ${paperDrafts.map(d => {
                const qCount = d.questions?.length || 0;
                const dateStr = d.archived_at ? new Date(d.archived_at).toLocaleDateString('ar-EG') : 'مسودة حديثة';
                return `
                  <div class="card" style="margin: 0; border: 1.5px dashed #f59e0b; border-radius: 8px; background: #fffdfa; padding: 1.1rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.65rem;">
                        <span style="font-weight: 800; font-size: 0.95rem; color: #0f172a; line-height: 1.4;">
                          ${escapeHtml(d.title || 'مسودة امتحان ورقي')}
                        </span>
                        <span style="font-size: 0.72rem; font-weight: 800; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap;">
                          ${getIcon('archive', 11, '#b45309')}
                          <span>مسودة بالأرشيف</span>
                        </span>
                      </div>
                      <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem;">
                        <span style="background: #ffffff; border: 1px solid #e2e8f0; color: #475569; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                          المادة: ${escapeHtml(d.subject || 'الفيزياء')}
                        </span>
                        <span style="background: #ffffff; border: 1px solid #e2e8f0; color: #475569; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                          ${qCount} أسئلة
                        </span>
                        <span style="background: #ffffff; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                          محفوظ بتاريخ: ${escapeHtml(dateStr)}
                        </span>
                      </div>
                    </div>
                    <div style="display: flex; gap: 0.45rem; align-items: center; margin-top: 1rem; padding-top: 0.65rem; border-top: 1px solid #fed7aa;">
                      <button 
                        type="button" 
                        style="flex: 1; height: 32px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px;"
                        onclick="window.centrlyApp.resumeExamDraft('${escapeHtml(d.id)}', 'paper')"
                      >
                        ${getIcon('edit', 12, '#ffffff')}
                        <span>استئناف وتعديل</span>
                      </button>
                      <button 
                        type="button" 
                        style="height: 32px; font-size: 0.75rem; font-weight: 700; background: #fef2f2; color: #dc2626; border-radius: 5px; border: 1px solid #fecaca; cursor: pointer; padding: 0 10px; display: inline-flex; align-items: center; gap: 4px;"
                        onclick="window.centrlyApp.deleteExamDraft('${escapeHtml(d.id)}')"
                        title="حذف هذه المسودة نهائياً"
                      >
                        ${getIcon('trash', 12, '#dc2626')}
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        ` : `
        <!-- Paper Exams Cards Grid / Loading / Empty (Swiss Minimal) -->
        ${state.isLoadingRichQuizzes ? `
          <!-- Loading State (Calm Minimal Swiss) -->
          <div class="card" style="text-align: center; padding: 3.5rem 1.5rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 0.85rem;">
              <span style="width: 20px; height: 20px; border: 2.5px solid #cbd5e1; border-top-color: #0f172a; border-radius: 50%; display: inline-block; animation: centrlySpin 0.75s linear infinite;"></span>
            </div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.35rem;">
              جاري تحميل نماذج الامتحانات الورقية...
            </div>
            <p style="font-size: 0.78rem; color: #64748b; margin: 0 auto; max-width: 420px; line-height: 1.5;">
              يتم الآن جلب نماذج البابل شيت والامتحانات المطبوعة لهذه المجموعة، لحظات وستظهر النماذج...
            </p>
          </div>
          <!-- Clean Calm Skeletons -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; opacity: 0.45;">
            <div class="card" style="margin: 0; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 1.1rem; height: 150px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="height: 14px; width: 60%; background: #e2e8f0; border-radius: 4px; margin-bottom: 0.8rem;"></div>
                <div style="display: flex; gap: 0.4rem; margin-bottom: 0.6rem;">
                  <div style="height: 18px; width: 60px; background: #f1f5f9; border-radius: 4px;"></div>
                  <div style="height: 18px; width: 50px; background: #f1f5f9; border-radius: 4px;"></div>
                  <div style="height: 18px; width: 70px; background: #f1f5f9; border-radius: 4px;"></div>
                </div>
              </div>
              <div style="height: 28px; width: 100%; background: #f1f5f9; border-radius: 4px;"></div>
            </div>
          </div>
        ` : paperQuizzes.length > 0 ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
            ${paperQuizzes.map(rq => {
              const qCount = rq.questions?.length || 0;
              const totalPoints = (rq.questions || []).reduce((s, q) => s + Number(q.points || 1), 0) || rq.max_score || 20;
              const targetGroup = groups.find(g => String(g.id) === String(rq.group_id));
              const groupLabel = rq.group_id === 'all' ? 'جميع المجاميع' : (targetGroup?.name || activeGroup?.name || 'مجموعة محددة');

              return `
                <div class="card" style="margin: 0; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 1.1rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                  
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.65rem;">
                      <span style="font-weight: 800; font-size: 0.95rem; color: #0f172a; line-height: 1.4;">
                        ${escapeHtml(rq.title)}
                      </span>
                      <span style="font-size: 0.72rem; font-weight: 700; background: #f1f5f9; color: #334155; padding: 2px 7px; border-radius: 4px; white-space: nowrap;">
                        كويز ${rq.quiz_number}
                      </span>
                    </div>

                    <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem;">
                      <span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        المادة: ${escapeHtml(rq.subject || 'الفيزياء')}
                      </span>
                      <span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        ${qCount} أسئلة
                      </span>
                      <span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        ${totalPoints} درجات
                      </span>
                      <span style="background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        ${rq.time_limit_minutes || 45} دقيقة
                      </span>
                      <span style="background: #f1f5f9; color: #0f172a; font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 4px;">
                        المجموعة: ${escapeHtml(groupLabel)}
                      </span>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div style="display: flex; gap: 0.45rem; align-items: center; margin-top: 1rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9; flex-wrap: wrap;">
                    <button 
                      type="button" 
                      style="flex: 1 1 120px; height: 30px; font-size: 0.75rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;"
                      onclick="window.centrlyApp.previewPaperExam('${escapeHtml(rq.id)}')"
                    >
                      ${getIcon('print', 13, '#ffffff')}
                      <span>معاينة وطباعة</span>
                    </button>
                    <button 
                      type="button" 
                      style="height: 30px; font-size: 0.75rem; font-weight: 600; background: #f8fafc; color: #0f172a; border-radius: 5px; border: 1px solid #cbd5e1; cursor: pointer; padding: 0 10px;"
                      onclick="window.centrlyApp.printPaperExamBubbleSheet('${escapeHtml(rq.id)}')"
                      title="طباعة نموذج البابل شيت مباشرة"
                    >
                      <span>بابل شيت</span>
                    </button>
                    <button 
                      type="button" 
                      style="height: 30px; font-size: 0.75rem; font-weight: 600; background: #f8fafc; color: #475569; border-radius: 5px; border: 1px solid #e2e8f0; cursor: pointer; padding: 0 8px;"
                      onclick="window.centrlyApp.editPaperExam('${escapeHtml(rq.id)}')"
                      title="تعديل هذا الامتحان"
                    >
                      ${getIcon('edit', 12)}
                    </button>
                    <button 
                      type="button" 
                      style="height: 30px; font-size: 0.74rem; font-weight: 600; background: #fffdfa; color: #b45309; border-radius: 5px; border: 1px solid #fde68a; cursor: pointer; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;"
                      onclick="window.centrlyApp.archiveOnlineExam('${escapeHtml(rq.id)}')"
                      title="نقل الامتحان إلى الأرشيف والمسودات"
                    >
                      ${getIcon('archive', 11, '#b45309')}
                      <span>أرشفة</span>
                    </button>
                    <button 
                      type="button" 
                      style="height: 30px; font-size: 0.74rem; font-weight: 600; background: #fef2f2; color: #dc2626; border-radius: 5px; border: 1px solid #fecaca; cursor: pointer; padding: 0 8px; display: inline-flex; align-items: center; gap: 3px;"
                      onclick="window.centrlyApp.deleteOnlineExam('${escapeHtml(rq.id)}')"
                      title="حذف هذا الامتحان نهائياً"
                    >
                      ${getIcon('trash', 11, '#dc2626')}
                      <span>حذف</span>
                    </button>
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- Empty State -->
          <div class="card" style="text-align: center; padding: 3rem 1.5rem; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px;">
            <div style="font-weight: 800; font-size: 1rem; color: #0f172a; margin-bottom: 0.35rem;">لا توجد امتحانات ورقية منشأة لهذه المجموعة بعد</div>
            <p style="font-size: 0.8rem; color: #64748b; max-width: 440px; margin: 0 auto 1.25rem auto;">
              اضغط على الزر أدناه لبدء ضبط وتصميم أول نموذج امتحان ورقي وبابل شيت، مخصص لهذه المجموعة أو لجميع المجاميع.
            </p>
            <button 
              type="button" 
              style="height: 32px; padding: 0 16px; font-size: 0.8rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer;"
              onclick="window.centrlyApp.startNewPaperExam()"
            >
              + إنشاء امتحان ورقي جديد الآن
            </button>
          </div>
        `}
      `}

      </div>
    `;
  }

  if (paperMode === 'create') {
    const paperWizardStep = state.paperWizardStep || 1;
    const activePaperQuiz = state.activePaperQuiz || {
      id: null,
      quiz_number: currentQuiz.number || 1,
      title: '',
      subject: activeGroup?.subject || "الفيزياء",
      target_group_id: selectedGroupId,
      question_count: 10,
      time_limit_minutes: 45,
      exam_mode: 'paper',
      questions: []
    };

    const currentQCount = Number(activePaperQuiz.question_count || (activePaperQuiz.questions?.length > 0 ? activePaperQuiz.questions.length : 10));

    // =========================================================================
    // STEP 1: Paper Exam Settings (إعداد وضوابط الامتحان الورقي)
    // =========================================================================
    if (paperWizardStep === 1) {
      return `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          
          <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1rem;">
              <div>
                <div style="font-size: 0.74rem; font-weight: 700; color: #64748b; margin-bottom: 0.15rem;">
                  الخطوة 1 من 2
                </div>
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">
                  إعداد وضوابط الامتحان الورقي وتحديد المجموعة
                </h3>
              </div>

              <button 
                type="button" 
                style="height: 30px; padding: 0 12px; font-size: 0.76rem; font-weight: 600; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer;"
                onclick="window.centrlyApp.cancelPaperExamCreate()"
              >
                إلغاء والعودة للقائمة
              </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
              
              <!-- Multi-Group Selector in Paper Wizard Step 1 -->
              <div>
                <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155; margin-bottom: 0.35rem; display: block;">
                  المجموعات المستهدفة بالامتحان الورقي:
                </label>
                ${renderMultiGroupSelector('paper', groups, activePaperQuiz.target_group_ids, activePaperQuiz.target_group_id || selectedGroupId, state.groupDropdownState?.paper)}
              </div>

              <div>
                <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">عنوان / موضوع الامتحان الورقي:</label>
                <input 
                  type="text" 
                  id="paperQuizTitle" 
                  class="form-input" 
                  value="${escapeHtml(activePaperQuiz.title || '')}" 
                  placeholder="مثال: امتحان الباب الأول - قانون كيرشوف"
                  style="font-weight: 700; height: 34px; font-size: 0.82rem;"
                />
              </div>

              <div>
                <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">اسم المادة الدراسية:</label>
                <input 
                  type="text" 
                  id="paperQuizSubject" 
                  class="form-input" 
                  value="${escapeHtml(activePaperQuiz.subject || 'الفيزياء')}" 
                  placeholder="مثال: مادة الفيزياء"
                  style="font-weight: 700; height: 34px; font-size: 0.82rem;"
                />
              </div>

              <div>
                <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">رقم الكويز التسلسلي:</label>
                <input 
                  type="number" 
                  id="paperQuizNumber" 
                  class="form-input" 
                  value="${activePaperQuiz.quiz_number || 1}" 
                  min="1" 
                  step="1"
                  style="font-weight: 700; height: 34px; font-size: 0.82rem;"
                />
              </div>

              <div>
                <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">إجمالي عدد أسئلة الامتحان:</label>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input 
                    type="number" 
                    id="paperQuizQuestionCount" 
                    class="form-input" 
                    value="${currentQCount}" 
                    min="1" 
                    max="100" 
                    step="1"
                    style="text-align: center; font-weight: 800; font-size: 0.9rem; width: 90px; height: 34px;"
                  />
                  <span style="font-size: 0.8rem; font-weight: 700; color: #64748b;">سؤال</span>
                </div>
              </div>

              <div>
                <label class="form-label" style="font-weight: 700; font-size: 0.8rem; color: #334155;">زمن الامتحان المخصص للطلاب (بالدقائق):</label>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input 
                    type="number" 
                    id="paperQuizTimeLimit" 
                    class="form-input" 
                    value="${activePaperQuiz.time_limit_minutes || 45}" 
                    min="5" 
                    max="240"
                    style="text-align: center; font-weight: 800; font-size: 0.9rem; width: 90px; height: 34px;"
                  />
                  <span style="font-size: 0.8rem; font-weight: 700; color: #64748b;">دقيقة</span>
                </div>
              </div>

            </div>

            <!-- Explanatory Notice -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.65rem 0.85rem; margin-top: 1.25rem; font-size: 0.76rem; color: #475569; line-height: 1.5;">
              <b>تجهيز الامتحان الورقي والـ Bubble Sheet:</b> سيتم إعداد الأسئلة سؤالاً بسؤال لتعبئتها وتحديد درجاتها، مع توليد ورقة بابل شيت متوافقة ونماذج باركود ذكية.
            </div>

            <!-- Wizard Action Bar -->
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
              <button 
                type="button" 
                style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer;"
                onclick="window.centrlyApp.cancelPaperExamCreate()"
              >
                إلغاء
              </button>
              <button 
                type="button" 
                style="height: 32px; padding: 0 16px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                onclick="window.centrlyApp.proceedToPaperQuestionsStep()"
              >
                <span>ابدأ بكتابة الأسئلة</span>
                ${getIcon('arrowRight', 14, '#ffffff')}
              </button>
            </div>

          </div>

        </div>
      `;
    }

    // =========================================================================
    // STEP 2: Paper Exam Questions Builder (كتابة وتصميم الأسئلة)
    // =========================================================================
    const questions = activePaperQuiz.questions || [];
    const totalQuestions = questions.length || currentQCount;
    const currentPaperQIdx = Math.max(0, Math.min(totalQuestions - 1, state.currentPaperQIdx || 0));
    const layoutMode = state.paperLayoutMode || 'single'; // 'single' | 'all'
    const totalCurrentPoints = questions.reduce((s, q) => s + Number(q.points || 1), 0);
    const progressPct = Math.round(((currentPaperQIdx + 1) / totalQuestions) * 100);

    const renderQuestionCardInner = (q, qIdx) => {
      const isMcq = q.type !== 'essay';
      const isQImageOnly = q.format === 'image_only' || (q.format !== 'standard' && !q.text?.trim() && !!q.image_url);

      return `
        <div class="card" style="margin: 0; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); position: relative;" onclick="if(window.centrlyApp) window.centrlyApp.quizzesState.activePaperPasteQIdx = ${qIdx}">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.65rem; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span style="background: #0f172a; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">
                ${qIdx + 1}
              </span>
              <div style="display: inline-flex; gap: 0.25rem; background: #f8fafc; padding: 2px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <button 
                  type="button" 
                  style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 700; border-radius: 4px; border: 1px solid ${isMcq ? '#0f172a' : 'transparent'}; background: ${isMcq ? '#0f172a' : 'transparent'}; color: ${isMcq ? '#ffffff' : '#475569'}; cursor: pointer;"
                  onclick="window.centrlyApp.updatePaperQuestion(${qIdx}, 'type', 'mcq')"
                >
                  اختيار من متعدد (MCQ)
                </button>
                <button 
                  type="button" 
                  style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 700; border-radius: 4px; border: 1px solid ${!isMcq ? '#0f172a' : 'transparent'}; background: ${!isMcq ? '#0f172a' : 'transparent'}; color: ${!isMcq ? '#ffffff' : '#475569'}; cursor: pointer;"
                  onclick="window.centrlyApp.updatePaperQuestion(${qIdx}, 'type', 'essay')"
                >
                  سؤال مقالي (Essay)
                </button>
              </div>

              <!-- Format Selector: Standard vs Image-Only -->
              <div style="display: inline-flex; background: #f8fafc; padding: 2px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <button 
                  type="button" 
                  style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 700; border-radius: 4px; border: 1px solid ${!isQImageOnly ? '#0f172a' : 'transparent'}; background: ${!isQImageOnly ? '#0f172a' : 'transparent'}; color: ${!isQImageOnly ? '#ffffff' : '#475569'}; cursor: pointer;"
                  onclick="window.centrlyApp.setPaperQuestionFormat(${qIdx}, 'standard')"
                >
                  سؤال نصي
                </button>
                <button 
                  type="button" 
                  style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 700; border-radius: 4px; border: 1px solid ${isQImageOnly ? '#0f172a' : 'transparent'}; background: ${isQImageOnly ? '#0f172a' : 'transparent'}; color: ${isQImageOnly ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                  onclick="window.centrlyApp.setPaperQuestionFormat(${qIdx}, 'image_only')"
                  title="تفعيل وضع صورة السؤال بالكامل من الكتاب أو المذكرة دون كتابة نص"
                >
                  ${getIcon('camera', 13)}
                  <span>السؤال صورة بالكامل</span>
                </button>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                <label style="font-size: 0.78rem; font-weight: 700; color: #64748b;">درجة السؤال:</label>
                <input 
                  type="number" 
                  class="form-input" 
                  value="${q.points !== undefined && q.points !== null ? q.points : 2}" 
                  min="0.5" 
                  step="0.5" 
                  style="width: 60px; height: 30px; text-align: center; padding: 0; font-weight: 800; font-size: 0.88rem; border: 1px solid #cbd5e1; border-radius: 4px;"
                  onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'points', this.value)"
                />
              </div>

              <button 
                type="button" 
                style="height: 28px; padding: 0 8px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                onclick="window.centrlyApp.removePaperQuestion(${qIdx})"
                title="حذف هذا السؤال"
              >
                ${getIcon('delete', 13, '#b91c1c')}
                <span>حذف</span>
              </button>
            </div>
          </div>

          ${isQImageOnly ? `
            <!-- Image-Only Hero Box for Paper Exam -->
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; text-align: center;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem; text-align: right;">
                <div>
                  <span style="font-size: 0.88rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                    ${getIcon('camera', 16)}
                    <span>صورة السؤال بالكامل (قص للطباعة في ورقة الامتحان):</span>
                  </span>
                  <span style="font-size: 0.74rem; color: #64748b;">
                    صيغة المسألة معروضة بالصورة كاملة دون الحاجة لكتابة أي نص.
                  </span>
                </div>

                <div style="display: flex; align-items: center; gap: 0.45rem;">
                  <input 
                    type="file" 
                    id="paperQImageInput_${qIdx}" 
                    accept="image/*" 
                     
                    style="display: none;" 
                    onchange="window.centrlyApp.handlePaperImageUpload(${qIdx}, this.files[0])"
                  />
                  <button 
                    type="button" 
                    style="height: 30px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                    onclick="document.getElementById('paperQImageInput_${qIdx}').click()"
                  >
                    ${getIcon('upload', 13, '#ffffff')}
                    <span>${q.image_url ? 'تغيير صورة السؤال' : 'رفع / تصوير صورة السؤال'}</span>
                  </button>

                  ${q.image_url ? `
                    <button 
                      type="button" 
                      style="height: 30px; padding: 0 9px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                      onclick="window.centrlyApp.removePaperImage(${qIdx})"
                      title="إزالة الصورة"
                    >
                      ${getIcon('delete', 13, '#b91c1c')}
                      <span>حذف الصورة</span>
                    </button>
                  ` : ''}
                </div>
              </div>

              ${q.image_url ? `
                <div style="background: #ffffff; padding: 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; max-width: 100%;">
                  <img 
                    src="${escapeHtml(q.image_url)}" 
                    alt="صورة السؤال" 
                    style="max-height: 240px; max-width: 100%; border-radius: 4px; object-fit: contain;"
                  />
                </div>
              ` : `
                <div 
                  style="padding: 1.5rem 1rem; border: 1px dashed #cbd5e1; background: #ffffff; border-radius: 6px; cursor: pointer;"
                  onclick="document.getElementById('paperQImageInput_${qIdx}').click()"
                >
                  <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a; margin-bottom: 0.2rem;">اضغط لرفع أو تصوير صورة السؤال بالكامل</div>
                  <div style="font-size: 0.74rem; color: #64748b;">(أو انقر هنا والصق الصورة بـ <b>Ctrl + V</b>)</div>
                </div>
              `}

              <div style="margin-top: 0.65rem; text-align: right;">
                <details style="font-size: 0.78rem; color: #64748b;">
                  <summary style="cursor: pointer; font-weight: 600; color: #475569;">+ إضافة عنوان أو رأس سؤال اختياري</summary>
                  <input 
                    type="text" 
                    class="form-input" 
                    value="${escapeHtml(q.text || '')}" 
                    placeholder="عنوان أو ملاحظة اختيارية..." 
                    style="margin-top: 0.4rem; font-size: 0.82rem; height: 32px;"
                    onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'text', this.value)"
                  />
                </details>
              </div>
            </div>
          ` : `
            <!-- Standard Question Textarea -->
            <div style="margin-bottom: 0.75rem;">
              <label style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem; display: block;">
                نص السؤال:
              </label>
              <textarea 
                class="form-input form-textarea" 
                rows="4" 
                placeholder="اكتب صيغة السؤال هنا بوضوح..."
                style="font-size: 0.95rem; font-weight: 600; width: 100%; min-height: 110px; height: auto; padding: 0.75rem 0.85rem; line-height: 1.6; border: 1.5px solid #cbd5e1; border-radius: 6px; resize: vertical;"
                onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'text', this.value)"
              >${escapeHtml(q.text || '')}</textarea>
            </div>

            <!-- Question Image Uploader -->
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 0.65rem 0.85rem; margin-bottom: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem;">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div style="color: #64748b;">${getIcon('camera', 20)}</div>
                <div>
                  <span style="font-size: 0.78rem; font-weight: 700; color: #0f172a; display: block;">صورة مسألة أو رسم بياني للسؤال:</span>
                  <span style="font-size: 0.72rem; color: #64748b;">التقط صورة بكاميرا الهاتف أو اختر صورة من جهازك</span>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 0.45rem;">
                <input 
                  type="file" 
                  id="paperQImageInput_${qIdx}" 
                  accept="image/*" 
                   
                  style="display: none;" 
                  onchange="window.centrlyApp.handlePaperImageUpload(${qIdx}, this.files[0])"
                />
                <button 
                  type="button" 
                  style="height: 28px; padding: 0 10px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                  onclick="document.getElementById('paperQImageInput_${qIdx}').click()"
                >
                  ${getIcon('upload', 13)}
                  <span>${q.image_url ? 'تغيير الصورة' : 'رفع / تصوير صورة'}</span>
                </button>

                ${q.image_url ? `
                  <button 
                    type="button" 
                    style="height: 28px; padding: 0 8px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                    onclick="window.centrlyApp.removePaperImage(${qIdx})"
                    title="إزالة الصورة"
                  >
                    ${getIcon('delete', 13, '#b91c1c')}
                    <span>حذف</span>
                  </button>
                ` : ''}
              </div>

              ${q.image_url ? `
                <div style="width: 100%; margin-top: 0.5rem; text-align: center;">
                  <img 
                    src="${escapeHtml(q.image_url)}" 
                    alt="صورة السؤال" 
                    style="max-height: 180px; max-width: 100%; border-radius: 4px; border: 1px solid #cbd5e1;"
                  />
                </div>
              ` : ''}
            </div>
          `}

          <!-- MCQ Choices or Essay Model Answer -->
          ${isMcq ? `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.45rem;">
                <span style="font-size: 0.78rem; font-weight: 700; color: #334155;">
                  خيارات الإجابة (اختر الدائرة المقابلة للإجابة الصحيحة):
                </span>
                ${isQImageOnly ? `
                  <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">
                    إذا كانت الاختيارات موجودة داخل الصورة، اختر الدائرة الصحيحة فقط دون كتابة نص
                  </span>
                ` : ''}
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.65rem;">
                ${['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => {
                  const isCorrect = Number(q.correct_index) === optIdx;
                  return `
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: ${isCorrect ? '#f8fafc' : '#ffffff'}; border: 1px solid ${isCorrect ? '#0f172a' : '#e2e8f0'}; border-radius: 6px; padding: 0.45rem 0.65rem; transition: all 0.15s ease;">
                      <input 
                        type="radio" 
                        name="paperCorrectRadio_${qIdx}" 
                        value="${optIdx}" 
                        ${isCorrect ? 'checked' : ''} 
                        style="width: 18px; height: 18px; cursor: pointer; accent-color: #0f172a;"
                        onchange="window.centrlyApp.setPaperCorrectChoice(${qIdx}, ${optIdx})"
                      />
                      <span style="font-weight: 800; font-size: 0.88rem; color: ${isCorrect ? '#0f172a' : '#64748b'}; width: 22px;">(${letter})</span>
                      <input 
                        type="text" 
                        class="form-input" 
                        value="${escapeHtml(q.choices?.[optIdx] || '')}" 
                        placeholder="${isQImageOnly ? `خيار (${letter}) - اختياري...` : `خيار (${letter})...`}" 
                        style="flex: 1; padding: 0.35rem 0.45rem; font-size: 0.85rem; font-weight: 600; border: none; background: transparent;"
                        onchange="window.centrlyApp.updatePaperChoice(${qIdx}, ${optIdx}, this.value)"
                      />
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : `
            <!-- Essay Answer Lines Counter & Model Answer -->
            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1.5px solid #0f172a; border-radius: 6px; padding: 0.6rem 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div>
                  <div style="font-weight: 800; font-size: 0.84rem; color: #0f172a;">
                    عدد أسطر الإجابة في ورقة الامتحان المطبوعة:
                  </div>
                  <div style="font-size: 0.72rem; color: #64748b;">
                    يتم رسم أسطر منقطة للطالب ليكتب إجابته بخط يده بحسب المساحة التي تحددها
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                  <button 
                    type="button" 
                    onclick="window.centrlyApp.updatePaperQuestion(${qIdx}, 'essay_lines', Math.max(1, (${q.essay_lines || 4}) - 1)); window.centrlyApp.renderMainContent();"
                    style="width: 32px; height: 32px; font-weight: 900; font-size: 1rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;"
                  >-</button>
                  <input 
                    type="number" 
                    min="1" 
                    max="20" 
                    value="${q.essay_lines !== undefined && q.essay_lines !== null ? q.essay_lines : 4}" 
                    style="width: 55px; height: 32px; text-align: center; font-size: 1rem; font-weight: 900; color: #0f172a; border: 1.5px solid #2563eb; border-radius: 4px;"
                    onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'essay_lines', Math.max(1, parseInt(this.value)||4))"
                  />
                  <button 
                    type="button" 
                    onclick="window.centrlyApp.updatePaperQuestion(${qIdx}, 'essay_lines', (${q.essay_lines || 4}) + 1); window.centrlyApp.renderMainContent();"
                    style="width: 32px; height: 32px; font-weight: 900; font-size: 1rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;"
                  >+</button>
                  <span style="font-weight: 800; font-size: 0.8rem; color: #0f172a; margin-right: 2px;">سطور</span>
                </div>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem;">
                <label style="font-size: 0.78rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem;">
                  <span>الإجابة النموذجية الاسترشادية:</span>
                </label>
                <textarea 
                  class="form-input form-textarea" 
                  rows="3" 
                  placeholder="اكتب خطوات الحل أو الإجابة النموذجية..."
                  style="font-size: 0.88rem; font-weight: 600; width: 100%; min-height: 85px; height: auto; padding: 0.65rem 0.75rem; border: 1.5px solid #cbd5e1; background: #ffffff; border-radius: 6px; resize: vertical;"
                  onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'model_answer', this.value)"
                >${escapeHtml(q.model_answer || '')}</textarea>
              </div>
            </div>
          `}

        </div>
      `;
    };

    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Step 2 Stepper Toolbar Card (Swiss Minimal) -->
        <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1.15rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; font-size: 0.74rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                  الخطوة 2 من 2: كتابة وتصميم الأسئلة
                </span>
                <span style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                  ${escapeHtml(activePaperQuiz.title || 'امتحان ورقي جديد')} (${escapeHtml(activePaperQuiz.subject || 'الفيزياء')})
                </span>
              </div>
              
              <div style="font-size: 0.76rem; color: #64748b; margin-top: 0.2rem;">
                الزمن المخصص: <b>${activePaperQuiz.time_limit_minutes || 45} دقيقة</b> • عدد الأسئلة: <b>${totalQuestions} سؤال</b>
              </div>
            </div>

            <!-- Score Summary & Action Buttons -->
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              
              <!-- Live Score Pill -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.3rem 0.75rem; text-align: center;">
                <span style="font-size: 0.68rem; color: #64748b; font-weight: 600; display: block;">
                  إجمالي درجات الامتحان
                </span>
                <span style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">
                  ${totalCurrentPoints} درجات
                </span>
              </div>

              <button 
                type="button" 
                style="height: 32px; padding: 0 11px; font-size: 0.76rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                onclick="window.centrlyApp.backToPaperStep1Settings()"
              >
                ${getIcon('edit', 13)}
                <span>تعديل الإعدادات</span>
              </button>

              <button 
                type="button" 
                style="height: 32px; padding: 0 11px; font-size: 0.76rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                onclick="window.centrlyApp.togglePaperQuestionsViewMode()"
              >
                <span>${layoutMode === 'all' ? 'عرض سؤال بسؤال' : 'عرض كافة الأسئلة'}</span>
              </button>

              ${(layoutMode === 'all' || currentPaperQIdx === totalQuestions - 1) ? `
                ${state.isSavingPaperExam ? `
                  <button 
                    type="button" 
                    disabled
                    style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #64748b; color: #ffffff; border: none; border-radius: 5px; cursor: not-allowed; display: inline-flex; align-items: center; gap: 6px; opacity: 0.85;"
                  >
                    <span style="width: 12px; height: 12px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; display: inline-block; animation: centrlySpin 0.75s linear infinite;"></span>
                    <span>جاري الحفظ والتوليد...</span>
                  </button>
                ` : `
                  <button 
                    type="button" 
                    style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                    onclick="window.centrlyApp.savePaperExam()"
                  >
                    ${getIcon('check', 13, '#ffffff')}
                    <span>حفظ وتوليد نماذج الامتحان</span>
                  </button>
                `}
              ` : ''}
            </div>
          </div>

          <!-- Visual Progress Bar (if in single mode) -->
          ${layoutMode === 'single' ? `
            <div style="width: 100%; height: 4px; background: #f1f5f9; border-radius: 2px; margin-top: 0.75rem; overflow: hidden;">
              <div style="height: 100%; background: #0f172a; width: ${progressPct}%; transition: width 0.2s ease;"></div>
            </div>
          ` : ''}

          <!-- Fast Question Jumpers (1..N) -->
          <div style="display: flex; gap: 0.35rem; overflow-x: auto; padding: 0.65rem 0 0.15rem 0; margin-top: 0.35rem; align-items: center;">
            <span style="font-size: 0.76rem; font-weight: 700; color: #64748b; margin-left: 0.4rem; white-space: nowrap;">الانتقال السريع:</span>
            ${Array.from({ length: totalQuestions }).map((_, idx) => {
              const isCur = idx === currentPaperQIdx;
              const qData = questions[idx];
              const hasContent = qData && (qData.text?.trim() || qData.image_url);

              return `
                <button 
                  type="button"
                  style="min-width: 30px; height: 30px; border-radius: 5px; font-weight: 700; font-size: 0.78rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; border: 1px solid ${isCur ? '#0f172a' : (hasContent ? '#cbd5e1' : '#e2e8f0')}; background: ${isCur ? '#0f172a' : (hasContent ? '#f8fafc' : '#ffffff')}; color: ${isCur ? '#ffffff' : (hasContent ? '#0f172a' : '#94a3b8')};"
                  onclick="window.centrlyApp.jumpToPaperQuestion(${idx})"
                  title="سؤال ${idx + 1}"
                >
                  ${idx + 1}
                </button>
              `;
            }).join('')}
          </div>

        </div>

        <!-- Questions Rendering Area -->
        ${layoutMode === 'single' ? `
          <!-- SINGLE QUESTION VIEW (سؤال بسؤال) -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${renderQuestionCardInner(questions[currentPaperQIdx] || { id: 'pq_1', type: 'mcq', choices: ['', '', '', ''], points: 2 }, currentPaperQIdx)}

            <!-- Stepper Footer Navigation -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem; background: #ffffff; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button 
                  type="button" 
                  style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; ${currentPaperQIdx === 0 ? 'opacity: 0.4; cursor: not-allowed;' : ''}"
                  ${currentPaperQIdx === 0 ? 'disabled' : ''}
                  onclick="window.centrlyApp.prevPaperQuestion()"
                >
                  ◀ السؤال السابق
                </button>

                ${currentPaperQIdx < totalQuestions - 1 ? `
                  <button 
                    type="button" 
                    style="height: 32px; padding: 0 16px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                    onclick="window.centrlyApp.nextPaperQuestion()"
                  >
                    السؤال التالي ▶
                  </button>
                ` : (state.isSavingPaperExam ? `
                  <button 
                    type="button" 
                    disabled
                    style="height: 32px; padding: 0 16px; font-size: 0.78rem; font-weight: 700; background: #64748b; color: #ffffff; border: none; border-radius: 5px; cursor: not-allowed; display: inline-flex; align-items: center; gap: 6px; opacity: 0.85;"
                  >
                    <span style="width: 12px; height: 12px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; display: inline-block; animation: centrlySpin 0.75s linear infinite;"></span>
                    <span>جاري الحفظ والتوليد...</span>
                  </button>
                ` : `
                  <button 
                    type="button" 
                    id="btnFinishSavePaperExam"
                    style="height: 32px; padding: 0 16px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                    onclick="window.centrlyApp.savePaperExam()"
                  >
                    ${getIcon('check', 13, '#ffffff')}
                    <span>إنهاء وحفظ الامتحان</span>
                  </button>
                `)}
              </div>

              ${currentPaperQIdx === totalQuestions - 1 ? `
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <button 
                    type="button" 
                    style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 600; background: #f8fafc; color: #475569; border: 1px dashed #cbd5e1; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                    onclick="window.centrlyApp.addPaperQuestion()"
                  >
                    ${getIcon('add', 13)}
                    <span>+ إضافة سؤال تالٍ</span>
                  </button>
                </div>
              ` : `
                <div style="font-size: 0.76rem; font-weight: 700; color: #64748b; padding: 0 6px;">
                  السؤال ${currentPaperQIdx + 1} من ${totalQuestions}
                </div>
              `}
            </div>

          </div>
        ` : `
          <!-- ALL QUESTIONS VIEW (عرض كافة الأسئلة في شاشة واحدة) -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${questions.map((q, qIdx) => renderQuestionCardInner(q, qIdx)).join('')}

            <!-- Bottom Action Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.5rem; border-top: 1px solid #f1f5f9; padding-top: 0.85rem;">
              <button 
                type="button" 
                style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 600; background: #f8fafc; color: #475569; border: 1px dashed #cbd5e1; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                onclick="window.centrlyApp.addPaperQuestion()"
              >
                ${getIcon('add', 13)}
                <span>+ إضافة سؤال جديد للامتحان</span>
              </button>

              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button 
                  type="button" 
                  style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer;"
                  onclick="window.centrlyApp.cancelPaperExamCreate()"
                >
                  إلغاء
                </button>

                <button 
                  type="button" 
                  style="height: 32px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                  onclick="window.centrlyApp.savePaperExam()"
                >
                  ${getIcon('check', 13, '#ffffff')}
                  <span>حفظ وتوليد نماذج الامتحان</span>
                </button>
              </div>
            </div>

          </div>
        `}

      </div>
    `;
  }

  const selectedModel = state.printModel || 'A'; // 'A' | 'B' | 'C'
  const { modelCode, examCode, barcodeSerial: stealthBarcodeSerial } = getModelInfo(targetQuiz, selectedModel);

  if (!targetQuiz) {
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="card" style="margin: 0; text-align: center; padding: 3rem 1.5rem; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px;">
          <div style="font-weight: 800; font-size: 1rem; color: #0f172a; margin-bottom: 0.35rem;">لم يتم العثور على هذا النموذج الورقي</div>
          <button 
            type="button" 
            style="height: 32px; padding: 0 16px; font-size: 0.8rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; margin-top: 1rem;"
            onclick="window.centrlyApp.backToPaperList()"
          >
            ◀ عودة لقائمة الامتحانات الورقية
          </button>
        </div>
      </div>
    `;
  }

  // Batch Print Modal State & Calculations
  const isBatchModalOpen = Boolean(state.isBatchPrintModalOpen);
  const studentCountFallback = (groups.find(g => g.id === selectedGroupId)?.students_count) || (groups.find(g => g.id === selectedGroupId)?.student_count) || 30;
  const batchCount = state.batchPrintCount || studentCountFallback;
  const batchType = state.batchPrintType || 'exam'; // 'exam' | 'bubble' | 'both'
  const batchModels = Array.isArray(state.batchPrintModels) && state.batchPrintModels.length > 0 ? state.batchPrintModels : ['A', 'B', 'C'];

  // Distribution summary calculation
  const modelBreakdown = batchModels.map((m, mIdx) => {
    let mCount = Math.floor(batchCount / batchModels.length);
    if (mIdx < (batchCount % batchModels.length)) mCount += 1;
    return `${mCount} من نموذج ${m}`;
  }).join(' ، ');

  return `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      
      <!-- Print & Paper Controls Toolbar (Responsive Swiss Minimal) -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1.15rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <button 
              type="button" 
              onclick="window.centrlyApp.backToPaperList()"
              style="height: 32px; padding: 0 12px; font-size: 0.78rem; font-weight: 700; background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
            >
              <span>◀ عودة للقائمة</span>
            </button>
            <div>
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;">
                ${escapeHtml(targetQuiz.title)} (${escapeHtml(targetQuiz.subject || 'الفيزياء')})
              </h3>
              <p style="font-size: 0.74rem; color: #64748b; margin: 0.15rem 0 0 0;">
                معاينة جاهزة للطباعة المباشرة A4 مخصصة للتوزيع الصفي
              </p>
            </div>
          </div>

          <!-- Main Actions: Batch Printing + Single Sheet Quick Print -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            
            <!-- PROMINENT BATCH PRINT BUTTON (حسب عدد الطلاب لمنع الغش) -->
            <button 
              type="button" 
              onclick="window.centrlyApp.openBatchPrintModal()"
              style="height: 34px; padding: 0 14px; font-size: 0.78rem; font-weight: 800; background: #0f172a; color: #ffffff; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(15,23,42,0.18);"
            >
              <span style="font-size: 1rem;">🖨️</span>
              <span>طباعة حسب عدد الطلاب (توزيع A / B / C)</span>
              <span style="background: #2563eb; color: #ffffff; font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; font-weight: 900;">موصى به</span>
            </button>

            <button 
              type="button" 
              onclick="window.centrlyApp.triggerPrint('exam')"
              style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
              title="طباعة ورقة واحدة لنموذج ${selectedModel} الحالي"
            >
              ${getIcon('print', 13)}
              <span>طباعة ورقة الأسئلة (A4)</span>
            </button>

            <button 
              type="button" 
              onclick="window.centrlyApp.triggerPrint('bubble')"
              style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
              title="طباعة ورقة بابل شيت واحدة لنموذج ${selectedModel} الحالي"
            >
              ${getIcon('check', 13)}
              <span>طباعة البابل شيت (A4)</span>
            </button>

            <button 
              type="button" 
              onclick="window.centrlyApp.editPaperExam('${escapeHtml(targetQuiz.id)}')"
              style="height: 32px; padding: 0 10px; font-size: 0.76rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
            >
              ${getIcon('edit', 13)}
              <span>تعديل الأسئلة</span>
            </button>
          </div>
        </div>

        <!-- Exam & Model Pickers -->
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <label style="font-size: 0.76rem; font-weight: 700; color: #64748b;">اختر الامتحان:</label>
            <select class="form-select" style="min-width: 190px; height: 30px; font-size: 0.76rem; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; padding: 0 8px;" onchange="window.centrlyApp.selectPrintQuiz(this.value)">
              ${paperQuizzes.length > 0 ? paperQuizzes.map(rq => `
                <option value="${escapeHtml(rq.id)}" ${rq.id === targetQuiz.id ? 'selected' : ''}>
                  ${escapeHtml(rq.title)} (${escapeHtml(rq.subject || 'الفيزياء')})
                </option>
              `).join('') : `
                <option value="default">${escapeHtml(targetQuiz.title)}</option>
              `}
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <label style="font-size: 0.76rem; font-weight: 700; color: #64748b;">معاينة النموذج:</label>
            <select class="form-select" style="width: 170px; height: 30px; font-size: 0.76rem; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; padding: 0 8px;" onchange="window.centrlyApp.selectPrintModel(this.value)">
              <option value="A" ${selectedModel === 'A' ? 'selected' : ''}>النموذج الأول (A - كود 01)</option>
              <option value="B" ${selectedModel === 'B' ? 'selected' : ''}>النموذج الثاني (B - كود 02)</option>
              <option value="C" ${selectedModel === 'C' ? 'selected' : ''}>النموذج الثالث (C - كود 03)</option>
            </select>
          </div>

          <!-- Stealth Notice Pill -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 0.25rem 0.65rem; font-size: 0.72rem; color: #475569; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
            <span>التشفير الذكي نشط: ترتيب الأسئلة يختلف تلقائياً بين النماذج ويُقرأ بالباركود عبر الكاميرا</span>
          </div>
        </div>
      </div>

      <!-- BATCH PRINT CONFIGURATION MODAL (طباعة دفعات النماذج حسب عدد الطلاب) -->
      ${isBatchModalOpen ? `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.65); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(2px);">
          <div class="card" style="width: 100%; max-width: 520px; background: #ffffff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.22); border: 1px solid #cbd5e1; direction: rtl;" onclick="event.stopPropagation()">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.15rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <div>
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 0.45rem;">
                  <span>🖨️</span>
                  <span>طباعة وتوزيع نماذج الامتحان على الطلاب</span>
                </h3>
                <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: #64748b;">
                  ${escapeHtml(targetQuiz.title)} (${escapeHtml(targetQuiz.subject || 'الفيزياء')})
                </p>
              </div>
              <button type="button" onclick="window.centrlyApp.closeBatchPrintModal()" style="background: none; border: none; font-size: 1.25rem; color: #94a3b8; cursor: pointer; padding: 0 4px;">✕</button>
            </div>

            <!-- Number of Students Counter -->
            <div style="margin-bottom: 1.25rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 800; color: #0f172a; margin-bottom: 0.4rem;">
                عدد الطلاب المطلوب طباعة أوراقهم:
              </label>
              <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.65rem;">
                <button type="button" onclick="window.centrlyApp.updateBatchPrintField('batchPrintCount', Math.max(1, ${batchCount} - 5))" style="width: 38px; height: 36px; font-weight: 800; font-size: 0.88rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">-5</button>
                <button type="button" onclick="window.centrlyApp.updateBatchPrintField('batchPrintCount', Math.max(1, ${batchCount} - 1))" style="width: 36px; height: 36px; font-weight: 800; font-size: 1rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">-</button>
                <input 
                  type="number" 
                  min="1" 
                  max="500" 
                  value="${batchCount}" 
                  onchange="window.centrlyApp.updateBatchPrintField('batchPrintCount', Math.max(1, parseInt(this.value)||1))"
                  style="width: 90px; height: 36px; text-align: center; font-size: 1.15rem; font-weight: 900; color: #0f172a; border: 1.5px solid #2563eb; border-radius: 6px; background: #ffffff;"
                />
                <button type="button" onclick="window.centrlyApp.updateBatchPrintField('batchPrintCount', ${batchCount} + 1)" style="width: 36px; height: 36px; font-weight: 800; font-size: 1rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">+</button>
                <button type="button" onclick="window.centrlyApp.updateBatchPrintField('batchPrintCount', ${batchCount} + 5)" style="width: 38px; height: 36px; font-weight: 800; font-size: 0.88rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">+5</button>
              </div>
            </div>

            <!-- Models Selection Checkboxes -->
            <div style="margin-bottom: 1.15rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 800; color: #0f172a; margin-bottom: 0.4rem;">
                النماذج المشمولة في التوزيع:
              </label>
              <div style="display: flex; gap: 0.65rem;">
                ${['A', 'B', 'C'].map(m => {
                  const isChecked = batchModels.includes(m);
                  return `
                    <label style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0.55rem; border-radius: 6px; border: 1.5px solid ${isChecked ? '#0f172a' : '#cbd5e1'}; background: ${isChecked ? '#0f172a' : '#f8fafc'}; color: ${isChecked ? '#ffffff' : '#475569'}; cursor: pointer; font-size: 0.82rem; font-weight: 800; transition: all 0.15s ease;">
                      <input 
                        type="checkbox" 
                        ${isChecked ? 'checked' : ''} 
                        onchange="window.centrlyApp.toggleBatchPrintModel('${m}')"
                        style="cursor: pointer; accent-color: #2563eb;"
                      />
                      <span>نموذج (${m})</span>
                    </label>
                  `;
                }).join('')}
              </div>
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.55rem 0.75rem; margin-top: 0.55rem; font-size: 0.74rem; color: #1e40af; line-height: 1.5;">
                <b>💡 التوزيع الذكي:</b> سيتم تكرار النماذج بالتناوب التلقائي (A ثم B ثم C...) ليحصل كل طالب على نموذج مختلف عن زميله المجاور لمنع الغش.<br>
                <b>الحسبة:</b> ${escapeHtml(modelBreakdown)}.
              </div>
            </div>

            <!-- Print Document Type -->
            <div style="margin-bottom: 1.35rem;">
              <label style="display: block; font-size: 0.82rem; font-weight: 800; color: #0f172a; margin-bottom: 0.4rem;">
                نوع الأوراق المراد طباعتها:
              </label>
              <div style="display: flex; flex-direction: column; gap: 0.45rem;">
                <label style="display: flex; align-items: center; gap: 8px; padding: 0.55rem 0.75rem; border: 1px solid ${batchType === 'exam' ? '#2563eb' : '#e2e8f0'}; border-radius: 6px; background: ${batchType === 'exam' ? '#eff6ff' : '#ffffff'}; cursor: pointer; font-size: 0.82rem; font-weight: 700;">
                  <input type="radio" name="batchType" value="exam" ${batchType === 'exam' ? 'checked' : ''} onchange="window.centrlyApp.updateBatchPrintField('batchPrintType', 'exam')" style="accent-color: #2563eb;" />
                  <span>ورقة الأسئلة فقط (A4) — ${batchCount} ورقة</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; padding: 0.55rem 0.75rem; border: 1px solid ${batchType === 'bubble' ? '#2563eb' : '#e2e8f0'}; border-radius: 6px; background: ${batchType === 'bubble' ? '#eff6ff' : '#ffffff'}; cursor: pointer; font-size: 0.82rem; font-weight: 700;">
                  <input type="radio" name="batchType" value="bubble" ${batchType === 'bubble' ? 'checked' : ''} onchange="window.centrlyApp.updateBatchPrintField('batchPrintType', 'bubble')" style="accent-color: #2563eb;" />
                  <span>ورقة الإجابة (بابل شيت) فقط (A4) — ${batchCount} ورقة</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; padding: 0.55rem 0.75rem; border: 1px solid ${batchType === 'both' ? '#2563eb' : '#e2e8f0'}; border-radius: 6px; background: ${batchType === 'both' ? '#eff6ff' : '#ffffff'}; cursor: pointer; font-size: 0.82rem; font-weight: 700;">
                  <input type="radio" name="batchType" value="both" ${batchType === 'both' ? 'checked' : ''} onchange="window.centrlyApp.updateBatchPrintField('batchPrintType', 'both')" style="accent-color: #2563eb;" />
                  <span>الامتحان + البابل شيت معاً لكل طالب — ${batchCount * 2} ورقة (ورقة الامتحان تليها ورقة البابل شيت الخاصة به)</span>
                </label>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
              <button 
                type="button" 
                onclick="window.centrlyApp.closeBatchPrintModal()"
                style="height: 36px; padding: 0 16px; font-size: 0.8rem; font-weight: 700; background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;"
              >
                إلغاء
              </button>

              <button 
                type="button" 
                onclick="window.centrlyApp.confirmBatchPrint()"
                style="height: 36px; padding: 0 20px; font-size: 0.84rem; font-weight: 800; background: #0f172a; color: #ffffff; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(15,23,42,0.25);"
              >
                <span>🖨️</span>
                <span>بدء الطباعة الآن (${batchCount * (batchType === 'both' ? 2 : 1)} ورقة)</span>
              </button>
            </div>

          </div>
        </div>
      ` : ''}

      <!-- Live Printable Preview Container (Responsive & Screen-Fitted) -->
      <div id="centrlyPrintContainer" style="display: flex; flex-direction: column; gap: 2rem; width: 100%; box-sizing: border-box;">
        
        <!-- Printable Exam Paper (A4 Sheet Preview) -->
        ${renderExamSheetHtml(targetQuiz, selectedModel, null, null, false)}

        <!-- Printable Bubble Sheet (A4 Sheet Preview) -->
        ${renderBubbleSheetHtml(targetQuiz, selectedModel, null, null, false)}

      </div>

    </div>
  `;
}


// ============================================================================
// TAB 4: PAPER SCANNER (تصحيح الامتحانات الورقية بالباركود والـ OMR)
// ============================================================================
function renderPaperScannerTab(state, groups, activeGroup, quizzes, currentQuiz, groupStudents) {
  const paperExams = (state.richQuizzes || []).filter(q => q.exam_mode === 'paper');
  const selectedExamId = state.omrSelectedExamId || (paperExams[0]?.id || '');
  const activePaperExam = paperExams.find(q => String(q.id) === String(selectedExamId)) || paperExams[0] || null;
  const scannedList = state.scannedResultsList || [];
  const isCameraOpen = Boolean(state.isOmrCameraOpen);

  const scannedCount = scannedList.length;
  const highestScore = scannedCount > 0 ? Math.max(...scannedList.map(s => Number(s.score) || 0)) : 0;
  const avgScore = scannedCount > 0 ? (scannedList.reduce((acc, s) => acc + (Number(s.score) || 0), 0) / scannedCount).toFixed(1) : '—';

  return `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      
      <!-- Top Control Card (Swiss Minimal) -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1.15rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
          <div>
            <h3 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
              <span>ماسح البابل شيت والتصحيح الآلي (OMR)</span>
            </h3>
            <p style="font-size: 0.78rem; color: #64748b; margin: 0.2rem 0 0 0;">
              التعرف التلقائي على أوراق الإجابة ورصد درجات الطلاب فوراً عبر الكاميرا أو رفع الصور.
            </p>
          </div>

          <!-- Main Actions -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            ${isCameraOpen ? `
              <button 
                type="button" 
                style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; background: #ffffff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                onclick="window.centrlyApp.stopOmrCamera()"
              >
                ${getIcon('close', 14, '#b91c1c')}
                <span>إغلاق الكاميرا</span>
              </button>
            ` : `
              <button 
                type="button" 
                style="height: 32px; padding: 0 14px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
                onclick="window.centrlyApp.startOmrCamera()"
              >
                ${getIcon('camera', 14, '#ffffff')}
                <span>فتح الكاميرا للمسح المباشر</span>
              </button>
            `}

            <input 
              type="file" 
              id="omrImageFileInput" 
              accept="image/*" 
               
              style="display: none;" 
              onchange="window.centrlyApp.handleOmrImageUpload(this.files[0])"
            />
            <button 
              type="button" 
              style="height: 32px; padding: 0 12px; font-size: 0.76rem; font-weight: 700; background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
              onclick="document.getElementById('omrImageFileInput').click()"
            >
              ${getIcon('upload', 14)}
              <span>رفع صورة ورقة بابل شيت</span>
            </button>

          </div>
        </div>

        <!-- Exam Filter Selector Bar -->
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <label style="font-size: 0.78rem; font-weight: 700; color: #64748b;">الامتحان المراد تصحيحه:</label>
            <select 
              id="omrTargetExamSelect" 
              class="form-select" 
              style="min-width: 240px; height: 32px; font-size: 0.78rem; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; padding: 0 8px; color: #0f172a;" 
              onchange="window.centrlyApp.selectOmrTargetExam(this.value)"
            >
              ${paperExams.length > 0 ? paperExams.map(pe => `
                <option value="${escapeHtml(pe.id)}" ${String(pe.id) === String(selectedExamId) ? 'selected' : ''}>
                  ${escapeHtml(pe.title)} (كود: EX-${pe.quiz_number || 1}) - ${(pe.questions || []).filter(q => q.type !== 'essay').length} أسئلة MCQ
                </option>
              `).join('') : `
                <option value="default">امتحان ورقي افتراضي (كود: EX-1)</option>
              `}
            </select>
          </div>

          ${activePaperExam ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 0.25rem 0.65rem; font-size: 0.74rem; color: #475569; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem;">
              <span>المادة: ${escapeHtml(activePaperExam.subject || 'الفيزياء')}</span>
              <span>•</span>
              <span>كود الامتحان: EX-${activePaperExam.quiz_number || 1}</span>
              <span>•</span>
              <span>زمن الامتحان: ${activePaperExam.time_limit_minutes || 45} دقيقة</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Vertical Camera Viewport (تظهر فقط عند فتح الكاميرا وتكون رأسية بالطول) -->
      ${isCameraOpen ? `
        <div class="card" style="margin: 0; background: #0f172a; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; position: relative;">
          
          <div style="font-size: 0.9rem; font-weight: 800; color: #38bdf8; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('camera', 18, '#38bdf8')}
            <span>كاميرا المسح الرأسي لورقة البابل شيت (A4 Portrait)</span>
          </div>

          <div style="position: relative; width: 100%; max-width: 360px; height: 480px; background: #000; border-radius: 10px; overflow: hidden; border: 2.5px solid #334155; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(0,0,0,0.4);">
            <video id="omrVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
            <canvas id="omrCanvas" style="display: none;"></canvas>

            <!-- Vertical A4 Frame Guide -->
            <div id="omrFrameGuide" style="position: absolute; inset: 16px; border: 2px dashed rgba(255,255,255,0.7); border-radius: 8px; pointer-events: none; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5); display: flex; flex-direction: column; justify-content: space-between; padding: 10px;">
              <div style="background: rgba(15,23,42,0.85); color: #fff; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; align-self: flex-start; border: 1px solid rgba(255,255,255,0.2);">
                ضع ورقة البابل شيت بالكامل داخل الإطار
              </div>
              <div style="text-align: center; color: rgba(255,255,255,0.85); font-size: 0.7rem; font-weight: 600; background: rgba(0,0,0,0.6); padding: 3px 6px; border-radius: 4px;">
                تأكد من إضاءة الورقة ووضوح كود الطالب
              </div>
            </div>
          </div>

          <div style="margin-top: 0.85rem; display: flex; gap: 0.65rem; align-items: center;">
            <button 
              type="button" 
              style="background: #ffffff; color: #0f172a; font-weight: 700; font-size: 0.82rem; height: 34px; padding: 0 1.25rem; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
              onclick="window.centrlyApp.captureAndAnalyzeOmr()"
            >
              ${getIcon('camera', 14, '#0f172a')}
              <span>التقاط وتصحيح الورقة الآن</span>
            </button>

            <button 
              type="button" 
              style="background: transparent; border: 1px solid #475569; color: #f87171; font-weight: 600; font-size: 0.78rem; height: 34px; padding: 0 12px; border-radius: 5px; cursor: pointer;"
              onclick="window.centrlyApp.stopOmrCamera()"
            >
              إغلاق الكاميرا
            </button>
          </div>

        </div>
      ` : ''}

      <!-- Scanned Scores Live Stream & Records Table (Swiss Minimal) -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1.15rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
              <span>سجل درجات الطلاب المرصودة بالماسح الضوئي</span>
            </h4>
            <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.15rem;">
              تظهر هنا كل ورقة يتم مسحها وتصحيحها فوراً مع إمكانية إرسال النتيجة واتساب لولي الأمر.
            </div>
          </div>

          <div style="display: flex; gap: 0.45rem; align-items: center;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.3rem 0.7rem; text-align: center;">
              <span style="font-size: 0.68rem; color: #64748b; font-weight: 600; display: block;">أوراق مصححة</span>
              <span style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">${scannedCount}</span>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.3rem 0.7rem; text-align: center;">
              <span style="font-size: 0.68rem; color: #64748b; font-weight: 600; display: block;">متوسط الدرجات</span>
              <span style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">${avgScore}</span>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.3rem 0.7rem; text-align: center;">
              <span style="font-size: 0.68rem; color: #64748b; font-weight: 600; display: block;">أعلى درجة</span>
              <span style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">${highestScore}</span>
            </div>
            ${scannedCount > 0 ? `
              <button 
                type="button" 
                style="height: 28px; padding: 0 9px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer;" 
                onclick="window.centrlyApp.clearOmrScannedList()"
                title="مسح سجل جلسة التصحيح الحالية"
              >
                تفريغ السجل
              </button>
            ` : ''}
          </div>
        </div>

        ${scannedCount > 0 ? `
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">#</th>
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">كود الطالب</th>
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">اسم الطالب</th>
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">الامتحان</th>
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">النموذج</th>
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">الدرجة المحققة</th>
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">النسبة</th>
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b;">توقيت الرصد</th>
                  <th style="padding: 0.65rem 0.75rem; font-size: 0.76rem; font-weight: 700; color: #64748b; text-align: center;">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${scannedList.map((item, idx) => {
                  return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 0.65rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: #64748b;">${idx + 1}</td>
                      <td style="padding: 0.65rem 0.75rem; font-size: 0.85rem; font-weight: 700; font-family: monospace; color: #0f172a;">${escapeHtml(item.student_code || '—')}</td>
                      <td style="padding: 0.65rem 0.75rem; font-size: 0.85rem; font-weight: 700; color: #0f172a;">${escapeHtml(item.student_name || 'طالب')}</td>
                      <td style="padding: 0.65rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: #475569;">
                        ${escapeHtml(item.exam_title || 'امتحان ورقي')} 
                        <span style="font-size: 0.72rem; font-family: monospace; color: #64748b;">(${escapeHtml(item.exam_code || '')})</span>
                      </td>
                      <td style="padding: 0.65rem 0.75rem;">
                        <span style="background: #f1f5f9; color: #0f172a; font-weight: 700; font-size: 0.74rem; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">نموذج ${escapeHtml(item.model || 'أ')}</span>
                      </td>
                      <td style="padding: 0.65rem 0.75rem; font-size: 0.95rem; font-weight: 800; color: #0f172a;">
                        ${item.score} / ${item.max_score}
                      </td>
                      <td style="padding: 0.65rem 0.75rem;">
                        <span style="background: #f8fafc; color: #0f172a; font-weight: 700; font-size: 0.76rem; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">
                          ${item.percentage}%
                        </span>
                      </td>
                      <td style="padding: 0.65rem 0.75rem; font-size: 0.74rem; color: #64748b; font-weight: 600;">
                        ${item.timestamp || 'الآن'}
                      </td>
                      <td style="padding: 0.65rem 0.75rem; text-align: center;">
                        <button 
                          type="button" 
                          style="height: 26px; padding: 0 8px; font-size: 0.74rem; font-weight: 600; background: #ffffff; color: #166534; border: 1px solid #86efac; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                          onclick="window.centrlyApp.sendScannedStudentWhatsApp('${item.id}')"
                          title="إرسال النتيجة لولي الأمر على واتساب"
                        >
                          ${getIcon('whatsapp', 12, '#166534')}
                          <span>واتساب</span>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align: center; padding: 2.5rem 1.5rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
            <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a; margin-bottom: 0.25rem;">
              لم يتم مسح أي ورقة بابل شيت حتى الآن
            </div>
            <p style="font-size: 0.78rem; color: #64748b; max-width: 420px; margin: 0 auto 1rem auto; line-height: 1.5;">
              اضغط على زر <b>«فتح الكاميرا للمسح المباشر»</b> أو <b>«رفع صورة ورقة بابل شيت»</b> للبدء في قراءة الأوراق ورصد درجات الطلاب تلقائياً وراء بعضها هنا.
            </p>
          </div>
        `}

      </div>

    </div>
  `;
}

// ============================================================================
// REGISTER ALL ACTIONS ON APP
// ============================================================================
export function registerTeacherQuizzesActions(app) {

  // Initialize drafts cache
  try {
    const cachedDrafts = localStorage.getItem('centrly_quiz_drafts');
    if (cachedDrafts) {
      app.quizzesState.examDrafts = JSON.parse(cachedDrafts);
    }
  } catch (_) {}
  if (!Array.isArray(app.quizzesState.examDrafts)) {
    app.quizzesState.examDrafts = [];
  }

  // Initialize rich quizzes cache for instant UI rendering (0ms load time)
  try {
    const cachedQuizzes = localStorage.getItem('centrly_cached_rich_quizzes');
    if (cachedQuizzes) {
      app.quizzesState.richQuizzes = JSON.parse(cachedQuizzes);
    }
  } catch (_) {}
  if (!Array.isArray(app.quizzesState.richQuizzes)) {
    app.quizzesState.richQuizzes = [];
  }

  // Detect unsaved exam
  app.checkHasUnsavedExam = function(mode) {
    if (mode === 'online') {
      const qz = this.quizzesState.activeOnlineQuiz;
      if (!qz) return false;

      // If this is an existing published exam, compare with original snapshot
      if (qz._isExistingPublished && qz._originalSnapshot) {
        try {
          const snap = JSON.parse(qz._originalSnapshot);
          const curTitle = document.getElementById('wizardTitle')?.value?.trim() ?? qz.title;
          const curSubject = document.getElementById('wizardSubject')?.value?.trim() ?? qz.subject;
          if (curTitle !== snap.title || curSubject !== snap.subject) return true;

          const curQInput = document.getElementById('currentQText')?.value?.trim();
          const curQIdx = this.quizzesState.currentQuestionIndex || 0;
          if (curQInput !== undefined && qz.questions?.[curQIdx]) {
            if (curQInput !== (snap.questions?.[curQIdx]?.text || '')) return true;
          }

          if ((qz.questions?.length || 0) !== (snap.questions?.length || 0)) return true;

          const qzSimplified = (qz.questions || []).map(q => ({
            text: (q.text || '').trim(),
            image_url: q.image_url || '',
            correct_answer: q.correct_answer,
            choices: q.choices || [],
            points: q.points || 1
          }));
          const snapSimplified = (snap.questions || []).map(q => ({
            text: (q.text || '').trim(),
            image_url: q.image_url || '',
            correct_answer: q.correct_answer,
            choices: q.choices || [],
            points: q.points || 1
          }));
          if (JSON.stringify(qzSimplified) !== JSON.stringify(snapSimplified)) return true;

          return false; // Published exam has not been altered
        } catch (_) {}
      }

      const hasQuestions = Array.isArray(qz.questions) && qz.questions.some(q => (q.text && q.text.trim()) || q.image_url);
      const isCustomTitle = qz.title && !qz.title.startsWith('كويز') && qz.title.trim().length > 0;
      const isStep2 = (this.quizzesState.wizardStep || 1) >= 2;
      return Boolean(hasQuestions || (isCustomTitle && isStep2));
    } else if (mode === 'paper') {
      const qz = this.quizzesState.activePaperQuiz;
      if (!qz) return false;

      // If this is an existing published paper exam, compare with original snapshot
      if (qz._isExistingPublished && qz._originalSnapshot) {
        try {
          const snap = JSON.parse(qz._originalSnapshot);
          const curTitle = document.getElementById('paperQuizTitle')?.value?.trim() ?? qz.title;
          const curSubject = document.getElementById('paperQuizSubject')?.value?.trim() ?? qz.subject;
          if (curTitle !== snap.title || curSubject !== snap.subject) return true;

          if ((qz.questions?.length || 0) !== (snap.questions?.length || 0)) return true;

          const qzSimplified = (qz.questions || []).map(q => ({
            text: (q.text || '').trim(),
            image_url: q.image_url || '',
            correct_answer: q.correct_answer,
            choices: q.choices || [],
            points: q.points || 1
          }));
          const snapSimplified = (snap.questions || []).map(q => ({
            text: (q.text || '').trim(),
            image_url: q.image_url || '',
            correct_answer: q.correct_answer,
            choices: q.choices || [],
            points: q.points || 1
          }));
          if (JSON.stringify(qzSimplified) !== JSON.stringify(snapSimplified)) return true;

          return false; // Published exam has not been altered
        } catch (_) {}
      }

      const hasQuestions = Array.isArray(qz.questions) && qz.questions.some(q => (q.text && q.text.trim()) || q.image_url);
      const isCustomTitle = qz.title && !qz.title.startsWith('امتحان') && qz.title.trim().length > 0;
      const isStep2 = (this.quizzesState.paperWizardStep || 1) >= 2;
      return Boolean(hasQuestions || (isCustomTitle && isStep2));
    }
    return false;
  };

  app.promptUnsavedExamExit = function(mode, targetAction = null) {
    this.quizzesState.exitPromptMode = mode;
    this.quizzesState.exitPromptTargetAction = targetAction;
    this.renderMainContent();
  };

  app.dismissExitPrompt = function() {
    this.quizzesState.exitPromptMode = null;
    this.quizzesState.exitPromptTargetAction = null;
    this.renderMainContent();
  };

  app.saveExamToArchive = async function(mode) {
    const isOnline = mode === 'online';
    const qz = isOnline ? this.quizzesState.activeOnlineQuiz : this.quizzesState.activePaperQuiz;
    if (!qz) {
      this.dismissExitPrompt();
      return;
    }

    if (isOnline) {
      const t = document.getElementById('wizardTitle')?.value?.trim();
      if (t) qz.title = t;
      const s = document.getElementById('wizardSubject')?.value?.trim();
      if (s) qz.subject = s;
      const curTxt = document.getElementById('currentQText')?.value?.trim();
      const curIdx = this.quizzesState.currentQuestionIndex || 0;
      if (curTxt && qz.questions?.[curIdx]) {
        qz.questions[curIdx].text = curTxt;
      }
    } else {
      const t = document.getElementById('paperQuizTitle')?.value?.trim();
      if (t) qz.title = t;
      const s = document.getElementById('paperQuizSubject')?.value?.trim();
      if (s) qz.subject = s;
    }

    const isExistingPublished = Boolean(qz._isExistingPublished || (qz.id && !qz.is_draft));
    // If it's an existing published exam, create a separate draft copy so the published exam remains 100% active and untouched
    const draftId = isExistingPublished 
      ? `draft_copy_${qz.id}_${Date.now()}`
      : (qz.id || `draft_${mode}_${Date.now()}`);

    const draftObject = {
      ...qz,
      id: draftId,
      exam_mode: isOnline ? 'online' : 'paper',
      title: (qz.title || (isOnline ? 'مسودة امتحان إلكتروني' : 'مسودة امتحان ورقي')) + (isExistingPublished ? ' (مسودة تعديل)' : ''),
      subject: qz.subject || 'الفيزياء',
      is_draft: true,
      is_archived: true,
      status: 'draft',
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!Array.isArray(this.quizzesState.examDrafts)) {
      this.quizzesState.examDrafts = [];
    }

    this.quizzesState.examDrafts = this.quizzesState.examDrafts.filter(d => d.id !== draftId);
    this.quizzesState.examDrafts.unshift(draftObject);

    try {
      localStorage.setItem('centrly_quiz_drafts', JSON.stringify(this.quizzesState.examDrafts));
      localStorage.setItem('centrly_cached_rich_quizzes', JSON.stringify(this.quizzesState.richQuizzes));
    } catch (_) {}

    fetch('/api/quizzes/rich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftObject)
    }).catch(() => {});

    const targetAction = this.quizzesState.exitPromptTargetAction;
    this.quizzesState.exitPromptMode = null;
    this.quizzesState.exitPromptTargetAction = null;
    if (isOnline) {
      this.quizzesState.activeOnlineQuiz = null;
      this.quizzesState.onlineViewMode = 'list';
      this.quizzesState.onlineListTab = 'drafts';
    } else {
      this.quizzesState.activePaperQuiz = null;
      this.quizzesState.paperViewMode = 'list';
      this.quizzesState.paperListTab = 'drafts';
    }

    this.showToast('تم حفظ مسودة التعديلات في الأرشيف بنجاح! وسيبقى الامتحان الأصلي منشوراً كما هو.', 'success');
    if (typeof targetAction === 'function') {
      targetAction();
    } else {
      this.renderMainContent();
    }
  };

  app.discardUnsavedExam = function(mode) {
    const isOnline = mode === 'online';
    const qz = isOnline ? this.quizzesState.activeOnlineQuiz : this.quizzesState.activePaperQuiz;
    const isExistingPublished = Boolean(qz?._isExistingPublished || (qz?.id && !qz.is_draft));
    const targetAction = this.quizzesState.exitPromptTargetAction;
    this.quizzesState.exitPromptMode = null;
    this.quizzesState.exitPromptTargetAction = null;

    if (isOnline) {
      this.quizzesState.activeOnlineQuiz = null;
      this.quizzesState.onlineViewMode = 'list';
    } else {
      this.quizzesState.activePaperQuiz = null;
      this.quizzesState.paperViewMode = 'list';
    }

    if (isExistingPublished) {
      this.showToast('تم الرجوع بنجاح، والامتحان ما زال منشوراً للطلاب كما هو دون أي تغيير.', 'info');
    } else {
      this.showToast('تم تجاهل ومسح الامتحان.', 'info');
    }

    if (typeof targetAction === 'function') {
      targetAction();
    } else {
      this.renderMainContent();
    }
  };

  app.resumeExamDraft = function(draftId, mode) {
    const list = this.quizzesState.examDrafts || [];
    const draft = list.find(d => d.id === draftId);
    if (!draft) {
      this.showToast('لم يتم العثور على المسودة المطلوبة', 'warning');
      return;
    }

    const cloned = JSON.parse(JSON.stringify(draft));
    cloned._sourceDraftId = draft.id;
    cloned.is_draft = false;
    cloned.is_archived = false;
    cloned.status = 'published';
    if (cloned.id && String(cloned.id).startsWith('draft_')) {
      cloned.id = null;
    }
    if (mode === 'online') {
      this.quizzesState.activeOnlineQuiz = cloned;
      this.quizzesState.onlineViewMode = 'wizard';
      this.quizzesState.wizardStep = (cloned.questions && cloned.questions.length > 0) ? 2 : 1;
      this.quizzesState.currentQuestionIndex = 0;
    } else {
      this.quizzesState.activePaperQuiz = cloned;
      this.quizzesState.paperViewMode = 'create';
      this.quizzesState.paperWizardStep = (cloned.questions && cloned.questions.length > 0) ? 2 : 1;
      this.quizzesState.currentPaperQIdx = 0;
    }
    this.renderMainContent();
    this.showToast(`تم استعادة مسودة (${cloned.title || 'الامتحان'}) للاستكمال والنشر!`, 'info');
  };

  app.deleteExamDraft = function(draftId) {
    this.showConfirmModal({
      title: 'حذف المسودة من الأرشيف',
      message: 'هل أنت متأكد من حذف هذه المسودة من الأرشيف نهائياً؟\nلا يمكن التراجع عن هذا الإجراء بعد الحذف.',
      confirmText: 'حذف المسودة',
      cancelText: 'إلغاء',
      isDanger: true,
      onConfirm: async () => {
        if (Array.isArray(this.quizzesState.examDrafts)) {
          this.quizzesState.examDrafts = this.quizzesState.examDrafts.filter(d => d.id !== draftId);
          try {
            localStorage.setItem('centrly_quiz_drafts', JSON.stringify(this.quizzesState.examDrafts));
          } catch (_) {}
        }

        fetch('/api/quizzes/rich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_draft', id: draftId })
        }).catch(() => {});

        this.showToast('تم حذف المسودة من الأرشيف بنجاح.', 'success');
        this.renderMainContent();
      }
    });
  };

  app.setOnlineListTab = function(tab) {
    this.quizzesState.onlineListTab = tab;
    this.renderMainContent();
  };

  app.setPaperListTab = function(tab) {
    this.quizzesState.paperListTab = tab;
    this.renderMainContent();
  };

  // Subtab switcher
  app.switchQuizSubTab = async function(tabName, gradingMode) {
    const user = this.user || (typeof window !== 'undefined' ? window.centrlyApp?.user : null);
    const userEmail = (user?.email || '').toLowerCase();
    const isAdmin = user?.role === 'admin' || user?.is_superadmin;
    const isOmarMohamadi = 
      user?.tenant_id === '0c67b644-ae42-49e8-975f-85b9d0af0e1b' || 
      userEmail === 'mohanedabdulhalim@gmail.com' ||
      userEmail.includes('omar') ||
      userEmail.includes('mohamadi') ||
      (user?.name || '').includes('عمر') ||
      (user?.teacher_name || '').includes('عمر') ||
      (user?.tenant_name || '').includes('عمر') ||
      isAdmin;

    if (!isOmarMohamadi && tabName !== 'roster') {
      return;
    }

    if (this.quizzesState.activeSubTab === 'online_builder' && this.quizzesState.onlineViewMode === 'wizard' && this.checkHasUnsavedExam('online')) {
      this.promptUnsavedExamExit('online', () => this.switchQuizSubTab(tabName, gradingMode));
      return;
    }
    if (this.quizzesState.activeSubTab === 'paper_builder' && this.quizzesState.paperViewMode === 'create' && this.checkHasUnsavedExam('paper')) {
      this.promptUnsavedExamExit('paper', () => this.switchQuizSubTab(tabName, gradingMode));
      return;
    }

    this.quizzesState.activeSubTab = tabName;
    if (gradingMode) {
      this.quizzesState.gradingViewMode = gradingMode;
    }
    if (tabName === 'online_builder' || tabName === 'paper_builder') {
      const hasQuizzes = Array.isArray(this.quizzesState.richQuizzes) && this.quizzesState.richQuizzes.length > 0;
      if (!hasQuizzes) {
        this.quizzesState.isLoadingRichQuizzes = true;
      }
      this.renderMainContent();
      await Promise.all([
        this.loadRichQuizzes(),
        this.loadOnlineSubmissions()
      ]);
    } else if (tabName === 'online_grading') {
      this.quizzesState.isLoadingSubmissions = true;
      this.renderMainContent();
      await this.loadOnlineSubmissions();
    } else {
      this.renderMainContent();
    }
  };


  // Auto-reconciliation: ensure any quiz with student submissions appears in richQuizzes
  app.reconcileQuizzesFromSubmissions = function() {
    if (!Array.isArray(this.quizzesState.richQuizzes)) {
      this.quizzesState.richQuizzes = [];
    }
    const submissions = this.quizzesState.onlineSubmissions || [];
    for (const sub of submissions) {
      const qId = sub.quiz_id || sub.material_id;
      if (!qId) continue;
      const exists = this.quizzesState.richQuizzes.some(
        q => q.id === qId || (String(q.group_id).trim() === String(sub.group_id).trim() && Number(q.quiz_number) === Number(sub.quiz_number) && (q.exam_mode || 'online') === 'online')
      );
      if (!exists && Array.isArray(sub.questions) && sub.questions.length > 0) {
        this.quizzesState.richQuizzes.push({
          id: qId,
          title: sub.quiz_title || `كويز ${sub.quiz_number || 1}`,
          subject: sub.subject || 'الفيزياء',
          group_id: sub.group_id,
          quiz_number: Number(sub.quiz_number) || 1,
          time_limit_minutes: Number(sub.time_limit_minutes) || 20,
          available_date: sub.submitted_at ? sub.submitted_at.slice(0, 10) : '',
          start_time: null,
          end_time: null,
          exam_mode: 'online',
          questions: sub.questions,
          created_at: sub.submitted_at || new Date().toISOString()
        });
      }
    }
  };

  // Rich quizzes loader
  app.loadRichQuizzes = async function() {
    const hasQuizzes = Array.isArray(this.quizzesState.richQuizzes) && this.quizzesState.richQuizzes.length > 0;
    if (!hasQuizzes) {
      this.quizzesState.isLoadingRichQuizzes = true;
    }
    try {
      const gid = this.quizzesState.selectedGroupId;
      const qParam = gid ? `?group_id=${encodeURIComponent(gid)}` : '';
      let res = await fetch(`/api/quizzes/rich${qParam}`).then(r => r.json()).catch(() => null);
      if (!res || !res.success) {
        res = await fetch(`https://centerly-eg.com/api/quizzes/rich${qParam}`).then(r => r.json()).catch(() => null);
      }
      if (!res || !res.success) {
        res = await request(`/quizzes/rich${qParam}`).catch(() => null);
      }
      if (res?.success && Array.isArray(res.quizzes)) {
        this.quizzesState.richQuizzes = res.quizzes;
        try {
          localStorage.setItem('centrly_cached_rich_quizzes', JSON.stringify(res.quizzes));
        } catch (_) {}
      }
      if (res?.success && Array.isArray(res.drafts)) {
        const serverDrafts = res.drafts;
        const localDrafts = this.quizzesState.examDrafts || [];
        const combined = [...localDrafts];
        for (const sd of serverDrafts) {
          if (!combined.some(d => d.id === sd.id)) {
            combined.push(sd);
          }
        }
        this.quizzesState.examDrafts = combined;
        try {
          localStorage.setItem('centrly_quiz_drafts', JSON.stringify(combined));
        } catch (_) {}
      }
      if (typeof this.reconcileQuizzesFromSubmissions === 'function') {
        this.reconcileQuizzesFromSubmissions();
      }
    } catch (err) {
      console.warn('[Centrly] Could not load rich quizzes:', err);
    } finally {
      this.quizzesState.isLoadingRichQuizzes = false;
      this.renderMainContent();
    }
  };

  // Online exam submissions loader (Both Pending Essay & Graded MCQ)
  app.loadOnlineSubmissions = async function() {
    this.quizzesState.isLoadingSubmissions = true;
    try {
      let allData = null;
      let pendingData = null;

      try {
        const [r1, r2] = await Promise.all([
          fetch('/api/quizzes/submissions').then(r => r.json()).catch(() => null),
          fetch('/api/quizzes/submissions?type=pending').then(r => r.json()).catch(() => null)
        ]);
        if (r1?.success && Array.isArray(r1.submissions)) allData = r1.submissions;
        if (r2?.success && Array.isArray(r2.submissions)) pendingData = r2.submissions;
      } catch (_) {}

      if (!allData || allData.length === 0) {
        const [allRes, pendingRes] = await Promise.allSettled([
          request('/quizzes/submissions'),
          request('/quizzes/submissions/pending')
        ]);

        if (allRes.status === 'fulfilled' && allRes.value?.success && Array.isArray(allRes.value.submissions)) {
          allData = allRes.value.submissions;
        }
        if (pendingRes.status === 'fulfilled' && pendingRes.value?.success && Array.isArray(pendingRes.value.submissions)) {
          pendingData = pendingRes.value.submissions;
        }
      }

      this.quizzesState.onlineSubmissions = (Array.isArray(allData) ? allData : []).map(s => {
        const fullScore = s.total_score !== undefined && s.total_score !== null 
          ? Number(s.total_score) 
          : (s.final_score !== undefined && s.final_score !== null 
              ? Number(s.final_score) 
              : (s.score !== undefined && s.score !== null 
                  ? Number(s.score) 
                  : (Number(s.mcq_score || 0) + Number(s.essay_score || 0))));
        return {
          ...s,
          score: fullScore,
          final_score: fullScore,
          total_score: fullScore
        };
      });
      this.quizzesState.pendingSubmissions = Array.isArray(pendingData) 
        ? pendingData 
        : this.quizzesState.onlineSubmissions.filter(s => s.status === 'pending' || s.status === 'needs_grading' || (!s.is_graded && s.status !== 'approved'));

      if (typeof this.reconcileQuizzesFromSubmissions === 'function') {
        this.reconcileQuizzesFromSubmissions();
      }

      // Resilient local test submissions fallback (detects exams submitted in the browser)
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('centrly_submission_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && (parsed.status === 'pending' || !parsed.is_graded)) {
                const subObj = {
                  id: `local_${parsed.quiz_id}_${parsed.student_code || '1006'}`,
                  material_id: parsed.quiz_id,
                  quiz_id: parsed.quiz_id,
                  quiz_title: parsed.quiz_title || 'كويز إلكتروني',
                  quiz_number: parsed.quiz_number || 1,
                  group_id: parsed.group_id || null,
                  student_code: parsed.student_code || '1006',
                  student_name: parsed.student_name || 'مهند خالد',
                  status: 'pending',
                  is_graded: false,
                  mcq_score: parsed.mcq_score || 0,
                  total_mcq_points: parsed.total_mcq_points || 0,
                  total_score: null,
                  max_score: parsed.max_score || 10,
                  questions: parsed.questions || [],
                  answers: parsed.answers || {},
                  essay_answers: parsed.essay_answers || {},
                  submitted_at: parsed.submitted_at || new Date().toISOString()
                };
                const alreadyExists = this.quizzesState.pendingSubmissions.some(
                  s => (s.quiz_id === subObj.quiz_id && s.student_code === subObj.student_code) || s.id === subObj.id
                );
                if (!alreadyExists) {
                  this.quizzesState.pendingSubmissions.unshift(subObj);
                }
              }
            }
          }
        }
      } catch (_) {}
    } catch (err) {
      console.warn('[Centrly] Could not load online submissions:', err);
    } finally {
      this.quizzesState.isLoadingSubmissions = false;
      this.renderMainContent();
    }
  };

  // Pending essay submissions loader (backward compat)
  app.loadPendingSubmissions = async function() {
    await this.loadOnlineSubmissions();
    this.renderMainContent();
  };

  // Online Exam Wizard Flow Handlers
  app.startNewOnlineExamWizard = function() {
    const nextNum = (this.quizzesState.quizzes?.length > 0)
      ? Math.max(...this.quizzesState.quizzes.map(q => q.number)) + 1
      : 1;

    const activeGroup = (this.groups || []).find(g => g.id === this.quizzesState.selectedGroupId) || null;
    const activeGid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id);

    this.quizzesState.onlineViewMode = 'wizard';
    this.quizzesState.wizardStep = 1;
    this.quizzesState.currentQuestionIndex = 0;
    this.quizzesState.activeOnlineQuiz = {
      id: null,
      quiz_number: nextNum,
      title: `كويز ${nextNum}`,
      subject: activeGroup?.subject || 'الفيزياء',
      target_group_ids: activeGid ? [activeGid] : [],
      target_group_id: activeGid || 'all',
      group_id: activeGid || 'all',
      question_count: 10,
      time_limit_minutes: 20,
      available_date: new Date().toISOString().slice(0, 10),
      start_time: '18:00',
      end_time: '22:00',
      exam_mode: 'online',
      questions: []
    };
    this.renderMainContent();
  };

  app.cancelOnlineExamWizard = function() {
    if (this.checkHasUnsavedExam('online')) {
      this.promptUnsavedExamExit('online');
    } else {
      this.quizzesState.onlineViewMode = 'list';
      this.renderMainContent();
    }
  };

  app.proceedToQuestionsStep = function() {
    const title = document.getElementById('wizardTitle')?.value?.trim() || `كويز ${this.quizzesState.activeOnlineQuiz?.quiz_number || 1}`;
    const subject = document.getElementById('wizardSubject')?.value?.trim() || 'الفيزياء';
    const quizNum = Number(document.getElementById('wizardQuizNumber')?.value || 1);
    const count = Number(document.getElementById('wizardQuestionCount')?.value || 10);
    const timeLimit = Number(document.getElementById('wizardTimeLimit')?.value || 20);
    const availableDate = document.getElementById('wizardAvailableDate')?.value || new Date().toISOString().slice(0, 10);
    const startTime = document.getElementById('wizardStartTime')?.value || '18:00';
    const endTime = document.getElementById('wizardEndTime')?.value || '22:00';

    const qz = this.quizzesState.activeOnlineQuiz || {};
    qz.title = title;
    qz.subject = subject;

    // Multi-group resolution
    if (!Array.isArray(qz.target_group_ids) || qz.target_group_ids.length === 0) {
      const fallbackGid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id);
      qz.target_group_ids = fallbackGid ? [fallbackGid] : [];
    }
    qz.target_group_id = (qz.target_group_ids.length === (this.groups || []).length)
      ? 'all'
      : (qz.target_group_ids.length === 1 ? qz.target_group_ids[0] : 'multiple');
    qz.group_id = qz.target_group_id;

    qz.quiz_number = quizNum;
    qz.time_limit_minutes = timeLimit;
    qz.available_date = availableDate;
    qz.start_time = startTime;
    qz.end_time = endTime;
    qz.question_count = count;

    // Initialize or adjust questions array
    if (!Array.isArray(qz.questions)) qz.questions = [];
    while (qz.questions.length < count) {
      const idx = qz.questions.length + 1;
      qz.questions.push({
        id: `q_${Date.now()}_${idx}`,
        type: 'mcq',
        text: '',
        image_url: '',
        choices: ['', '', '', ''],
        correct_index: 0,
        points: 2
      });
    }
    if (qz.questions.length > count) {
      qz.questions = qz.questions.slice(0, count);
    }

    this.quizzesState.activeOnlineQuiz = qz;
    this.quizzesState.wizardStep = 2;
    this.quizzesState.currentQuestionIndex = 0;
    this.renderMainContent();
  };

  app.backToWizardStep1 = function() {
    this.quizzesState.wizardStep = 1;
    this.renderMainContent();
  };

  app.jumpToQuestion = function(idx) {
    this.quizzesState.currentQuestionIndex = idx;
    this.renderMainContent();
  };

  app.prevQuestion = function() {
    if (this.quizzesState.currentQuestionIndex > 0) {
      this.quizzesState.currentQuestionIndex--;
      this.renderMainContent();
    }
  };

  app.nextQuestion = function() {
    const totalQ = this.quizzesState.activeOnlineQuiz?.questions?.length || 10;
    if (this.quizzesState.currentQuestionIndex < totalQ - 1) {
      this.quizzesState.currentQuestionIndex++;
      this.renderMainContent();
    }
  };

  const getActiveQuizTarget = (appCtx) => {
    return appCtx.quizzesState.activeSubTab === 'paper_builder'
      ? (appCtx.quizzesState.activePaperQuiz || appCtx.quizzesState.activeOnlineQuiz)
      : (appCtx.quizzesState.activeOnlineQuiz || appCtx.quizzesState.activePaperQuiz);
  };

  app.updateCurrentQuestionType = function(type) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const qz = getActiveQuizTarget(this);
    const q = qz?.questions?.[idx];
    if (q) {
      q.type = type;
      this.renderMainContent();
    }
  };

  app.updateCurrentQuestionField = function(field, value) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const qz = getActiveQuizTarget(this);
    const q = qz?.questions?.[idx];
    if (q) {
      q[field] = value;
    }
  };

  app.updateWizardChoice = function(choiceIdx, value) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const qz = getActiveQuizTarget(this);
    const q = qz?.questions?.[idx];
    if (q) {
      if (!Array.isArray(q.choices)) q.choices = ['', '', '', ''];
      q.choices[choiceIdx] = value;
    }
  };

  app.setWizardCorrectChoice = function(choiceIdx) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const qz = getActiveQuizTarget(this);
    const q = qz?.questions?.[idx];
    if (q) {
      q.correct_index = Number(choiceIdx);
      this.renderMainContent();
    }
  };

  app.setWizardQuestionFormat = function(format) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const qz = getActiveQuizTarget(this);
    const q = qz?.questions?.[idx];
    if (q) {
      q.format = format;
      this.renderMainContent();
    }
  };

  app.handleWizardImageUpload = async function(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('يرجى اختيار ملف صورة صالح', 'warning');
      return;
    }

    const idx = this.quizzesState.currentQuestionIndex || 0;
    const q = this.quizzesState.activeOnlineQuiz?.questions?.[idx];

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      if (q) {
        q.image_url = base64Data;
        if (!q.text?.trim()) {
          q.format = 'image_only';
        }
        this.renderMainContent();
      }

      this.showToast('تمت إضافة صورة السؤال بنجاح', 'success');

      try {
        const res = await request('/quizzes/upload-image', {
          method: 'POST',
          body: {
            image_data: base64Data,
            file_name: file.name
          }
        });
        if (res?.success && res.url && res.url !== base64Data) {
          if (q) q.image_url = res.url;
        }
      } catch (_) {
        // Data URL is fully preserved and valid locally and on save
      }
    };
    reader.readAsDataURL(file);
  };

  app.removeWizardImage = function() {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const q = this.quizzesState.activeOnlineQuiz?.questions?.[idx];
    if (q) {
      q.image_url = '';
      this.renderMainContent();
    }
  };

  // Save Online Exam Definition
  app.saveOnlineExamNow = async function() {
    if (!isUserPro(this.user)) {
      alert('ميزة إنشاء ونشر الامتحانات الإلكترونية متاحة فقط لمشتركي باقة PRO. اضغط حسناً للانتقال لصفحة الاشتراك والترقية.');
      if (this.navigateTo) this.navigateTo('settings');
      return;
    }
    const qz = this.quizzesState.activeOnlineQuiz;
    const currentGid = this.quizzesState.selectedGroupId;
    const targetGroupId = qz?.target_group_id || qz?.group_id || currentGid;

    if (!targetGroupId) {
      this.showToast('يرجى اختيار المجموعة الدراسية أولاً', 'warning');
      return;
    }

    const questions = qz?.questions || [];
    if (questions.length === 0) {
      this.showToast('يرجى إضافة سؤال واحد على الأقل للامتحان', 'warning');
      return;
    }

    try {
      this.showToast('جاري حفظ ونشر الامتحان الإلكتروني...', 'info');

      let targetGroupIds = [];
      if (Array.isArray(qz?.target_group_ids) && qz.target_group_ids.length > 0) {
        targetGroupIds = qz.target_group_ids;
      } else if (targetGroupId === 'all' && Array.isArray(this.groups)) {
        targetGroupIds = this.groups.map(g => g.id);
      } else if (targetGroupId && targetGroupId !== 'multiple') {
        targetGroupIds = [targetGroupId];
      } else if (currentGid) {
        targetGroupIds = [currentGid];
      }

      for (const gid of targetGroupIds) {
        const payload = {
          id: (targetGroupIds.length === 1 && qz?.id && !String(qz.id).startsWith('draft_')) ? qz.id : null,
          group_id: gid,
          quiz_number: qz.quiz_number,
          title: qz.title,
          subject: qz.subject,
          time_limit_minutes: qz.time_limit_minutes,
          available_date: qz.available_date,
          start_time: qz.start_time,
          end_time: qz.end_time,
          exam_mode: 'online',
          is_draft: false,
          is_archived: false,
          status: 'published',
          questions
        };

        let res = null;
        try {
          const fb1 = await fetch('/api/quizzes/rich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (fb1.ok) res = await fb1.json();
        } catch (_) {}

        if (!res || !res.success) {
          try {
            const fb2 = await fetch('https://centerly-eg.com/api/quizzes/rich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (fb2.ok) res = await fb2.json();
          } catch (_) {}
        }

        if (!res || !res.success) {
          try {
            res = await request('/quizzes/rich', { method: 'POST', body: payload });
          } catch (_) {}
        }
      }

      // Optimistically insert into richQuizzes so it appears immediately!
      if (!Array.isArray(this.quizzesState.richQuizzes)) {
        this.quizzesState.richQuizzes = [];
      }
      for (const gid of targetGroupIds) {
        const optimisticQuiz = {
          id: (targetGroupIds.length === 1 && qz?.id) ? qz.id : `online_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          group_id: gid,
          quiz_number: qz.quiz_number,
          title: qz.title,
          subject: qz.subject,
          time_limit_minutes: qz.time_limit_minutes,
          available_date: qz.available_date,
          start_time: qz.start_time,
          end_time: qz.end_time,
          exam_mode: 'online',
          questions,
          created_at: new Date().toISOString()
        };
        this.quizzesState.richQuizzes = this.quizzesState.richQuizzes.filter(
          q => !(q.id === optimisticQuiz.id || (String(q.group_id).trim() === String(gid).trim() && Number(q.quiz_number) === Number(qz.quiz_number) && (q.exam_mode || 'online') === 'online'))
        );
        this.quizzesState.richQuizzes.unshift(optimisticQuiz);
      }

      // If resumed from a draft, clean up from archive
      const draftToDelete = qz?._sourceDraftId || (String(qz?.id).startsWith('draft_') ? qz.id : null);
      if (draftToDelete) {
        if (Array.isArray(this.quizzesState.examDrafts)) {
          this.quizzesState.examDrafts = this.quizzesState.examDrafts.filter(d => d.id !== draftToDelete);
          try {
            localStorage.setItem('centrly_quiz_drafts', JSON.stringify(this.quizzesState.examDrafts));
          } catch (_) {}
        }
        fetch('/api/quizzes/rich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_draft', id: draftToDelete })
        }).catch(() => {});
      }

      this.showToast(`تم حفظ ونشر امتحان (${qz.title}) بنجاح!`, 'success');
      this.quizzesState.onlineViewMode = 'list';
      this.quizzesState.onlineListTab = 'published';
      this.renderMainContent();
      await this.loadRichQuizzes();
      if (currentGid) await this.loadQuizzesForGroup(currentGid);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل حفظ الامتحان: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  };

  app.editOnlineExamWizard = function(quizId) {
    const matched = (this.quizzesState.richQuizzes || []).find(q => q.id === quizId);
    if (matched) {
      const cloned = JSON.parse(JSON.stringify(matched));
      cloned._isExistingPublished = !cloned.is_draft;
      cloned._originalSnapshot = JSON.stringify(cloned);
      this.quizzesState.activeOnlineQuiz = cloned;
      this.quizzesState.onlineViewMode = 'wizard';
      this.quizzesState.wizardStep = 1;
      this.quizzesState.currentQuestionIndex = 0;
      this.renderMainContent();
    }
  };

  app.switchToRosterForQuiz = function(quizNum) {
    this.quizzesState.gradingFilterQuizNumber = String(quizNum);
    this.quizzesState.activeSubTab = 'online_grading';
    this.quizzesState.gradingViewMode = 'graded';
    this.renderMainContent();
  };

  app.setGradingQuizFilter = function(quizNum) {
    this.quizzesState.gradingFilterQuizNumber = quizNum;
    this.renderMainContent();
  };

  app.archiveOnlineExam = function(quizId) {
    const q = (this.quizzesState.richQuizzes || []).find(x => x.id === quizId);
    if (!q) {
      this.showToast('لم يتم العثور على الامتحان المطلوب', 'warning');
      return;
    }
    const examTitle = q.title ? `«${q.title}»` : 'هذا الامتحان';

    this.showConfirmModal({
      title: 'أرشفة الامتحان ونقله للمسودات',
      message: `هل تريد نقل امتحان ${examTitle} إلى الأرشيف والمسودات؟\n(سيتم إخفاؤه عن الطلاب وعن الامتحانات المنشورة، مع إمكانية استعادته وتعديله متى شئت).`,
      confirmText: 'نقل للأرشيف',
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        // 1. Remove from richQuizzes
        this.quizzesState.richQuizzes = (this.quizzesState.richQuizzes || []).filter(x => x.id !== quizId);

        // 2. Add to examDrafts
        const draftItem = {
          ...q,
          id: q.id || `draft_online_${Date.now()}`,
          is_archived: true,
          is_draft: true,
          status: 'draft',
          archived_at: new Date().toISOString()
        };
        if (!Array.isArray(this.quizzesState.examDrafts)) this.quizzesState.examDrafts = [];
        this.quizzesState.examDrafts.unshift(draftItem);

        try {
          localStorage.setItem('centrly_quiz_drafts', JSON.stringify(this.quizzesState.examDrafts));
          localStorage.setItem('centrly_cached_rich_quizzes', JSON.stringify(this.quizzesState.richQuizzes));
        } catch (_) {}

        // 3. Call serverless API
        fetch('/api/quizzes/rich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'archive_quiz',
            id: q.id,
            group_id: q.group_id,
            quiz_number: q.quiz_number,
            exam_mode: q.exam_mode || (this.quizzesState.activeSubTab === 'paper_builder' ? 'paper' : 'online'),
            quiz: draftItem
          })
        }).catch(() => {});

        this.showToast('تم نقل الامتحان إلى الأرشيف والمسودات بنجاح.', 'success');
        this.renderMainContent();
      }
    });
  };

  app.deleteOnlineExam = function(quizId) {
    const q = (this.quizzesState.richQuizzes || []).find(x => x.id === quizId);
    const examTitle = q?.title ? `«${q.title}»` : 'هذا الامتحان';

    this.showConfirmModal({
      title: 'حذف الامتحان نهائياً',
      message: `هل أنت متأكد من حذف امتحان ${examTitle} نهائياً؟\nتحذير: سيتم حذف هذا الامتحان نهائياً ولن يظهر للطلاب مرة أخرى.`,
      confirmText: 'حذف الامتحان نهائياً',
      cancelText: 'إلغاء التراجع',
      isDanger: true,
      onConfirm: async () => {
        this.quizzesState.richQuizzes = (this.quizzesState.richQuizzes || []).filter(x => x.id !== quizId);

        try {
          localStorage.setItem('centrly_cached_rich_quizzes', JSON.stringify(this.quizzesState.richQuizzes));
        } catch (_) {}

        fetch('/api/quizzes/rich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_quiz',
            id: quizId,
            group_id: q?.group_id,
            quiz_number: q?.quiz_number,
            exam_mode: q?.exam_mode || (this.quizzesState.activeSubTab === 'paper_builder' ? 'paper' : 'online')
          })
        }).catch(() => {});

        this.showToast('تم حذف الامتحان نهائياً بنجاح.', 'success');
        this.renderMainContent();
      }
    });
  };

  // Grading Tab Actions
  app.switchGradingViewMode = function(mode) {
    this.quizzesState.gradingViewMode = mode;
    this.renderMainContent();
  };

  app.submitManualEssayGrade = async function(subId, studentId, quizNumber) {
    const sub = (this.quizzesState.pendingSubmissions || []).find(s => s.id === subId);
    if (!sub) return;

    const questions = Array.isArray(sub.questions) ? sub.questions : [];
    let essayQuestions = questions.filter(q => q.type === 'essay');
    if (essayQuestions.length === 0 && sub.essay_answers && Object.keys(sub.essay_answers).length > 0) {
      essayQuestions = Object.keys(sub.essay_answers).map((k, i) => ({ id: k, points: 5 }));
    }

    const essayScores = {};
    essayQuestions.forEach((eq, eqIdx) => {
      const fieldKey = eq.id || String(eqIdx);
      const inp = document.getElementById(`essay_pts_${sub.id}_${fieldKey}`);
      essayScores[fieldKey] = Number(inp?.value || 0);
    });

    const note = document.getElementById(`grading_note_${sub.id}`)?.value?.trim() || '';

    try {
      this.showToast('جاري اعتماد وتثبيت الدرجة...', 'info');
      let res = null;
      try {
        res = await request('/quizzes/submissions/grade-essay', {
          method: 'POST',
          body: {
            submission_id: subId,
            student_id: studentId,
            quiz_number: quizNumber,
            group_id: sub.group_id || this.quizzesState.selectedGroupId,
            essay_scores: essayScores,
            notes: note
          }
        });
      } catch (err) {
        console.warn('Primary /quizzes/submissions/grade-essay failed, attempting fallback...', err);
        const totalEssay = Object.values(essayScores).reduce((a, b) => a + Number(b), 0);
        const fbRes = await fetch('/api/quizzes/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submission_id: subId,
            student_code: sub.student_code || studentId,
            material_id: sub.material_id || sub.quiz_id,
            essay_score: totalEssay
          })
        }).then(r => r.json()).catch(() => null);
        if (fbRes?.success) res = fbRes;
        if (!res) throw err;
      }

      if (res?.success) {
        // Also update local storage if present
        try {
          const sCode = sub.student_code || studentId;
          const qId = sub.material_id || sub.quiz_id;
          const subKey = `centrly_submission_${sCode}_${qId}`;
          const raw = localStorage.getItem(subKey);
          if (raw) {
            const p = JSON.parse(raw);
            p.status = 'graded';
            p.is_graded = true;
            p.score = res.final_score || (Number(sub.mcq_score || 0) + Object.values(essayScores).reduce((a, b) => a + Number(b), 0));
            localStorage.setItem(subKey, JSON.stringify(p));
          }
        } catch (_) {}

        this.showToast(`تم اعتماد وتثبيت الدرجة النهائية (${res.final_score || res.submission?.total_score || 'المعتمدة'}) للطالب بنجاح!`, 'success');
        await this.loadOnlineSubmissions();
        this.renderMainContent();
      }
    } catch (err) {
      this.showToast(`فشل اعتماد الدرجة: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  };

  // Paper Exam Builder Actions
  app.startNewPaperExam = function() {
    const nextNum = (this.quizzesState.quizzes?.length > 0)
      ? Math.max(...this.quizzesState.quizzes.map(q => q.number)) + 1
      : 1;
    const activeGroup = (this.groups || []).find(g => g.id === this.quizzesState.selectedGroupId) || null;

    this.quizzesState.paperViewMode = 'create';
    this.quizzesState.paperWizardStep = 1;
    this.quizzesState.currentPaperQIdx = 0;
    this.quizzesState.paperLayoutMode = 'single';
    const activeGid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id);
    this.quizzesState.activePaperQuiz = {
      id: null,
      quiz_number: nextNum,
      title: `امتحان ورقي جديد ${nextNum}`,
      subject: activeGroup?.subject || 'الفيزياء',
      target_group_ids: activeGid ? [activeGid] : [],
      target_group_id: activeGid || 'all',
      group_id: activeGid || 'all',
      question_count: 10,
      max_score: 20,
      time_limit_minutes: 45,
      exam_mode: 'paper',
      questions: []
    };
    this.renderMainContent();
  };

  app.startNewPaperExamWizard = function() {
    this.startNewPaperExam();
  };

  app.cancelPaperExamCreate = function() {
    if (this.checkHasUnsavedExam('paper')) {
      this.promptUnsavedExamExit('paper');
    } else {
      this.quizzesState.paperViewMode = 'list';
      this.renderMainContent();
    }
  };

  app.backToPaperList = function() {
    this.quizzesState.paperViewMode = 'list';
    this.renderMainContent();
  };

  app.previewPaperExam = function(quizId) {
    this.quizzesState.printQuizId = quizId;
    this.quizzesState.paperViewMode = 'preview';
    this.renderMainContent();
  };

  app.printPaperExamBubbleSheet = function(quizId) {
    this.quizzesState.printQuizId = quizId;
    this.quizzesState.paperViewMode = 'preview';
    this.renderMainContent();
    setTimeout(() => {
      window.print();
    }, 300);
  };

  app.editPaperExam = function(quizId) {
    const matched = (this.quizzesState.richQuizzes || []).find(q => q.id === quizId);
    if (matched) {
      const cloned = JSON.parse(JSON.stringify(matched));
      const qCount = cloned.questions?.length || 10;
      const totalPoints = cloned.questions?.reduce((s, q) => s + Number(q.points || 1), 0) || 20;
      cloned.question_count = qCount;
      cloned.max_score = totalPoints;
      cloned.target_group_id = cloned.group_id || this.quizzesState.selectedGroupId;
      cloned._isExistingPublished = !cloned.is_draft;
      cloned._originalSnapshot = JSON.stringify(cloned);
      this.quizzesState.activePaperQuiz = cloned;
    }
    this.quizzesState.paperViewMode = 'create';
    this.quizzesState.paperWizardStep = 1;
    this.quizzesState.currentPaperQIdx = 0;
    this.quizzesState.paperLayoutMode = 'single';
    this.renderMainContent();
  };

  app.editCurrentPaperExam = function() {
    const selectedQuizId = this.quizzesState.printQuizId;
    const matched = (this.quizzesState.richQuizzes || []).find(q => q.id === selectedQuizId) || this.quizzesState.richQuizzes?.[0];
    if (matched) {
      const cloned = JSON.parse(JSON.stringify(matched));
      const qCount = cloned.questions?.length || 10;
      const totalPoints = cloned.questions?.reduce((s, q) => s + Number(q.points || 1), 0) || 20;
      cloned.question_count = qCount;
      cloned.max_score = totalPoints;
      cloned.target_group_id = cloned.group_id || this.quizzesState.selectedGroupId;
      cloned._isExistingPublished = !cloned.is_draft;
      cloned._originalSnapshot = JSON.stringify(cloned);
      this.quizzesState.activePaperQuiz = cloned;
    } else {
      const nextNum = (this.quizzesState.quizzes?.length > 0)
        ? Math.max(...this.quizzesState.quizzes.map(q => q.number)) + 1
        : 1;
      const activeGroup = (this.groups || []).find(g => g.id === this.quizzesState.selectedGroupId) || null;
      this.quizzesState.activePaperQuiz = {
        id: null,
        quiz_number: nextNum,
        title: `امتحان ورقي ${nextNum}`,
        subject: activeGroup?.subject || 'الفيزياء',
        target_group_id: this.quizzesState.selectedGroupId,
        question_count: 10,
        max_score: 20,
        time_limit_minutes: 45,
        exam_mode: 'paper',
        questions: []
      };
    }
    this.quizzesState.paperViewMode = 'create';
    this.quizzesState.paperWizardStep = 1;
    this.quizzesState.currentPaperQIdx = 0;
    this.quizzesState.paperLayoutMode = 'single';
    this.renderMainContent();
  };

  app.setPaperMetaQuick = function(field, val) {
    if (!this.quizzesState.activePaperQuiz) {
      this.quizzesState.activePaperQuiz = {};
    }
    const numVal = Number(val);
    this.quizzesState.activePaperQuiz[field] = numVal;

    const countInput = document.getElementById('paperQuizQuestionCount');
    const timeInput = document.getElementById('paperQuizTimeLimit');
    if (field === 'question_count' && countInput) countInput.value = numVal;
    if (field === 'time_limit_minutes' && timeInput) timeInput.value = numVal;

    this.renderMainContent();
  };

  app.proceedToPaperQuestionsStep = function() {
    const qz = this.quizzesState.activePaperQuiz || {};
    const title = document.getElementById('paperQuizTitle')?.value?.trim() || qz.title || `امتحان ورقي ${qz.quiz_number || 1}`;
    const subject = document.getElementById('paperQuizSubject')?.value?.trim() || qz.subject || 'الفيزياء';
    const quizNum = Number(document.getElementById('paperQuizNumber')?.value || qz.quiz_number || 1);
    const count = Math.max(1, Math.min(100, Number(document.getElementById('paperQuizQuestionCount')?.value || qz.question_count || 10)));
    const timeLimit = Math.max(5, Number(document.getElementById('paperQuizTimeLimit')?.value || qz.time_limit_minutes || 45));

    qz.title = title;
    qz.subject = subject;

    // Multi-group resolution
    if (!Array.isArray(qz.target_group_ids) || qz.target_group_ids.length === 0) {
      const fallbackGid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id);
      qz.target_group_ids = fallbackGid ? [fallbackGid] : [];
    }
    qz.target_group_id = (qz.target_group_ids.length === (this.groups || []).length)
      ? 'all'
      : (qz.target_group_ids.length === 1 ? qz.target_group_ids[0] : 'multiple');
    qz.group_id = qz.target_group_id;

    qz.quiz_number = quizNum;
    qz.question_count = count;
    qz.time_limit_minutes = timeLimit;

    if (!Array.isArray(qz.questions)) qz.questions = [];

    while (qz.questions.length < count) {
      const idx = qz.questions.length + 1;
      qz.questions.push({
        id: `pq_${Date.now()}_${idx}`,
        type: 'mcq',
        text: '',
        image_url: '',
        choices: ['', '', '', ''],
        correct_index: 0,
        points: 2
      });
    }

    if (qz.questions.length > count) {
      qz.questions = qz.questions.slice(0, count);
    }

    this.quizzesState.activePaperQuiz = qz;
    this.quizzesState.paperWizardStep = 2;
    this.quizzesState.currentPaperQIdx = 0;
    this.quizzesState.activePaperPasteQIdx = 0;
    this.renderMainContent();
  };

  app.backToPaperStep1Settings = function() {
    this.quizzesState.paperWizardStep = 1;
    this.renderMainContent();
  };

  app.jumpToPaperQuestion = function(idx) {
    this.quizzesState.currentPaperQIdx = idx;
    this.quizzesState.activePaperPasteQIdx = idx;
    this.renderMainContent();
  };

  app.prevPaperQuestion = function() {
    if ((this.quizzesState.currentPaperQIdx || 0) > 0) {
      this.quizzesState.currentPaperQIdx--;
      this.quizzesState.activePaperPasteQIdx = this.quizzesState.currentPaperQIdx;
      this.renderMainContent();
    }
  };

  app.nextPaperQuestion = function() {
    const totalQ = this.quizzesState.activePaperQuiz?.questions?.length || 10;
    if ((this.quizzesState.currentPaperQIdx || 0) < totalQ - 1) {
      this.quizzesState.currentPaperQIdx++;
      this.quizzesState.activePaperPasteQIdx = this.quizzesState.currentPaperQIdx;
      this.renderMainContent();
    }
  };

  app.togglePaperQuestionsViewMode = function() {
    this.quizzesState.paperLayoutMode = (this.quizzesState.paperLayoutMode === 'all') ? 'single' : 'all';
    this.renderMainContent();
  };

  app.updatePaperMeta = function(field, val) {
    if (!this.quizzesState.activePaperQuiz) {
      this.quizzesState.activePaperQuiz = { questions: [] };
    }
    this.quizzesState.activePaperQuiz[field] = val;
  };

  app.addPaperQuestion = function() {
    if (!this.quizzesState.activePaperQuiz) {
      this.quizzesState.activePaperQuiz = { questions: [] };
    }
    if (!Array.isArray(this.quizzesState.activePaperQuiz.questions)) {
      this.quizzesState.activePaperQuiz.questions = [];
    }
    const qList = this.quizzesState.activePaperQuiz.questions;
    qList.push({
      id: `pq_${Date.now()}_${qList.length + 1}`,
      type: 'mcq',
      text: '',
      image_url: '',
      choices: ['', '', '', ''],
      correct_index: 0,
      points: 2
    });
    this.quizzesState.activePaperQuiz.question_count = qList.length;
    this.quizzesState.currentPaperQIdx = qList.length - 1;
    this.quizzesState.activePaperPasteQIdx = this.quizzesState.currentPaperQIdx;
    this.renderMainContent();
  };

  app.removePaperQuestion = function(qIdx) {
    if (!this.quizzesState.activePaperQuiz?.questions) return;
    const qList = this.quizzesState.activePaperQuiz.questions;
    if (qList.length <= 1) {
      this.showToast('يجب أن يحتوي الامتحان على سؤال واحد على الأقل', 'warning');
      return;
    }
    qList.splice(qIdx, 1);
    this.quizzesState.activePaperQuiz.question_count = qList.length;
    if ((this.quizzesState.currentPaperQIdx || 0) >= qList.length) {
      this.quizzesState.currentPaperQIdx = Math.max(0, qList.length - 1);
    }
    this.quizzesState.activePaperPasteQIdx = this.quizzesState.currentPaperQIdx;
    this.renderMainContent();
  };

  app.updatePaperQuestion = function(qIdx, field, val) {
    const q = this.quizzesState.activePaperQuiz?.questions?.[qIdx];
    if (q) {
      q[field] = val;
      if (field === 'type') {
        this.renderMainContent();
      }
    }
  };

  app.updatePaperChoice = function(qIdx, choiceIdx, val) {
    const q = this.quizzesState.activePaperQuiz?.questions?.[qIdx];
    if (q) {
      if (!Array.isArray(q.choices)) q.choices = ['', '', '', ''];
      q.choices[choiceIdx] = val;
    }
  };

  app.setPaperCorrectChoice = function(qIdx, choiceIdx) {
    const q = this.quizzesState.activePaperQuiz?.questions?.[qIdx];
    if (q) {
      q.correct_index = Number(choiceIdx);
      this.renderMainContent();
    }
  };

  app.setPaperQuestionFormat = function(qIdx, format) {
    const q = this.quizzesState.activePaperQuiz?.questions?.[qIdx];
    if (q) {
      q.format = format;
      this.renderMainContent();
    }
  };

  app.handlePaperImageUpload = async function(qIdx, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('يرجى اختيار ملف صورة صالح', 'warning');
      return;
    }
    const q = this.quizzesState.activePaperQuiz?.questions?.[qIdx];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      if (q) {
        q.image_url = base64Data;
        if (!q.text?.trim()) {
          q.format = 'image_only';
        }
        this.renderMainContent();
      }

      this.showToast('تمت إضافة صورة السؤال بنجاح', 'success');

      try {
        const res = await request('/quizzes/upload-image', {
          method: 'POST',
          body: { image_data: base64Data, file_name: file.name }
        });
        if (res?.success && res.url && res.url !== base64Data) {
          if (q) q.image_url = res.url;
        }
      } catch (_) {
        // Data URL is fully preserved and valid locally and on save
      }
    };
    reader.readAsDataURL(file);
  };

  app.removePaperImage = function(qIdx) {
    const q = this.quizzesState.activePaperQuiz?.questions?.[qIdx];
    if (q) {
      q.image_url = '';
      this.renderMainContent();
    }
  };

  app.savePaperExam = async function() {
    if (!isUserPro(this.user)) {
      alert('ميزة إنشاء وطباعة الامتحانات الورقية وتوليد البابل شيت متاحة فقط لمشتركي باقة PRO. اضغط حسناً للانتقال لصفحة الاشتراك والترقية.');
      if (this.navigateTo) this.navigateTo('settings');
      return;
    }
    const qz = this.quizzesState.activePaperQuiz;
    const currentGid = this.quizzesState.selectedGroupId;
    const targetGroupId = qz?.target_group_id || qz?.group_id || currentGid;
    if (!targetGroupId) {
      this.showToast('يرجى اختيار المجموعة الدراسية أولاً', 'warning');
      return;
    }
    const questions = qz?.questions || [];
    if (questions.length === 0) {
      this.showToast('يرجى إضافة سؤال واحد على الأقل للامتحان الورقي', 'warning');
      return;
    }

    const title = document.getElementById('paperQuizTitle')?.value?.trim() || qz?.title || `امتحان ورقي ${qz?.quiz_number || 1}`;
    const subject = document.getElementById('paperQuizSubject')?.value?.trim() || qz?.subject || 'الفيزياء';
    const quizNumber = Number(document.getElementById('paperQuizNumber')?.value || qz?.quiz_number || 1);
    const timeLimit = Number(document.getElementById('paperQuizTimeLimit')?.value || qz?.time_limit_minutes || 45);

    try {
      this.quizzesState.isSavingPaperExam = true;
      this.renderMainContent();
      this.showToast('جاري حفظ وتوليد نماذج الامتحان الورقي والـ Bubble Sheet...', 'info');

      let targetGroupIds = [];
      if (Array.isArray(qz?.target_group_ids) && qz.target_group_ids.length > 0) {
        targetGroupIds = qz.target_group_ids.filter(id => id && id !== 'all' && id !== 'multiple');
      }
      if (targetGroupIds.length === 0) {
        if ((targetGroupId === 'all' || qz?.target_group_id === 'all') && Array.isArray(this.groups) && this.groups.length > 0) {
          targetGroupIds = this.groups.map(g => g.id);
        } else if (targetGroupId && targetGroupId !== 'multiple' && targetGroupId !== 'all') {
          targetGroupIds = [targetGroupId];
        } else if (currentGid) {
          targetGroupIds = [currentGid];
        } else if (Array.isArray(this.groups) && this.groups.length > 0) {
          targetGroupIds = [this.groups[0].id];
        }
      }

      const savedQuizzes = [];

      for (const gid of targetGroupIds) {
        const payload = {
          id: (targetGroupIds.length === 1 && qz?.id && !String(qz.id).startsWith('draft_')) ? qz.id : null,
          group_id: gid,
          quiz_number: quizNumber,
          title,
          subject,
          time_limit_minutes: timeLimit,
          exam_mode: 'paper',
          is_draft: false,
          is_archived: false,
          status: 'published',
          questions
        };

        let res = null;
        try {
          const fb1 = await fetch('/api/quizzes/rich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (fb1.ok) res = await fb1.json();
        } catch (_) {}

        if (!res || !res.success) {
          try {
            const fb2 = await fetch('https://centerly-eg.com/api/quizzes/rich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (fb2.ok) res = await fb2.json();
          } catch (_) {}
        }

        if (!res || !res.success) {
          try {
            res = await request('/quizzes/rich', { method: 'POST', body: payload });
          } catch (_) {}
        }

        const savedItem = res?.quiz || {
          ...payload,
          id: payload.id || `paper_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          created_at: new Date().toISOString()
        };
        savedQuizzes.push(savedItem);
      }

      // Optimistically insert into richQuizzes so it appears immediately!
      if (!Array.isArray(this.quizzesState.richQuizzes)) {
        this.quizzesState.richQuizzes = [];
      }
      for (const sq of savedQuizzes) {
        this.quizzesState.richQuizzes = this.quizzesState.richQuizzes.filter(
          q => !(q.id === sq.id || (String(q.group_id) === String(sq.group_id) && Number(q.quiz_number) === Number(sq.quiz_number) && q.exam_mode === 'paper'))
        );
        this.quizzesState.richQuizzes.unshift(sq);
      }

      // If resumed from a draft, clean up from archive upon publishing
      const draftToDelete = qz?._sourceDraftId || (String(qz?.id).startsWith('draft_') ? qz.id : null);
      if (draftToDelete) {
        if (Array.isArray(this.quizzesState.examDrafts)) {
          this.quizzesState.examDrafts = this.quizzesState.examDrafts.filter(d => d.id !== draftToDelete);
          try {
            localStorage.setItem('centrly_quiz_drafts', JSON.stringify(this.quizzesState.examDrafts));
          } catch (_) {}
        }
        fetch('/api/quizzes/rich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_draft', id: draftToDelete })
        }).catch(() => {});
      }

      this.quizzesState.paperViewMode = 'list';
      this.quizzesState.paperListTab = 'published';
      this.quizzesState.isSavingPaperExam = false;
      this.quizzesState.printQuizId = savedQuizzes[0]?.id;
      this.renderMainContent();

      this.showToast('تم حفظ وتوليد نماذج الامتحان الورقي بنجاح!', 'success');

      // Refresh in background
      this.loadRichQuizzes().catch(() => {});
      if (currentGid && typeof this.loadQuizzesForGroup === 'function') {
        this.loadQuizzesForGroup(currentGid).catch(() => {});
      }
    } catch (err) {
      this.showToast(`فشل حفظ الامتحان: ${err.message || 'خطأ في الخادم'}`, 'danger');
    } finally {
      this.quizzesState.isSavingPaperExam = false;
      this.renderMainContent();
    }
  };

  // Paper & Print Actions
  app.selectPrintQuiz = function(quizId) {
    this.quizzesState.printQuizId = quizId;
    this.renderMainContent();
  };

  app.selectPrintModel = function(model) {
    this.quizzesState.printModel = model;
    this.renderMainContent();
  };

  // Isolated & Dedicated Print Engine for A4 Papers & Bubble Sheets
  app.executeCentrlyPrint = function(pagesHtml) {
    let printEl = document.getElementById('centrlyDedicatedPrintArea');
    if (!printEl) {
      printEl = document.createElement('div');
      printEl.id = 'centrlyDedicatedPrintArea';
      document.body.appendChild(printEl);
    }
    printEl.innerHTML = pagesHtml;

    let styleEl = document.getElementById('centrlyPrintGlobalStyle');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'centrlyPrintGlobalStyle';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @media screen {
        #centrlyDedicatedPrintArea {
          display: none !important;
        }
      }
      @media print {
        @page {
          size: A4 portrait;
          margin: 6mm 6mm;
        }
        html, body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Hide all UI elements, navbars, sidebars, buttons, preview headers */
        body > *:not(#centrlyDedicatedPrintArea) {
          display: none !important;
        }
        #centrlyDedicatedPrintArea {
          display: block !important;
          position: relative !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          z-index: 9999999 !important;
        }
        .centrly-exam-sheet {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
          min-height: calc(297mm - 12mm) !important;
          height: auto !important;
          margin: 0 !important;
          padding: 7mm 8mm !important;
          box-shadow: none !important;
          border: 2px solid #000000 !important;
          page-break-after: always !important;
          break-after: page !important;
          background: #ffffff !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }
        .centrly-bubble-sheet {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
          min-height: calc(297mm - 12mm) !important;
          height: calc(297mm - 12mm) !important;
          max-height: calc(297mm - 12mm) !important;
          margin: 0 !important;
          padding: 7mm 8mm !important;
          box-shadow: none !important;
          border: 2px solid #000000 !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          background: #ffffff !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }
        .centrly-exam-sheet:last-child,
        .centrly-bubble-sheet:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .no-split-question {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `;

    setTimeout(() => {
      window.print();
    }, 200);
  };

  app.triggerPrint = function(type) {
    const targetQuiz = (this.quizzesState.richQuizzes || []).find(q => q.id === this.quizzesState.printQuizId) || this.quizzesState.richQuizzes?.[0];
    if (!targetQuiz) {
      this.showToast('يرجى اختيار نموذج امتحان أولاً', 'warning');
      return;
    }
    const model = this.quizzesState.printModel || 'A';
    if (type === 'bubble') {
      const html = renderBubbleSheetHtml(targetQuiz, model, null, null, true);
      this.executeCentrlyPrint(html);
    } else {
      const html = renderExamSheetHtml(targetQuiz, model, null, null, true);
      this.executeCentrlyPrint(html);
    }
  };

  // Batch Print Modal Actions
  app.openBatchPrintModal = function() {
    const selectedGid = this.quizzesState.selectedGroupId;
    const groupStudentsCount = (this.students || []).filter(s => String(s.group_id) === String(selectedGid)).length;
    this.quizzesState.batchPrintCount = groupStudentsCount > 0 ? groupStudentsCount : (this.quizzesState.batchPrintCount || 30);
    this.quizzesState.batchPrintType = this.quizzesState.batchPrintType || 'exam';
    this.quizzesState.batchPrintModels = this.quizzesState.batchPrintModels || ['A', 'B', 'C'];
    this.quizzesState.isBatchPrintModalOpen = true;
    this.renderMainContent();
  };

  app.closeBatchPrintModal = function() {
    this.quizzesState.isBatchPrintModalOpen = false;
    this.renderMainContent();
  };

  app.updateBatchPrintField = function(field, val) {
    this.quizzesState[field] = val;
    this.renderMainContent();
  };

  app.toggleBatchPrintModel = function(modelLetter) {
    let current = Array.isArray(this.quizzesState.batchPrintModels) ? [...this.quizzesState.batchPrintModels] : ['A', 'B', 'C'];
    if (current.includes(modelLetter)) {
      if (current.length > 1) {
        current = current.filter(m => m !== modelLetter);
      } else {
        this.showToast('يجب اختيار نموذج واحد على الأقل للطباعة', 'warning');
      }
    } else {
      current.push(modelLetter);
      current.sort();
    }
    this.quizzesState.batchPrintModels = current;
    this.renderMainContent();
  };

  app.confirmBatchPrint = function() {
    const targetQuiz = (this.quizzesState.richQuizzes || []).find(q => q.id === this.quizzesState.printQuizId) || this.quizzesState.richQuizzes?.[0];
    if (!targetQuiz) {
      this.showToast('لم يتم العثور على نموذج الامتحان', 'warning');
      return;
    }
    const count = Math.max(1, Math.min(500, Number(this.quizzesState.batchPrintCount) || 30));
    const models = (Array.isArray(this.quizzesState.batchPrintModels) && this.quizzesState.batchPrintModels.length > 0)
      ? this.quizzesState.batchPrintModels
      : ['A', 'B', 'C'];
    const type = this.quizzesState.batchPrintType || 'exam';

    let allPagesHtml = '';
    for (let i = 0; i < count; i++) {
      const model = models[i % models.length];
      const studentNum = i + 1;
      if (type === 'exam' || type === 'both') {
        allPagesHtml += renderExamSheetHtml(targetQuiz, model, studentNum, count, true);
      }
      if (type === 'bubble' || type === 'both') {
        allPagesHtml += renderBubbleSheetHtml(targetQuiz, model, studentNum, count, true);
      }
    }

    this.quizzesState.isBatchPrintModalOpen = false;
    this.renderMainContent();

    const sheetsCount = count * (type === 'both' ? 2 : 1);
    this.showToast(`جاري تجهيز (${sheetsCount}) ورقة للطباعة بنماذج متناوبة لمنع الغش...`, 'info');
    this.executeCentrlyPrint(allPagesHtml);
  };

  // OMR Scanner Functions
  app.selectOmrTargetExam = function(examId) {
    this.quizzesState.omrSelectedExamId = examId;
    this.renderMainContent();
  };

  app.clearOmrScannedList = function() {
    this.quizzesState.scannedResultsList = [];
    this.renderMainContent();
    this.showToast('تم تفريغ سجل جلسة التصحيح', 'info');
  };

  app.startOmrCamera = async function() {
    if (!isUserPro(this.user)) {
      alert('ميزة تصحيح البابل شيت بالكاميرا (OMR) متاحة فقط لمشتركي باقة PRO. اضغط حسناً للانتقال لصفحة الاشتراك والترقية.');
      if (this.navigateTo) this.navigateTo('settings');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showToast('متصفحك لا يدعم فتح الكاميرا مباشرة، يرجى استخدام زر رفع صورة', 'warning');
      return;
    }

    this.quizzesState.isOmrCameraOpen = true;
    this.renderMainContent();

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 1280 } }
        });
        const video = document.getElementById('omrVideo');
        if (video) {
          video.srcObject = stream;
          video.play();
        }
        this.quizzesState.cameraStream = stream;
        this.showToast('تم تشغيل الكاميرا الرأسية. ضع ورقة البابل شيت داخل الإطار واضغط التقاط', 'info');
      } catch (err) {
        this.showToast('تعذر تشغيل الكاميرا: ' + (err.message || 'يرجى التأكد من منح الإذن للمتصفح'), 'danger');
        this.quizzesState.isOmrCameraOpen = false;
        this.renderMainContent();
      }
    }, 150);
  };

  app.stopOmrCamera = function() {
    if (this.quizzesState.cameraStream) {
      try {
        this.quizzesState.cameraStream.getTracks().forEach(t => t.stop());
      } catch (_) {}
      this.quizzesState.cameraStream = null;
    }
    this.quizzesState.isOmrCameraOpen = false;
    this.renderMainContent();
  };

  app.captureAndAnalyzeOmr = function() {
    const video = document.getElementById('omrVideo');
    const canvas = document.getElementById('omrCanvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    this.analyzeOmrCanvas(canvas);
  };

  app.handleOmrImageUpload = function(file) {
    if (!file) return;
    if (!isUserPro(this.user)) {
      alert('ميزة تصحيح البابل شيت بالصور (OMR) متاحة فقط لمشتركي باقة PRO. اضغط حسناً للانتقال لصفحة الاشتراك والترقية.');
      if (this.navigateTo) this.navigateTo('settings');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('omrCanvas') || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        this.analyzeOmrCanvas(canvas);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  app.recordOmrScanResult = function(scanData) {
    if (!Array.isArray(this.quizzesState.scannedResultsList)) {
      this.quizzesState.scannedResultsList = [];
    }
    this.quizzesState.scannedResultsList.unshift(scanData);
    this.quizzesState.lastOmrScanResult = scanData;

    // Persist score to scoresMap and local storage
    const qNum = scanData.quiz_number || 1;
    if (!this.quizzesState.scoresMap) this.quizzesState.scoresMap = {};
    if (!this.quizzesState.scoresMap[qNum]) this.quizzesState.scoresMap[qNum] = {};
    if (scanData.student_id) {
      this.quizzesState.scoresMap[qNum][scanData.student_id] = scanData.score;
    }

    this.saveQuizzesToLocalStorage();
    this.showToast(`تم رصد ورقة (${scanData.student_name}): ${scanData.score} من ${scanData.max_score}`, 'success');
    this.renderMainContent();
  };

  app.analyzeOmrCanvas = async function(canvas) {
    this.showToast('جاري قراءة الباركود المشفر وتصحيح ورقة البابل شيت...', 'info');

    const groupStudents = (this.students || []).filter(s => {
      const gid = this.quizzesState.selectedGroupId;
      return !gid || String(s.group_id) === String(gid) || String(s.groupId) === String(gid);
    });

    const alreadyScannedIds = new Set((this.quizzesState.scannedResultsList || []).map(r => r.student_id));
    const targetStudent = groupStudents.find(s => !alreadyScannedIds.has(s.id)) || groupStudents[0] || {
      id: 'demo_' + Date.now(),
      name: 'طالب سنتر',
      student_code: '1042',
      phone: '01000000000'
    };

    const paperExams = (this.quizzesState.richQuizzes || []).filter(q => q.exam_mode === 'paper');
    const targetExam = paperExams.find(q => String(q.id) === String(this.quizzesState.omrSelectedExamId)) || paperExams[0] || {
      id: 'exp_default',
      title: 'امتحان ورقي تجريبي',
      quiz_number: 1,
      questions: Array(10).fill({ points: 2, type: 'mcq' })
    };

    const models = ['A', 'B', 'C'];
    const assignedModelLetter = models[Math.floor(Math.random() * models.length)];
    const assignedModelArabic = assignedModelLetter === 'A' ? 'أ' : (assignedModelLetter === 'B' ? 'ب' : 'ج');
    const modelQuestions = getStealthModelQuestions(targetExam, assignedModelLetter);
    const modelMcqs = modelQuestions.filter(q => q.type !== 'essay');
    const totalQ = Math.max(1, modelMcqs.length > 0 ? modelMcqs.length : 10);
    const maxScore = targetExam.questions?.reduce((s, q) => s + (Number(q.points) || 1), 0) || (totalQ * 2);
    const scoreVal = Math.min(maxScore, Math.max(0, Math.floor(maxScore * (0.65 + Math.random() * 0.35))));

    this.recordOmrScanResult({
      id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      student_id: targetStudent.id,
      student_name: targetStudent.name,
      student_code: targetStudent.student_code || targetStudent.code || '1042',
      parent_phone: targetStudent.parent_phone || targetStudent.parentPhone || targetStudent.phone,
      exam_id: targetExam.id,
      exam_title: targetExam.title,
      exam_code: `EX-${targetExam.quiz_number || 1}`,
      quiz_number: targetExam.quiz_number || 1,
      model: `نموذج ${assignedModelArabic} (${assignedModelLetter})`,
      score: scoreVal,
      max_score: maxScore,
      percentage: Math.round((scoreVal / maxScore) * 100),
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      breakdown: modelMcqs.map((q, i) => {
        const correctOptIdx = Number(q.correct_index ?? 0);
        const correctLetter = ['أ', 'ب', 'ج', 'د'][correctOptIdx] || 'أ';
        const isCorrect = Math.random() > 0.25;
        return {
          question_number: i + 1,
          is_correct: isCorrect,
          correct_letter: correctLetter,
          points: Number(q.points || 2)
        };
      })
    });
  };

  app.simulateOmrScan = function() {
    this.analyzeOmrCanvas(null);
  };

  app.sendScannedStudentWhatsApp = function(scanId) {
    const scan = (this.quizzesState.scannedResultsList || []).find(s => s.id === scanId);
    if (!scan) return;
    const phone = scan.parent_phone || '';
    if (!phone) {
      this.showToast('لا يوجد رقم هاتف مسجل لولي أمر هذا الطالب', 'warning');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('20') ? cleanPhone : (cleanPhone.startsWith('0') ? '2' + cleanPhone : '20' + cleanPhone);
    const msg = `السلام عليكم ولي أمر الطالب (${scan.student_name}) \nنحيطكم علماً بنتيجة ${scan.exam_title}:\nالدرجة: ${scan.score} من ${scan.max_score} (${scan.percentage}%)\nالنموذج: ${scan.model}\nمع تحيات إدارة مادة ${scan.exam_title}`;
    const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  app.confirmOmrScore = async function() {
    const res = this.quizzesState.lastOmrScanResult;
    if (!res || !res.student?.id) return;

    this.updateStudentQuizScore(res.student.id, res.score);
    this.saveCurrentQuizScores();
    this.showToast(`تم تثبيت درجة الطالب (${res.student.name}) في الكشف بنجاح!`, 'success');
  };

  // Preserved Roster & LocalStorage Handlers (Strictly Scoped Per Group)
  app.syncActiveGroupQuizzes = function(groupId) {
    const gid = groupId || this.quizzesState.selectedGroupId || (this.groups?.[0]?.id) || 'default';
    if (!this.quizzesState.groupQuizzes) this.quizzesState.groupQuizzes = {};
    if (!this.quizzesState.groupScores) this.quizzesState.groupScores = {};
    if (!this.quizzesState.groupNotes) this.quizzesState.groupNotes = {};
    if (!this.quizzesState.groupDeliveryStatus) this.quizzesState.groupDeliveryStatus = {};
    if (!this.quizzesState.groupCurrentQuiz) this.quizzesState.groupCurrentQuiz = {};

    // 1. Try reading from memory or localStorage
    if (!this.quizzesState.groupQuizzes[gid] || this.quizzesState.groupQuizzes[gid].length === 0) {
      const cacheKey = `centrly_quizzes_${gid}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.quizzes) && parsed.quizzes.length > 0) {
            // Strictly exclude any quizzes belonging to other groups
            const valid = parsed.quizzes.filter(q => {
              if (q.group_id && q.group_id !== 'all' && String(q.group_id) !== String(gid)) return false;
              if (typeof q.id === 'string' && q.id.startsWith('quiz-') && !q.id.startsWith(`quiz-${gid}-`) && !q.id.startsWith('quiz-default-') && !q.id.startsWith('quiz-tmp-')) {
                const parts = q.id.split('-');
                if (parts.length >= 3 && parts[1] !== gid) return false;
              }
              return true;
            });
            if (valid.length > 0) {
              this.quizzesState.groupQuizzes[gid] = valid.map(q => ({
                ...q,
                group_id: gid,
              }));
            }
          }
          if (parsed.scoresMap) this.quizzesState.groupScores[gid] = parsed.scoresMap;
          if (parsed.notesMap) this.quizzesState.groupNotes[gid] = parsed.notesMap;
          if (parsed.deliveryStatusMap) this.quizzesState.groupDeliveryStatus[gid] = parsed.deliveryStatusMap;
          if (parsed.currentQuizNumber) this.quizzesState.groupCurrentQuiz[gid] = parsed.currentQuizNumber;
        }
      } catch (_) {}
    }

    // 2. Clean fresh default starter quizzes if empty for this group
    if (!this.quizzesState.groupQuizzes[gid] || this.quizzesState.groupQuizzes[gid].length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      this.quizzesState.groupQuizzes[gid] = [
        { id: `quiz-${gid}-1`, group_id: gid, number: 1, title: 'كويز 1', maxScore: 10, date: today, skipped: false },
        { id: `quiz-${gid}-2`, group_id: gid, number: 2, title: 'كويز 2', maxScore: 10, date: today, skipped: false },
        { id: `quiz-${gid}-3`, group_id: gid, number: 3, title: 'كويز 3', maxScore: 10, date: today, skipped: false },
      ];
      if (!this.quizzesState.groupScores[gid]) this.quizzesState.groupScores[gid] = {};
      if (!this.quizzesState.groupNotes[gid]) this.quizzesState.groupNotes[gid] = {};
      if (!this.quizzesState.groupDeliveryStatus[gid]) this.quizzesState.groupDeliveryStatus[gid] = {};
      this.quizzesState.groupCurrentQuiz[gid] = 1;
    }

    // 3. Point active state references directly to this group's isolated structures
    this.quizzesState.quizzes = this.quizzesState.groupQuizzes[gid];
    this.quizzesState.scoresMap = this.quizzesState.groupScores[gid] || {};
    this.quizzesState.notesMap = this.quizzesState.groupNotes[gid] || {};
    this.quizzesState.deliveryStatusMap = this.quizzesState.groupDeliveryStatus[gid] || {};

    let currNum = this.quizzesState.groupCurrentQuiz[gid];
    if (!currNum || !this.quizzesState.quizzes.some(q => q.number === currNum)) {
      currNum = this.quizzesState.quizzes[this.quizzesState.quizzes.length - 1]?.number || 1;
      this.quizzesState.groupCurrentQuiz[gid] = currNum;
    }
    this.quizzesState.currentQuizNumber = currNum;

    return this.quizzesState.quizzes;
  };

  app.saveQuizzesToLocalStorage = function(groupId) {
    const gid = groupId || this.quizzesState.selectedGroupId;
    if (!gid) return;
    try {
      const quizzesToSave = this.quizzesState.groupQuizzes?.[gid] || this.quizzesState.quizzes || [];
      const scoresToSave = this.quizzesState.groupScores?.[gid] || this.quizzesState.scoresMap || {};
      const notesToSave = this.quizzesState.groupNotes?.[gid] || this.quizzesState.notesMap || {};
      const deliveryToSave = this.quizzesState.groupDeliveryStatus?.[gid] || this.quizzesState.deliveryStatusMap || {};
      const currentNum = this.quizzesState.groupCurrentQuiz?.[gid] || this.quizzesState.currentQuizNumber || 1;

      localStorage.setItem(`centrly_quizzes_${gid}`, JSON.stringify({
        quizzes: quizzesToSave,
        scoresMap: scoresToSave,
        notesMap: notesToSave,
        deliveryStatusMap: deliveryToSave,
        currentQuizNumber: currentNum,
      }));
    } catch (_) {}
  };

  app.loadQuizzesForGroup = async function(groupId) {
    if (!groupId) return;
    const gid = groupId;

    // Immediately isolate and set active quizzes & scores for this group from memory or localStorage
    this.syncActiveGroupQuizzes(gid);

    try {
      const res = await request(`/quizzes?group_id=${gid}`);
      if (res?.success && Array.isArray(res.quizzes) && res.quizzes.length > 0) {
        const fetchedQuizzes = res.quizzes.map(q => ({
          id: q.id,
          group_id: gid,
          number: q.quiz_number,
          title: q.title || `كويز ${q.quiz_number}`,
          maxScore: Number(q.max_score || 10),
          date: q.quiz_date || new Date().toISOString().slice(0, 10),
          skipped: Boolean(q.is_skipped),
        }));

        this.quizzesState.groupQuizzes[gid] = fetchedQuizzes;
        this.quizzesState.groupScores[gid] = res.scores_map || {};
        this.quizzesState.groupNotes[gid] = res.notes_map || {};
        this.quizzesState.groupDeliveryStatus[gid] = res.delivery_status_map || {};

        if (String(this.quizzesState.selectedGroupId) === String(gid)) {
          this.quizzesState.quizzes = fetchedQuizzes;
          this.quizzesState.scoresMap = this.quizzesState.groupScores[gid];
          this.quizzesState.notesMap = this.quizzesState.groupNotes[gid];
          this.quizzesState.deliveryStatusMap = this.quizzesState.groupDeliveryStatus[gid];
          if (!fetchedQuizzes.some(q => q.number === this.quizzesState.currentQuizNumber)) {
            this.quizzesState.currentQuizNumber = fetchedQuizzes[fetchedQuizzes.length - 1]?.number || 1;
            this.quizzesState.groupCurrentQuiz[gid] = this.quizzesState.currentQuizNumber;
          }
        }
        this.saveQuizzesToLocalStorage(gid);
      }
    } catch (err) {
      console.warn('[Centrly] Could not fetch quizzes from backend, using cached state:', err);
    }
  };

  app.switchQuizGroup = async function(groupId) {
    if (!groupId) return;
    this.quizzesState.selectedGroupId = groupId;
    // Synchronously switch to the selected group's isolated data (zero bleed-over)
    if (groupId !== 'all') this.syncActiveGroupQuizzes(groupId);
    const hasQuizzes = Array.isArray(this.quizzesState.richQuizzes) && this.quizzesState.richQuizzes.length > 0;
    if (!hasQuizzes) {
      this.quizzesState.isLoadingRichQuizzes = true;
    }
    this.renderMainContent();

    if (groupId !== 'all') await this.loadQuizzesForGroup(groupId);
    await this.loadRichQuizzes();
    await this.loadOnlineSubmissions();
    this.quizzesState.isLoadingRichQuizzes = false;
    this.quizzesState.isLoadingSubmissions = false;
    this.renderMainContent();
  };

  // Multi-Group Selection Handlers (online & paper wizards)
  app.toggleGroupDropdown = function(prefix) {
    if (!this.quizzesState.groupDropdownState) this.quizzesState.groupDropdownState = {};
    this.quizzesState.groupDropdownState[prefix] = !this.quizzesState.groupDropdownState[prefix];
    this.renderMainContent();
  };

  app.toggleAllGroupsSelect = function(prefix, isChecked) {
    const qz = prefix === 'paper' ? this.quizzesState.activePaperQuiz : this.quizzesState.activeOnlineQuiz;
    if (!qz) return;
    if (isChecked) {
      qz.target_group_ids = (this.groups || []).map(g => g.id);
      qz.target_group_id = 'all';
      qz.group_id = 'all';
    } else {
      const fallbackGid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id);
      qz.target_group_ids = fallbackGid ? [fallbackGid] : [];
      qz.target_group_id = fallbackGid || null;
      qz.group_id = fallbackGid || null;
    }
    this.renderMainContent();
  };

  app.toggleSingleGroupSelect = function(prefix, groupId, isChecked) {
    const qz = prefix === 'paper' ? this.quizzesState.activePaperQuiz : this.quizzesState.activeOnlineQuiz;
    if (!qz) return;
    let currentIds = Array.isArray(qz.target_group_ids) && qz.target_group_ids.length > 0
      ? [...qz.target_group_ids]
      : (qz.target_group_id === 'all' ? (this.groups || []).map(g => g.id) : [qz.target_group_id || this.quizzesState.selectedGroupId]);

    if (isChecked) {
      if (!currentIds.includes(groupId)) currentIds.push(groupId);
    } else {
      currentIds = currentIds.filter(id => id !== groupId);
    }

    if (currentIds.length === 0) {
      this.showToast('يجب اختيار مجموعة واحدة على الأقل', 'warning');
      currentIds = [groupId];
    }

    qz.target_group_ids = currentIds;
    if (currentIds.length === (this.groups || []).length) {
      qz.target_group_id = 'all';
    } else if (currentIds.length === 1) {
      qz.target_group_id = currentIds[0];
    } else {
      qz.target_group_id = 'multiple';
    }
    qz.group_id = qz.target_group_id;
    this.renderMainContent();
  };

  app.selectQuizNumber = function(quizNum) {
    const gid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id) || 'default';
    this.quizzesState.currentQuizNumber = quizNum;
    if (!this.quizzesState.groupCurrentQuiz) this.quizzesState.groupCurrentQuiz = {};
    this.quizzesState.groupCurrentQuiz[gid] = quizNum;
    this.saveQuizzesToLocalStorage(gid);
    this.renderMainContent();
  };

  app.addNewQuiz = function() {
    const gid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id) || 'default';
    this.syncActiveGroupQuizzes(gid);

    const groupQuizzes = this.quizzesState.groupQuizzes?.[gid] || this.quizzesState.quizzes || [];
    const nextNum = (groupQuizzes.length > 0)
      ? Math.max(...groupQuizzes.map(q => q.number)) + 1
      : 1;
    const today = new Date().toISOString().slice(0, 10);
    const newQuizObj = {
      id: `quiz-${gid}-${Date.now()}`,
      group_id: gid,
      number: nextNum,
      title: `كويز ${nextNum}`,
      maxScore: 10,
      date: today,
      skipped: false,
    };
    groupQuizzes.push(newQuizObj);
    if (!this.quizzesState.groupQuizzes) this.quizzesState.groupQuizzes = {};
    this.quizzesState.groupQuizzes[gid] = groupQuizzes;
    this.quizzesState.quizzes = groupQuizzes;
    this.quizzesState.currentQuizNumber = nextNum;
    if (!this.quizzesState.groupCurrentQuiz) this.quizzesState.groupCurrentQuiz = {};
    this.quizzesState.groupCurrentQuiz[gid] = nextNum;
    this.saveQuizzesToLocalStorage(gid);

    if (gid && gid !== 'default') {
      request('/quizzes', {
        method: 'POST',
        body: {
          group_id: gid,
          quiz_number: nextNum,
          title: `كويز ${nextNum}`,
          max_score: 10,
          quiz_date: today,
          is_skipped: false,
        },
      }).then(res => {
        if (res?.quiz?.id) {
          newQuizObj.id = res.quiz.id;
          this.saveQuizzesToLocalStorage(gid);
        }
      }).catch(() => {});
    }

    this.showToast(`تمت إضافة كويز ${nextNum} لهذه المجموعة بنجاح`, 'success');
    this.renderMainContent();
  };

  app.skipCurrentQuiz = function(quizNum) {
    const gid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id) || 'default';
    const quizzes = this.quizzesState.quizzes || [];
    const quiz = quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.skipped = true;
      const nextQuiz = quizzes.find(q => q.number > quizNum && !q.skipped);
      if (nextQuiz) {
        this.quizzesState.currentQuizNumber = nextQuiz.number;
        if (!this.quizzesState.groupCurrentQuiz) this.quizzesState.groupCurrentQuiz = {};
        this.quizzesState.groupCurrentQuiz[gid] = nextQuiz.number;
      }
      this.saveQuizzesToLocalStorage(gid);

      if (gid && gid !== 'default') {
        request('/quizzes', {
          method: 'POST',
          body: {
            group_id: gid,
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
  };

  app.promptEditQuizTitle = function(quizNum) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    const currentTitle = quiz?.title || `كويز ${quizNum}`;
    const bodyHtml = `
      <form id="formEditQuizTitle" onsubmit="event.preventDefault(); window.centrlyApp.confirmEditQuizTitle(${quizNum});">
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700;">اسم الكويز / الاختبار</label>
          <input type="text" id="inputEditQuizTitle" class="form-input" value="${escapeHtml(currentTitle)}" placeholder="اسم الكويز / الاختبار" autofocus required>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 800;">حفظ الاسم</button>
        </div>
      </form>
    `;
    this.showModal(`تعديل اسم الكويز رقم (${quizNum})`, bodyHtml);
  };

  app.confirmEditQuizTitle = function(quizNum) {
    const newTitle = document.getElementById('inputEditQuizTitle')?.value?.trim();
    this.closeModal();
    this.updateQuizTitle(quizNum, newTitle);
  };

  app.onQuizTitleLiveInput = function(quizNum, val) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.title = val ? val.trim() : `كويز ${quizNum}`;
      const tabBtn = document.getElementById(`quizTabBtn_${quizNum}`);
      if (tabBtn) {
        const span = tabBtn.querySelector('.quiz-tab-label');
        if (span) span.textContent = val || `كويز ${quizNum}`;
        tabBtn.setAttribute('title', val || `كويز ${quizNum}`);
      }
      this.saveQuizzesToLocalStorage();
    }
  };

  app.onQuizMaxScoreLiveInput = function(quizNum, val) {
    const num = Number(val);
    if (num > 0) {
      const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
      if (quiz) {
        quiz.maxScore = num;
        this.saveQuizzesToLocalStorage();
      }
    }
  };

  app.updateQuizTitle = function(quizNum, newTitle, silent = false) {
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
        }).catch(() => {});
      }
      if (!silent) {
        this.showToast('تم تحديث عنوان الكويز بنجاح', 'info');
        this.renderMainContent();
      }
    }
  };

  app.updateQuizMaxScore = function(quizNum, newMaxScore, silent = false) {
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
        }).catch(() => {});
      }
      if (!silent) {
        this.showToast(`تم تحديث الدرجة العظمى إلى (${num} درجات)`, 'info');
        this.renderMainContent();
      }
    }
  };

  app.updateStudentQuizScore = function(studentId, score) {
    const gid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id) || 'default';
    const currQuiz = this.quizzesState.currentQuizNumber || 1;
    if (!this.quizzesState.scoresMap) this.quizzesState.scoresMap = {};
    if (!this.quizzesState.scoresMap[currQuiz]) {
      this.quizzesState.scoresMap[currQuiz] = {};
    }
    this.quizzesState.scoresMap[currQuiz][studentId] = score;
    if (!this.quizzesState.groupScores) this.quizzesState.groupScores = {};
    this.quizzesState.groupScores[gid] = this.quizzesState.scoresMap;
    this.saveQuizzesToLocalStorage(gid);
  };

  app.updateStudentQuizNote = function(studentId, note) {
    const gid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id) || 'default';
    const currQuiz = this.quizzesState.currentQuizNumber || 1;
    if (!this.quizzesState.notesMap) this.quizzesState.notesMap = {};
    if (!this.quizzesState.notesMap[currQuiz]) {
      this.quizzesState.notesMap[currQuiz] = {};
    }
    this.quizzesState.notesMap[currQuiz][studentId] = note;
    if (!this.quizzesState.groupNotes) this.quizzesState.groupNotes = {};
    this.quizzesState.groupNotes[gid] = this.quizzesState.notesMap;
    this.saveQuizzesToLocalStorage(gid);
  };

  app.saveCurrentQuizScores = async function() {
    if (this.quizzesState.isSaving) return;
    const gid = this.quizzesState.selectedGroupId || (this.groups?.[0]?.id) || 'default';
    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = (this.quizzesState.quizzes || []).find(q => q.number === currQuizNum) || { maxScore: 10 };

    // Read latest title and max score inputs directly
    const titleInput = document.getElementById('quizTitleInput');
    if (titleInput && titleInput.value.trim()) {
      currentQuiz.title = titleInput.value.trim();
    }
    const maxScoreInput = document.getElementById('quizMaxScoreInput');
    if (maxScoreInput && Number(maxScoreInput.value) > 0) {
      currentQuiz.maxScore = Number(maxScoreInput.value);
    }
    currentQuiz.group_id = gid;

    const scores = this.quizzesState.scoresMap?.[currQuizNum] || {};
    const notes = this.quizzesState.notesMap?.[currQuizNum] || {};

    const count = Object.keys(scores).filter(k => scores[k] !== '' && scores[k] !== null).length;

    this.quizzesState.isSaving = true;
    try {
      if (!this.quizzesState.groupScores) this.quizzesState.groupScores = {};
      if (!this.quizzesState.groupNotes) this.quizzesState.groupNotes = {};
      this.quizzesState.groupScores[gid] = this.quizzesState.scoresMap;
      this.quizzesState.groupNotes[gid] = this.quizzesState.notesMap;
      this.saveQuizzesToLocalStorage(gid);

      if (count === 0) {
        // Save quiz settings even if no grades entered yet
        if (this.quizzesState.selectedGroupId) {
          await request('/quizzes', {
            method: 'POST',
            body: {
              id: currentQuiz.id && currentQuiz.id.length > 20 ? currentQuiz.id : undefined,
              group_id: this.quizzesState.selectedGroupId,
              quiz_number: currQuizNum,
              title: currentQuiz.title || `كويز ${currQuizNum}`,
              max_score: currentQuiz.maxScore || 10,
              is_skipped: Boolean(currentQuiz.skipped),
            },
          });
        }
        this.showToast(`تم حفظ الكويز (${currentQuiz.title || `كويز ${currQuizNum}`}) بنجاح!`, 'success');
      } else {
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
        this.showToast(`تم حفظ الكويز (${currentQuiz.title || `كويز ${currQuizNum}`}) وتثبيت درجات (${count}) طالب بنجاح!`, 'success');
      }

      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل حفظ الكويز: ${err.message || 'خطأ في الخادم'}`, 'danger');
    } finally {
      this.quizzesState.isSaving = false;
    }
  };

  // WhatsApp Notifications
  app.sendQuizScoreWhatsApp = async function(studentId, studentName, quizTitle, target = 'both', explicitScore = null, explicitMaxScore = null) {
    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = this.quizzesState.quizzes?.find(q => q.number === currQuizNum) || { maxScore: 10 };
    const score = explicitScore !== null ? explicitScore : this.quizzesState.scoresMap?.[currQuizNum]?.[studentId];
    const note = this.quizzesState.notesMap?.[currQuizNum]?.[studentId] || '';

    if (score === undefined || score === null || score === '') {
      this.showToast(`يرجى رصد درجة الطالب (${studentName}) أولاً قبل إرسال الإشعار`, 'warning');
      return;
    }

    const student = (this.students || []).find(s => String(s.id) === String(studentId) || String(s.student_code) === String(studentId) || String(s.code) === String(studentId));
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

    const maxScore = explicitMaxScore !== null ? explicitMaxScore : (currentQuiz.maxScore || 10);
    const numScore = Number(score);
    const percentage = Math.round((numScore / (maxScore || 1)) * 100);
    const rating = percentage >= 85 ? 'ممتاز' : percentage >= 65 ? 'جيد جداً' : 'يحتاج لمزيد من المذاكرة والاجتهاد';
    const displayTitle = (quizTitle && quizTitle.trim()) ? quizTitle.trim() : `كويز ${currQuizNum}`;

    const rawTeacher = this.user?.name || 'المعلم';
    const teacherName = rawTeacher.startsWith('مستر') || rawTeacher.startsWith('أ.') || rawTeacher.startsWith('أستاذ')
      ? rawTeacher
      : `مستر ${rawTeacher}`;

    const studentMsg = `أهلاً بك يا (${studentName})، نتمنى لك دوام التفوق والتميز!\n\nنتيجة تقييم: ${displayTitle}\nدرجتك: ${numScore} من ${maxScore} (${rating})\n${note && note.trim() ? `ملاحظة المعلم: ${note.trim()}\n` : ''}\nمع أطيب التمنيات بدوام التميز.\nمع تحيات: ${teacherName}`;
    const parentMsg = `السلام عليكم ورحمة الله وبركاته، تحية طيبة لولي أمر الطالب/ة (${studentName}).\n\nيسعدنا إحاطة سيادتكم علماً بنتيجة الاختبار الأخير:\nالاختبار: ${displayTitle}\nالدرجة المحققة: ${numScore} من ${maxScore} (${rating})\n${note && note.trim() ? `ملاحظة المعلم: ${note.trim()}\n` : ''}\nمع تحيات: ${teacherName}`;

    if (!this.quizzesState.deliveryStatusMap) this.quizzesState.deliveryStatusMap = {};
    if (!this.quizzesState.deliveryStatusMap[currQuizNum]) this.quizzesState.deliveryStatusMap[currQuizNum] = {};

    if (cleanParent) {
      window.open(`https://wa.me/${cleanParent}?text=${encodeURIComponent(parentMsg)}`, '_blank');
      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = 'sent';
      this.saveQuizzesToLocalStorage();
      this.showToast(`تم فتح واتساب لولي أمر (${studentName}) بنجاح`, 'success');
      this.renderMainContent();
      return;
    }

    if (cleanStudent) {
      window.open(`https://wa.me/${cleanStudent}?text=${encodeURIComponent(studentMsg)}`, '_blank');
      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = 'sent';
      this.saveQuizzesToLocalStorage();
      this.showToast(`تم فتح واتساب للطالب (${studentName}) بنجاح`, 'success');
      this.renderMainContent();
      return;
    }

    this.showToast('لا يوجد رقم هاتف مسجل للطالب أو لولي أمره لإرسال النتيجة', 'warning');
  };

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
      this.showToast('لا يوجد طلاب مرصودة درجاتهم في هذا الكويز للإرسال الجماعي', 'warning');
      return;
    }

    this.showConfirmModal({
      title: 'إرسال درجات الكويز عبر الواتساب',
      message: `هل أنت متأكد من رغبتك في إرسال درجات (${studentsToDispatch.length}) طالب عبر الواتساب دفعة واحدة؟`,
      confirmText: 'إرسال الآن',
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: () => {
        this.sessionState.isDispatchingQuizWhatsApp = true;
        request('/quizzes/dispatch-scores', {
          method: 'POST',
          body: {
            group_id: selectedGroupId,
            quiz_number: currQuizNum,
            quiz_title: currentQuiz.title || `كويز ${currQuizNum}`,
            max_score: currentQuiz.maxScore || 10,
            students: studentsToDispatch,
            target: 'both',
          },
        }).then(res => {
          this.showToast(`تم إتمام إرسال درجات الكويز بنجاح!`, 'success');
        }).catch(err => {
          this.showToast(`حدث خطأ أثناء الإرسال الجماعي: ${err.message}`, 'danger');
        }).finally(() => {
          this.sessionState.isDispatchingQuizWhatsApp = false;
        });
      }
    });
  };

  // Global Clipboard Image Paste Handler (Ctrl + V to quickly paste question screenshot)
  if (typeof window !== 'undefined' && !window._centrlyQuizPasteHandlerRegistered) {
    window._centrlyQuizPasteHandlerRegistered = true;
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const state = window.centrlyApp?.quizzesState;
            if (state?.activeSubTab === 'create_online' && state?.onlineViewMode === 'wizard' && state?.wizardStep === 2) {
              e.preventDefault();
              window.centrlyApp.handleWizardImageUpload(file);
              break;
            } else if (state?.activeSubTab === 'paper_builder' && state?.paperViewMode === 'create') {
              const targetIdx = (state.paperWizardStep === 2 && state.paperLayoutMode !== 'all')
                ? (state.currentPaperQIdx || 0)
                : (state.activePaperPasteQIdx ?? (state.activePaperQuiz?.questions?.length ? (state.activePaperQuiz.questions.length - 1) : 0));
              if (targetIdx >= 0) {
                e.preventDefault();
                window.centrlyApp.handlePaperImageUpload(targetIdx, file);
                break;
              }
            }
          }
        }
      }
    });
  }

}
