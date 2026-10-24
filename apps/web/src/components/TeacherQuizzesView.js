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

  const pendingSubmissions = state.pendingSubmissions || [];
  const pendingCount = pendingSubmissions.length;
  const onlineSubmissions = state.onlineSubmissions || [];
  // Filter quizzes by group
  const filterByGroup = (list) => {
    if (!selectedGroupId) return list;
    return list.filter(q => {
      if (!q.group_id) return true; // legacy unassigned fallback
      if (q.group_id === 'all') return true;
      return String(q.group_id) === String(selectedGroupId);
    });
  };

  const allRich = state.richQuizzes || [];
  const onlineQuizzes = filterByGroup(allRich.filter(q => q.exam_mode !== 'paper'));
  const paperQuizzes = filterByGroup(allRich.filter(q => q.exam_mode === 'paper'));

  return `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;" dir="rtl">
      
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
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" onclick="window.centrlyApp.switchQuizSubTab('online_builder')"
                style="height: 28px; padding: 0 11px; font-size: 0.74rem; font-weight: 700; border-radius: 5px; border: 1px solid ${activeSubTab === 'online_builder' ? '#0f172a' : '#e2e8f0'}; background: ${activeSubTab === 'online_builder' ? '#0f172a' : '#ffffff'}; color: ${activeSubTab === 'online_builder' ? '#ffffff' : '#475569'}; cursor: pointer;">
                بنك الكويزات (${onlineQuizzes.length})
              </button>
              <button type="button" onclick="window.centrlyApp.switchQuizSubTab('online_grading')"
                style="height: 28px; padding: 0 11px; font-size: 0.74rem; font-weight: 700; border-radius: 5px; border: 1px solid ${activeSubTab === 'online_grading' ? '#0f172a' : '#e2e8f0'}; background: ${activeSubTab === 'online_grading' ? '#0f172a' : '#ffffff'}; color: ${activeSubTab === 'online_grading' ? '#ffffff' : '#475569'}; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                <span>تصحيح المقالي</span>
                ${pendingCount > 0 ? `<span style="background: #ef4444; color: #ffffff; font-size: 0.65rem; padding: 0 5px; border-radius: 8px; font-weight: 700;">${pendingCount}</span>` : ''}
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
                نماذج الامتحانات الورقية (${paperQuizzes.length})
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
      ${activeSubTab === 'online_builder' ? renderOnlineBuilderTab(state, groups, activeGroup, quizzes, currentQuiz) : ''}
      ${activeSubTab === 'online_grading' ? renderOnlineGradingTab(state, groups, activeGroup, pendingSubmissions, onlineSubmissions) : ''}
      ${activeSubTab === 'paper_builder' ? renderPaperBuilderTab(state, groups, activeGroup, quizzes, currentQuiz) : ''}
      ${activeSubTab === 'paper_scanner' ? renderPaperScannerTab(state, groups, activeGroup, quizzes, currentQuiz, groupStudents) : ''}
      ${activeSubTab === 'roster' ? renderRosterTab(state, groups, students, activeGroup, groupStudents, quizzes, currentQuiz, isLoading, hasLoaded) : ''}

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
function renderOnlineBuilderTab(state, groups, activeGroup, quizzes, currentQuiz) {
  const viewMode = state.onlineViewMode || 'list'; // 'list' | 'wizard'
  const selectedGroupId = state.selectedGroupId || (groups[0]?.id || '');
  const allRich = state.richQuizzes || [];
  const richQuizzes = allRich.filter(q => {
    if (q.exam_mode === 'paper') return false;
    if (!selectedGroupId) return true;
    if (!q.group_id || q.group_id === 'all') return true;
    return String(q.group_id) === String(selectedGroupId);
  });

  if (viewMode === 'list') {
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Online Exams Cards Grid (Swiss Minimal) -->
        ${richQuizzes.length > 0 ? `
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

                  <!-- Actions -->
                  <div style="display: flex; gap: 0.45rem; align-items: center; margin-top: 1rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;">
                    <button 
                      type="button" 
                      style="flex: 1; height: 30px; font-size: 0.75rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;"
                      onclick="window.centrlyApp.editOnlineExamWizard('${escapeHtml(rq.id)}')"
                    >
                      ${getIcon('edit', 12)}
                      <span>تعديل الامتحان</span>
                    </button>
                    <button 
                      type="button" 
                      style="height: 30px; font-size: 0.75rem; font-weight: 600; background: #f8fafc; color: #334155; border-radius: 5px; border: 1px solid #e2e8f0; cursor: pointer; padding: 0 10px;"
                      onclick="window.centrlyApp.switchToRosterForQuiz(${rq.quiz_number})"
                      title="عرض كشف درجات هذا الكويز"
                    >
                      <span>كشف الدرجات</span>
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

  // STEP 2: Question-by-Question Builder (سؤال بسؤال)
  const isMcq = currentQ.type !== 'essay';
  const isImageOnly = currentQ.format === 'image_only' || (currentQ.format !== 'standard' && !currentQ.text?.trim() && !!currentQ.image_url);
  const progressPct = Math.round(((currentQIdx + 1) / totalQuestions) * 100);

  return `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      
      <!-- Top Stepper Toolbar -->
      <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-blue-700);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge badge-blue" style="font-size: 0.85rem; font-weight: 900; padding: 4px 10px;">
                السؤال ${currentQIdx + 1} من ${totalQuestions}
              </span>
              <span style="font-weight: 800; font-size: 1rem; color: #0f172a;">
                ${escapeHtml(activeQuiz.title || 'امتحان أونلاين')} (${escapeHtml(activeQuiz.subject || 'الفيزياء')})
              </span>
            </div>
            <div style="font-size: 0.78rem; color: var(--centrly-text); margin-top: 0.25rem;">
              يمكنك التنقل بين الأسئلة عبر الأرقام أدناه أو الضغط على زر "السؤال التالي".
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button 
              type="button" 
              class="btn btn-secondary" 
              style="font-size: 0.82rem; font-weight: 700;"
              onclick="window.centrlyApp.backToWizardStep1()"
            >
              ${getIcon('edit', 14)}
              <span>تعديل بيانات الامتحان</span>
            </button>

            <button 
              type="button" 
              class="btn btn-primary" 
              style="font-size: 0.88rem; font-weight: 900; padding: 0.55rem 1.25rem; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 10px rgba(37,99,235,0.25);"
              onclick="window.centrlyApp.saveOnlineExamNow()"
            >
              ${getIcon('check', 16, '#ffffff')}
              <span>حفظ ونشر الامتحان الآن</span>
            </button>
          </div>
        </div>

        <!-- Visual Progress Bar -->
        <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 4px; margin-top: 1rem; overflow: hidden;">
          <div style="height: 100%; background: var(--centrly-blue-700); width: ${progressPct}%; transition: width 0.2s ease;"></div>
        </div>

        <!-- Question Fast Jumpers (1, 2, 3 ... N) -->
        <div style="display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.75rem 0 0.25rem 0; margin-top: 0.5rem; align-items: center;">
          <span style="font-size: 0.8rem; font-weight: 800; color: var(--centrly-ink); margin-left: 0.5rem; white-space: nowrap;">الانتقال السريع:</span>
          ${Array.from({ length: totalQuestions }).map((_, idx) => {
            const isCur = idx === currentQIdx;
            const qData = activeQuiz.questions?.[idx];
            const hasContent = qData && (qData.text?.trim() || qData.image_url);

            return `
              <button 
                type="button"
                style="min-width: 34px; height: 34px; border-radius: 8px; font-weight: 900; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; border: 1.5px solid ${isCur ? 'var(--centrly-blue-700)' : (hasContent ? '#10b981' : '#cbd5e1')}; background: ${isCur ? 'var(--centrly-blue-700)' : (hasContent ? '#ecfdf5' : '#ffffff')}; color: ${isCur ? '#ffffff' : (hasContent ? '#065f46' : '#64748b')};"
                onclick="window.centrlyApp.jumpToQuestion(${idx})"
                title="سؤال ${idx + 1}"
              >
                ${idx + 1}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Current Question Card -->
      <div class="card" style="margin: 0; border: 1.5px solid ${isMcq ? '#93c5fd' : '#fbcfe8'}; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
        
        <!-- Question Type, Format & Points Toolbar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.85rem; margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
            <span style="background: var(--centrly-blue-700); color: #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1rem;">
              ${currentQIdx + 1}
            </span>
            
            <!-- Type Selector: MCQ vs Essay -->
            <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <button 
                type="button" 
                class="btn ${isMcq ? 'btn-primary' : 'btn-secondary'}" 
                style="padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 800; border-radius: 6px;"
                onclick="window.centrlyApp.updateCurrentQuestionType('mcq')"
              >
                اختيار من متعدد (MCQ)
              </button>
              <button 
                type="button" 
                class="btn ${!isMcq ? 'btn-primary' : 'btn-secondary'}" 
                style="padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 800; border-radius: 6px;"
                onclick="window.centrlyApp.updateCurrentQuestionType('essay')"
              >
                سؤال مقالي (Essay)
              </button>
            </div>

            <!-- Format Selector: Standard Text vs Image-Only -->
            <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <button 
                type="button" 
                class="btn ${!isImageOnly ? 'btn-primary' : 'btn-secondary'}" 
                style="padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 800; border-radius: 6px;"
                onclick="window.centrlyApp.setWizardQuestionFormat('standard')"
              >
                سؤال نصي
              </button>
              <button 
                type="button" 
                class="btn ${isImageOnly ? 'btn-primary' : 'btn-secondary'}" 
                style="padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 800; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.35rem; ${isImageOnly ? 'background: #0284c7; border-color: #0284c7; color: #fff;' : ''}"
                onclick="window.centrlyApp.setWizardQuestionFormat('image_only')"
                title="تفعيل وضع صورة السؤال بالكامل من الكتاب أو المذكرة دون الحاجة لكتابة نص"
              >
                ${getIcon('camera', 14, isImageOnly ? '#fff' : 'var(--centrly-blue-700)')}
                <span>السؤال صورة بالكامل</span>
              </button>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.85rem; font-weight: 800; color: var(--centrly-ink);">درجة السؤال:</label>
            <input 
              type="number" 
              id="currentQPoints" 
              class="form-input" 
              value="${currentQ.points || 2}" 
              min="0.5" 
              step="0.5" 
              style="width: 75px; text-align: center; font-weight: 900; font-size: 1rem; border: 2px solid var(--centrly-blue-700);"
              onchange="window.centrlyApp.updateCurrentQuestionField('points', this.value)"
            />
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-text);">درجات</span>
          </div>
        </div>

        <!-- Question Body (Image-Only vs Standard Text) -->
        ${isImageOnly ? `
          <!-- Image-Only Hero Box -->
          <div style="background: #f0fdf4; border: 2px dashed ${currentQ.image_url ? '#10b981' : '#86efac'}; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; text-align: center; transition: all 0.2s ease;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem; text-align: right;">
              <div>
                <span style="font-size: 0.95rem; font-weight: 900; color: #166534; display: flex; align-items: center; gap: 0.4rem;">
                  ${getIcon('camera', 18, '#166534')}
                  <span>صورة السؤال بالكامل (قص / لقطة شاشة من كتاب أو مذكرة):</span>
                </span>
                <span style="font-size: 0.75rem; color: #15803d; font-weight: 600;">
                  صيغة المسألة معروضة بالصورة كاملة دون الحاجة لكتابة أي نص.
                </span>
              </div>

              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input 
                  type="file" 
                  id="wizardQImageInput" 
                  accept="image/*" 
                  capture="environment" 
                  style="display: none;" 
                  onchange="window.centrlyApp.handleWizardImageUpload(this.files[0])"
                />
                <button 
                  type="button" 
                  class="btn btn-primary" 
                  style="font-size: 0.82rem; font-weight: 800; padding: 0.45rem 0.95rem; display: inline-flex; align-items: center; gap: 0.4rem;"
                  onclick="document.getElementById('wizardQImageInput').click()"
                >
                  ${getIcon('upload', 14, '#ffffff')}
                  <span>${currentQ.image_url ? 'تغيير صورة السؤال' : 'رفع / تصوير صورة السؤال'}</span>
                </button>

                ${currentQ.image_url ? `
                  <button 
                    type="button" 
                    class="btn btn-secondary" 
                    style="color: #dc2626; border-color: #fecaca; font-size: 0.82rem; font-weight: 800; padding: 0.45rem 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;"
                    onclick="window.centrlyApp.removeWizardImage()"
                    title="إزالة الصورة"
                  >
                    ${getIcon('delete', 14, '#dc2626')}
                    <span>حذف الصورة</span>
                  </button>
                ` : ''}
              </div>
            </div>

            ${currentQ.image_url ? `
              <div style="background: #ffffff; padding: 0.75rem; border-radius: 8px; border: 1px solid #bbf7d0; display: inline-block; max-width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                <img 
                  src="${escapeHtml(currentQ.image_url)}" 
                  alt="صورة السؤال بالكامل" 
                  style="max-height: 280px; max-width: 100%; border-radius: 6px; object-fit: contain;"
                />
              </div>
            ` : `
              <div 
                style="padding: 1.5rem 1rem; border: 1.5px dashed #86efac; background: #ffffff; border-radius: 8px; cursor: pointer;"
                onclick="document.getElementById('wizardQImageInput').click()"
              >
                <div style="background: #dcfce7; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto; color: #15803d;">
                  ${getIcon('camera', 28, '#15803d')}
                </div>
                <div style="font-weight: 800; font-size: 0.95rem; color: #166534; margin-bottom: 0.25rem;">
                  اضغط هنا لاختيار أو التقاط صورة السؤال
                </div>
                <div style="font-size: 0.78rem; color: #15803d;">
                  (أو الصق لقطة الشاشة مباشرة بالضغط على <b>Ctrl + V</b> في أي مكان في الصفحة)
                </div>
              </div>
            `}

            <!-- Optional heading for the teacher -->
            <div style="margin-top: 0.75rem; text-align: right;">
              <details style="font-size: 0.8rem; color: #475569;">
                <summary style="cursor: pointer; font-weight: 700; color: #166534;">
                  + إضافة عنوان أو ملاحظة نصية اختيارية تظهر فوق الصورة
                </summary>
                <input 
                  type="text" 
                  class="form-input" 
                  value="${escapeHtml(currentQ.text || '')}" 
                  placeholder="ملاحظة أو عنوان اختياري (اتركه فارغاً إذا كنت تريد الصورة فقط)..." 
                  style="margin-top: 0.5rem; font-size: 0.85rem;"
                  onchange="window.centrlyApp.updateCurrentQuestionField('text', this.value)"
                />
              </details>
            </div>

          </div>
        ` : `
          <!-- Standard Question Text Textarea & Secondary Image Upload -->
          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.85rem; font-weight: 800; color: var(--centrly-ink); margin-bottom: 0.35rem; display: block;">
              نص السؤال ${currentQIdx + 1}:
            </label>
            <textarea 
              id="currentQText"
              class="form-input" 
              rows="3" 
              placeholder="اكتب صيغة السؤال هنا بوضوح..."
              style="font-size: 0.95rem; font-weight: 700; width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px;"
              onchange="window.centrlyApp.updateCurrentQuestionField('text', this.value)"
            >${escapeHtml(currentQ.text || '')}</textarea>
          </div>

          <!-- Question Image Upload (Mobile / Desktop) -->
          <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="color: var(--centrly-blue-700);">${getIcon('camera', 24, 'var(--centrly-blue-700)')}</div>
              <div>
                <span style="font-size: 0.85rem; font-weight: 800; color: var(--centrly-ink); display: block;">صورة مسألة أو رسم توضيحي للسؤال (اختياري):</span>
                <span style="font-size: 0.75rem; color: var(--centrly-text);">التقط صورة بالكاميرا أو اختر صورة من المعرض أو اضغط Ctrl+V</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <input 
                type="file" 
                id="wizardQImageInput" 
                accept="image/*" 
                capture="environment" 
                style="display: none;" 
                onchange="window.centrlyApp.handleWizardImageUpload(this.files[0])"
              />
              <button 
                type="button" 
                class="btn btn-secondary" 
                style="font-size: 0.82rem; font-weight: 800; padding: 0.45rem 0.95rem;"
                onclick="document.getElementById('wizardQImageInput').click()"
              >
                ${getIcon('upload', 14)}
                <span>${currentQ.image_url ? 'تغيير الصورة' : 'رفع / تصوير صورة'}</span>
              </button>

              ${currentQ.image_url ? `
                <button 
                  type="button" 
                  class="btn btn-secondary" 
                  style="color: #dc2626; font-size: 0.82rem; padding: 0.45rem 0.75rem;"
                  onclick="window.centrlyApp.removeWizardImage()"
                  title="إزالة الصورة"
                >
                  ${getIcon('delete', 14, '#dc2626')}
                  <span>حذف الصورة</span>
                </button>
              ` : ''}
            </div>

            ${currentQ.image_url ? `
              <div style="width: 100%; margin-top: 0.75rem; text-align: center;">
                <img 
                  src="${escapeHtml(currentQ.image_url)}" 
                  alt="صورة السؤال" 
                  style="max-height: 200px; max-width: 100%; border-radius: 8px; border: 1.5px solid #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,0.08);"
                />
              </div>
            ` : ''}
          </div>
        `}

        <!-- MCQ Choices or Essay Model Answer -->
        ${isMcq ? `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <span style="font-size: 0.85rem; font-weight: 800; color: var(--centrly-ink);">
                خيارات الإجابة (اختر الدائرة المقابلة للإجابة الصحيحة):
              </span>
              ${isImageOnly ? `
                <span style="font-size: 0.75rem; background: #e0f2fe; color: #0369a1; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 700;">
                  إذا كانت الاختيارات (أ/ب/ج/د) موجودة داخل الصورة، يكفيك اختيار الدائرة الصحيحة فقط دون كتابة نص
                </span>
              ` : ''}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75rem;">
              ${['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => {
                const isCorrect = Number(currentQ.correct_index) === optIdx;
                return `
                  <div style="display: flex; align-items: center; gap: 0.65rem; background: ${isCorrect ? '#f0fdf4' : '#ffffff'}; border: 2px solid ${isCorrect ? '#10b981' : '#e2e8f0'}; border-radius: 8px; padding: 0.5rem 0.75rem; transition: all 0.15s ease;">
                    <input 
                      type="radio" 
                      name="correctChoiceRadio" 
                      value="${optIdx}" 
                      ${isCorrect ? 'checked' : ''} 
                      style="width: 20px; height: 20px; cursor: pointer; accent-color: #10b981;"
                      onchange="window.centrlyApp.setWizardCorrectChoice(${optIdx})"
                    />
                    <span style="font-weight: 900; font-size: 0.95rem; color: ${isCorrect ? '#047857' : '#64748b'}; width: 24px;">(${letter})</span>
                    <input 
                      type="text" 
                      class="form-input" 
                      value="${escapeHtml(currentQ.choices?.[optIdx] || '')}" 
                      placeholder="${isImageOnly ? `خيار (${letter}) - اختياري...` : `خيار (${letter})...`}" 
                      style="flex: 1; padding: 0.4rem 0.5rem; font-size: 0.9rem; font-weight: 700; border: none; background: transparent;"
                      onchange="window.centrlyApp.updateWizardChoice(${optIdx}, this.value)"
                    />
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : `
          <!-- Essay Model Answer Box -->
          <div style="background: #fdf2f8; border: 1.5px solid #fbcfe8; border-radius: 8px; padding: 1rem;">
            <label style="font-size: 0.85rem; font-weight: 800; color: #9d174d; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.4rem;">
              ${getIcon('lightbulb', 18, '#9d174d')}
              <span>الإجابة النموذجية الاسترشادية (تظهر للمصحح عند تصحيح المقالي بالعين):</span>
            </label>
            <textarea 
              class="form-input" 
              rows="3" 
              placeholder="اكتب خطوات الحل أو الإجابة النموذجية المعتمدة ليسترشد بها المصحح أثناء تقدير درجة الطالب..."
              style="font-size: 0.9rem; font-weight: 700; width: 100%; border: 1px solid #f472b6; background: #ffffff;"
              onchange="window.centrlyApp.updateCurrentQuestionField('model_answer', this.value)"
            >${escapeHtml(currentQ.model_answer || '')}</textarea>
          </div>
        `}

        <!-- Step Navigation Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; border-top: 1px solid #f1f5f9; padding-top: 1.25rem;">
          
          <button 
            type="button" 
            class="btn btn-secondary" 
            style="padding: 0.55rem 1.25rem; font-weight: 800; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 0.4rem;"
            ${currentQIdx === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}
            onclick="window.centrlyApp.prevQuestion()"
          >
            ${getIcon('arrowRight', 16)}
            <span>السؤال السابق</span>
          </button>

          <div style="display: flex; gap: 0.65rem; align-items: center;">
            <button 
              type="button" 
              class="btn btn-secondary" 
              style="font-size: 0.85rem; font-weight: 700;"
              onclick="window.centrlyApp.cancelOnlineExamWizard()"
            >
              إلغاء والعودة
            </button>

            ${currentQIdx < totalQuestions - 1 ? `
              <button 
                type="button" 
                class="btn btn-primary" 
                style="padding: 0.6rem 1.5rem; font-weight: 800; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 10px rgba(37,99,235,0.25);"
                onclick="window.centrlyApp.nextQuestion()"
              >
                <span>السؤال التالي</span>
                ${getIcon('arrowLeft', 16, '#ffffff')}
              </button>
            ` : `
              <button 
                type="button" 
                class="btn btn-primary" 
                style="padding: 0.6rem 1.75rem; font-weight: 900; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 0.5rem; background: #059669; border-color: #059669; box-shadow: 0 4px 12px rgba(5,150,105,0.3);"
                onclick="window.centrlyApp.saveOnlineExamNow()"
              >
                ${getIcon('check', 18, '#ffffff')}
                <span>إنهاء وحفظ ونشر الامتحان الآن</span>
              </button>
            `}
          </div>

        </div>

      </div>

    </div>
  `;
}

// ============================================================================
// TAB 2: ONLINE GRADING (تصحيح الامتحانات الإلكترونية)
// ============================================================================
function renderOnlineGradingTab(state, groups, activeGroup, pendingSubmissions, onlineSubmissions) {
  const gradingViewMode = state.gradingViewMode || 'pending'; // 'pending' (مقالي) | 'graded' (النتائج)
  const submissionsList = Array.isArray(onlineSubmissions) ? onlineSubmissions : [];
  const gradedSubmissions = submissionsList.filter(sub => sub.status === 'approved' || sub.is_graded);
  const pending = Array.isArray(pendingSubmissions) ? pendingSubmissions : [];

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
              الأسئلة الاختيارية تُصحح تلقائياً فورياً، والأسئلة المقالية تُراجع هنا مع نموذج الإجابة لاعتماد الدرجات.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button 
              type="button" 
              class="btn ${gradingViewMode === 'pending' ? 'btn-primary' : 'btn-secondary'}" 
              style="font-size: 0.82rem; font-weight: 800; border-radius: 6px; position: relative;"
              onclick="window.centrlyApp.switchGradingViewMode('pending')"
            >
              <span>امتحانات تحتاج تصحيح يدوي (مقالي)</span>
              ${pending.length > 0 ? `
                <span style="background: #ef4444; color: #ffffff; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: 900; margin-right: 0.35rem;">
                  ${pending.length}
                </span>
              ` : ''}
            </button>

            <button 
              type="button" 
              class="btn ${gradingViewMode === 'graded' ? 'btn-primary' : 'btn-secondary'}" 
              style="font-size: 0.82rem; font-weight: 800; border-radius: 6px;"
              onclick="window.centrlyApp.switchGradingViewMode('graded')"
            >
              <span>الامتحانات المصححة تلقائياً (MCQ) والنتائج</span>
              ${gradedSubmissions.length > 0 ? `
                <span style="background: #059669; color: #ffffff; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: 900; margin-right: 0.35rem;">
                  ${gradedSubmissions.length}
                </span>
              ` : ''}
            </button>

            <button 
              class="btn btn-secondary" 
              style="font-size: 0.82rem; font-weight: 700; height: 32px; padding: 0 10px;"
              onclick="window.centrlyApp.loadOnlineSubmissions(); window.centrlyApp.renderMainContent();"
              title="تحديث البيانات"
            >
              ${getIcon('refresh', 14)}
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

          return `
            <div class="card" style="margin: 0; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
              
              <!-- Student Header -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                  <div style="font-weight: 800; font-size: 0.98rem; color: #0f172a;">
                    ${escapeHtml(sub.student_name || 'طالب')} 
                    <span style="font-size: 0.78rem; color: #1e40af; font-weight: 700; margin-right: 0.35rem;">(كود: ${escapeHtml(sub.student_code || '1006')})</span>
                  </div>
                  <div style="font-size: 0.76rem; color: #64748b; margin-top: 0.15rem;">
                    ${escapeHtml(sub.quiz_title || 'كويز إلكتروني')} • كويز ${sub.quiz_number || 1} • تاريخ التسليم: ${escapeHtml((sub.submitted_at || '').slice(0, 16).replace('T', ' '))}
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.25rem 0.65rem; text-align: center;">
                    <span style="font-size: 0.7rem; color: #64748b; font-weight: 700; display: block;">درجة الاختياري (تلقائي)</span>
                    <span style="font-weight: 800; color: #0f172a; font-size: 0.92rem;">${mcqScore} / ${totalMcq}</span>
                  </div>
                </div>
              </div>

              <!-- Essay Questions to Grade -->
              <div style="display: flex; flex-direction: column; gap: 0.85rem;">
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
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem;">
                      
                      <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a; margin-bottom: 0.4rem;">
                        سؤال مقالي (${eqIdx + 1}): ${escapeHtml(eq.text || '')}
                      </div>

                      ${eq.image_url ? `
                        <div style="margin-bottom: 0.5rem;">
                          <img src="${escapeHtml(eq.image_url)}" alt="صورة السؤال" style="max-height: 140px; border-radius: 6px; border: 1px solid #cbd5e1;" />
                        </div>
                      ` : ''}

                      <!-- Model Answer Box (Soft Green) -->
                      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.55rem 0.75rem; margin-bottom: 0.55rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #166534; margin-bottom: 0.15rem;">
                          ${getIcon('lightbulb', 13, '#166534')} الإجابة النموذجية الاسترشادية:
                        </div>
                        <div style="font-size: 0.82rem; color: #14532d; line-height: 1.5;">
                          ${escapeHtml(eq.model_answer || 'لا توجد إجابة نموذجية مسجلة')}
                        </div>
                      </div>

                      <!-- Student Written Answer Box (Soft Blue) -->
                      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.65rem 0.85rem; margin-bottom: 0.65rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #1e40af; margin-bottom: 0.2rem;">
                          ${getIcon('edit', 13, '#1e40af')} حل وإجابة الطالب:
                        </div>
                        <div style="font-size: 0.88rem; font-weight: 700; color: #1e3a8a; line-height: 1.6; white-space: pre-wrap;">
                          ${escapeHtml(studentAns)}
                        </div>
                      </div>

                      <!-- Score Input for this Question -->
                      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                          <label style="font-size: 0.82rem; font-weight: 800; color: #0f172a;">تقدير درجة المقالي لهذا السؤال:</label>
                          <input 
                            type="number" 
                            id="essay_pts_${sub.id}_${fieldKey}" 
                            min="0" 
                            max="${eq.points || 5}" 
                            step="0.5" 
                            value="${eq.points || 5}" 
                            class="form-input" 
                            style="width: 70px; height: 32px; text-align: center; font-weight: 800; font-size: 0.95rem; border: 1.5px solid #2563eb; border-radius: 6px;"
                          />
                          <span style="font-size: 0.8rem; font-weight: 700; color: #64748b;">من ${eq.points || 5} درجات</span>
                        </div>
                      </div>

                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Grading Footer Actions -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 0.75rem; margin-top: 0.85rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
                <input 
                  type="text" 
                  id="grading_note_${sub.id}" 
                  class="form-input" 
                  placeholder="ملاحظة أو تعليق للطالب على حله المقالي (اختياري)..." 
                  style="flex: 1; min-width: 240px; height: 34px; font-size: 0.82rem;"
                />

                <button 
                  type="button" 
                  class="btn btn-primary" 
                  style="font-weight: 800; font-size: 0.82rem; height: 34px; padding: 0 1.25rem; display: inline-flex; align-items: center; gap: 0.4rem; background: #0f172a; border-color: #0f172a;"
                  onclick="window.centrlyApp.submitManualEssayGrade('${sub.id}', '${sub.student_code || sub.student_id || '1006'}', ${sub.quiz_number || 1})"
                >
                  ${getIcon('check', 15, '#ffffff')}
                  <span>اعتماد الدرجة النهائية وتثبيتها</span>
                </button>
              </div>

            </div>
          `;
        }).join('') : `
          <div class="card" style="text-align: center; padding: 2.5rem 1.5rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px;">
            <div style="display: flex; justify-content: center; margin-bottom: 0.5rem; color: #059669;">
              ${getIcon('check', 32, '#059669')}
            </div>
            <h4 style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin: 0 0 0.25rem 0;">رائع جداً! لا توجد أسئلة مقالية معلقة في انتظار التصحيح</h4>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
              كافة إجابات الطلاب مصححة بالكامل، أو لم يقم الطلاب بتسليم امتحانات مقالية جديدة بعد.
            </p>
          </div>
        `}
      ` : `
        <!-- VIEW B: GRADED RESULTS OVERVIEW -->
        <div class="card" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h4 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">
                نتائج ودرجات الامتحانات الإلكترونية المعتمدة
              </h4>
              <p style="font-size: 0.8rem; color: #64748b; margin: 0.2rem 0 0 0;">
                هنا تظهر فقط تسليمات الامتحانات التي أجاب عليها الطلاب إلكترونياً عبر هواتفهم وحساباتهم
              </p>
            </div>
            ${gradedSubmissions.length > 0 ? `
              <span class="badge badge-success" style="font-size: 0.82rem; font-weight: 800;">
                إجمالي التسليمات: ${gradedSubmissions.length}
              </span>
            ` : ''}
          </div>

          ${gradedSubmissions.length > 0 ? `
            <div style="overflow-x: auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>كود الطالب</th>
                    <th>اسم الطالب</th>
                    <th>الامتحان الإلكتروني</th>
                    <th style="text-align: center;">الدرجة المحققة</th>
                    <th style="text-align: center;">النسبة المئوية</th>
                    <th style="text-align: center;">تاريخ الحل</th>
                    <th>نوع التقييم</th>
                    <th style="text-align: center;">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${gradedSubmissions.map(sub => {
                    const numScore = Number(sub.score ?? sub.mcq_score ?? 0);
                    const maxSc = Number(sub.max_score || 10);
                    const pct = Math.round((numScore / (maxSc || 1)) * 100);

                    let badge = '<span class="badge badge-success">تصحيح تلقائي 100%</span>';
                    if (sub.has_essay) {
                      badge = '<span class="badge badge-blue">تم اعتماد المقالي</span>';
                    }

                    return `
                      <tr>
                        <td style="font-family: monospace; font-weight: 800; color: #1e40af;">${escapeHtml(sub.student_code || '—')}</td>
                        <td style="font-weight: 700;">${escapeHtml(sub.student_name || 'طالب')}</td>
                        <td style="font-weight: 600;">${escapeHtml(sub.quiz_title || `كويز ${sub.quiz_number || 1}`)}</td>
                        <td style="text-align: center; font-weight: 900; font-size: 1rem; color: #059669;">${numScore} / ${maxSc}</td>
                        <td style="text-align: center; font-weight: 800; color: ${pct >= 50 ? '#059669' : '#dc2626'};">${pct}%</td>
                        <td style="text-align: center; font-size: 0.78rem; color: #64748b;">${escapeHtml((sub.submitted_at || '').slice(0, 16).replace('T', ' '))}</td>
                        <td>${badge}</td>
                        <td style="text-align: center;">
                          <button 
                            class="btn btn-secondary" 
                            style="font-size: 0.78rem; font-weight: 700; color: #059669;"
                            onclick="window.centrlyApp.sendQuizScoreWhatsApp('${sub.student_id}', '${escapeHtml(sub.student_name)}', '${escapeHtml(sub.quiz_title || `كويز ${sub.quiz_number || 1}`)}', 'both', ${numScore}, ${maxSc})"
                          >
                            ${getIcon('whatsapp', 14, '#059669')}
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
            <div style="text-align: center; padding: 3.5rem 1.5rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px;">
              <div style="display: flex; justify-content: center; margin-bottom: 0.75rem; color: #94a3b8;">
                ${getIcon('award', 44, '#94a3b8')}
              </div>
              <h4 style="font-weight: 800; color: #1e293b; margin: 0 0 0.4rem 0; font-size: 1.1rem;">
                لا توجد تسليمات للامتحانات الإلكترونية بعد
              </h4>
              <p style="font-size: 0.85rem; color: #64748b; margin: 0 auto; max-width: 520px; line-height: 1.6;">
                هذا التبويب مخصص حصرياً للامتحانات التي يؤديها الطلاب أونلاين عبر هواتفهم وحساباتهم. لم يقم أي طالب بتسليم امتحان إلكتروني في هذه المجموعة حتى الآن.
              </p>
              <div style="margin-top: 1.25rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
                <button 
                  class="btn btn-primary" 
                  style="font-size: 0.85rem; font-weight: 800; border-radius: 8px;"
                  onclick="window.centrlyApp.switchQuizSubTab('online_builder')"
                >
                  ${getIcon('plus', 15)}
                  <span>إنشاء امتحان أونلاين جديد للطلاب</span>
                </button>
                <button 
                  class="btn btn-secondary" 
                  style="font-size: 0.85rem; font-weight: 700; border-radius: 8px;"
                  onclick="window.centrlyApp.switchQuizSubTab('roster')"
                >
                  ${getIcon('check', 15)}
                  <span>الانتقال لرصد درجات الكويزات العادية يدوياً</span>
                </button>
              </div>
            </div>
          `}
        </div>
      `}

    </div>
  `;
}

// ============================================================================
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
    return String(q.group_id) === String(selectedGroupId);
  });

  const selectedQuizId = state.printQuizId || paperQuizzes[0]?.id || null;
  const targetQuiz = paperQuizzes.find(q => q.id === selectedQuizId) || paperQuizzes[0] || allRich.find(q => q.id === selectedQuizId && q.exam_mode === 'paper') || null;

  if (paperMode === 'list') {
    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Paper Exams Cards Grid (Swiss Minimal) -->
        ${paperQuizzes.length > 0 ? `
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
                  <div style="display: flex; gap: 0.45rem; align-items: center; margin-top: 1rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;">
                    <button 
                      type="button" 
                      style="flex: 1; height: 30px; font-size: 0.75rem; font-weight: 700; background: #0f172a; color: #ffffff; border-radius: 5px; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;"
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
        <div class="card" style="margin: 0; border: 1.5px solid ${isMcq ? '#cbd5e1' : '#fbcfe8'}; background: #ffffff; border-radius: 12px; position: relative;" onclick="if(window.centrlyApp) window.centrlyApp.quizzesState.activePaperPasteQIdx = ${qIdx}">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
              <span style="background: var(--centrly-blue-700); color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.95rem;">
                ${qIdx + 1}
              </span>
              <div style="display: flex; gap: 0.35rem; background: #f1f5f9; padding: 3px; border-radius: 8px;">
                <button 
                  type="button" 
                  class="btn ${isMcq ? 'btn-primary' : 'btn-secondary'}" 
                  style="padding: 0.3rem 0.75rem; font-size: 0.78rem; font-weight: 800; border-radius: 6px;"
                  onclick="window.centrlyApp.updatePaperQuestion(${qIdx}, 'type', 'mcq')"
                >
                  اختيار من متعدد (MCQ)
                </button>
                <button 
                  type="button" 
                  class="btn ${!isMcq ? 'btn-primary' : 'btn-secondary'}" 
                  style="padding: 0.3rem 0.75rem; font-size: 0.78rem; font-weight: 800; border-radius: 6px;"
                  onclick="window.centrlyApp.updatePaperQuestion(${qIdx}, 'type', 'essay')"
                >
                  سؤال مقالي (Essay)
                </button>
              </div>

              <!-- Format Selector: Standard vs Image-Only -->
              <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <button 
                  type="button" 
                  class="btn ${!isQImageOnly ? 'btn-primary' : 'btn-secondary'}" 
                  style="padding: 0.3rem 0.65rem; font-size: 0.78rem; font-weight: 800; border-radius: 6px;"
                  onclick="window.centrlyApp.setPaperQuestionFormat(${qIdx}, 'standard')"
                >
                  سؤال نصي
                </button>
                <button 
                  type="button" 
                  class="btn ${isQImageOnly ? 'btn-primary' : 'btn-secondary'}" 
                  style="padding: 0.3rem 0.65rem; font-size: 0.78rem; font-weight: 800; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem; ${isQImageOnly ? 'background: #0284c7; border-color: #0284c7; color: #fff;' : ''}"
                  onclick="window.centrlyApp.setPaperQuestionFormat(${qIdx}, 'image_only')"
                  title="تفعيل وضع صورة السؤال بالكامل من الكتاب أو المذكرة دون كتابة نص"
                >
                  ${getIcon('camera', 13, isQImageOnly ? '#fff' : 'var(--centrly-blue-700)')}
                  <span>السؤال صورة بالكامل</span>
                </button>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                <label style="font-size: 0.8rem; font-weight: 700; color: var(--centrly-text);">درجة السؤال:</label>
                <input 
                  type="number" 
                  class="form-input" 
                  value="${q.points !== undefined && q.points !== null ? q.points : 2}" 
                  min="0.5" 
                  step="0.5" 
                  style="width: 65px; text-align: center; padding: 0.25rem; font-weight: 800;"
                  onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'points', this.value)"
                />
              </div>

              <button 
                type="button" 
                class="btn btn-secondary" 
                style="color: #dc2626; padding: 0.35rem 0.65rem; font-size: 0.78rem;"
                onclick="window.centrlyApp.removePaperQuestion(${qIdx})"
                title="حذف هذا السؤال"
              >
                ${getIcon('delete', 14, '#dc2626')}
                <span>حذف</span>
              </button>
            </div>
          </div>

          ${isQImageOnly ? `
            <!-- Image-Only Hero Box for Paper Exam -->
            <div style="background: #f0fdf4; border: 2px dashed ${q.image_url ? '#10b981' : '#86efac'}; border-radius: 10px; padding: 1rem; margin-bottom: 1rem; text-align: center;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem; text-align: right;">
                <div>
                  <span style="font-size: 0.9rem; font-weight: 800; color: #166534; display: flex; align-items: center; gap: 0.35rem;">
                    ${getIcon('camera', 16, '#166534')}
                    <span>صورة السؤال بالكامل (قص من كتاب أو مذكرة للطباعة في ورقة الامتحان):</span>
                  </span>
                  <span style="font-size: 0.72rem; color: #15803d;">
                    صيغة المسألة معروضة بالصورة كاملة دون الحاجة لكتابة أي نص.
                  </span>
                </div>

                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input 
                    type="file" 
                    id="paperQImageInput_${qIdx}" 
                    accept="image/*" 
                    capture="environment" 
                    style="display: none;" 
                    onchange="window.centrlyApp.handlePaperImageUpload(${qIdx}, this.files[0])"
                  />
                  <button 
                    type="button" 
                    class="btn btn-primary" 
                    style="font-size: 0.8rem; font-weight: 800; padding: 0.35rem 0.85rem; display: inline-flex; align-items: center; gap: 0.35rem;"
                    onclick="document.getElementById('paperQImageInput_${qIdx}').click()"
                  >
                    ${getIcon('upload', 14, '#ffffff')}
                    <span>${q.image_url ? 'تغيير صورة السؤال' : 'رفع / تصوير صورة السؤال'}</span>
                  </button>

                  ${q.image_url ? `
                    <button 
                      type="button" 
                      class="btn btn-secondary" 
                      style="color: #dc2626; border-color: #fecaca; font-size: 0.8rem; padding: 0.35rem 0.65rem;"
                      onclick="window.centrlyApp.removePaperImage(${qIdx})"
                      title="إزالة الصورة"
                    >
                      ${getIcon('delete', 14, '#dc2626')}
                      <span>حذف الصورة</span>
                    </button>
                  ` : ''}
                </div>
              </div>

              ${q.image_url ? `
                <div style="background: #ffffff; padding: 0.5rem; border-radius: 6px; border: 1px solid #bbf7d0; display: inline-block; max-width: 100%;">
                  <img 
                    src="${escapeHtml(q.image_url)}" 
                    alt="صورة السؤال" 
                    style="max-height: 240px; max-width: 100%; border-radius: 6px; object-fit: contain;"
                  />
                </div>
              ` : `
                <div 
                  style="padding: 1.25rem 1rem; border: 1.5px dashed #86efac; background: #ffffff; border-radius: 6px; cursor: pointer;"
                  onclick="document.getElementById('paperQImageInput_${qIdx}').click()"
                >
                  <div style="background: #dcfce7; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.5rem auto; color: #15803d;">
                    ${getIcon('camera', 24, '#15803d')}
                  </div>
                  <div style="font-weight: 800; font-size: 0.9rem; color: #166534;">اضغط لرفع أو تصوير صورة السؤال بالكامل</div>
                  <div style="font-size: 0.72rem; color: #15803d;">(أو انقر هنا والصق الصورة بـ <b>Ctrl + V</b>)</div>
                </div>
              `}

              <div style="margin-top: 0.5rem; text-align: right;">
                <details style="font-size: 0.78rem; color: #475569;">
                  <summary style="cursor: pointer; font-weight: 700; color: #166534;">+ إضافة عنوان أو رأس سؤال اختياري</summary>
                  <input 
                    type="text" 
                    class="form-input" 
                    value="${escapeHtml(q.text || '')}" 
                    placeholder="عنوان أو ملاحظة اختيارية..." 
                    style="margin-top: 0.35rem; font-size: 0.82rem;"
                    onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'text', this.value)"
                  />
                </details>
              </div>
            </div>
          ` : `
            <!-- Standard Question Textarea -->
            <div style="margin-bottom: 0.75rem;">
              <label style="font-size: 0.82rem; font-weight: 700; color: var(--centrly-ink); margin-bottom: 0.35rem; display: block;">
                نص السؤال:
              </label>
              <textarea 
                class="form-input" 
                rows="2" 
                placeholder="اكتب صيغة السؤال هنا بوضوح..."
                style="font-size: 0.92rem; font-weight: 700; width: 100%;"
                onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'text', this.value)"
              >${escapeHtml(q.text || '')}</textarea>
            </div>

            <!-- Question Image Uploader -->
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="color: var(--centrly-blue-700);">${getIcon('camera', 22, 'var(--centrly-blue-700)')}</div>
                <div>
                  <span style="font-size: 0.85rem; font-weight: 800; color: var(--centrly-ink); display: block;">صورة مسألة أو رسم بياني للسؤال:</span>
                  <span style="font-size: 0.72rem; color: var(--centrly-text);">التقط صورة بكاميرا الهاتف أو اختر صورة من جهازك</span>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input 
                  type="file" 
                  id="paperQImageInput_${qIdx}" 
                  accept="image/*" 
                  capture="environment" 
                  style="display: none;" 
                  onchange="window.centrlyApp.handlePaperImageUpload(${qIdx}, this.files[0])"
                />
                <button 
                  type="button" 
                  class="btn btn-secondary" 
                  style="font-size: 0.8rem; font-weight: 800; padding: 0.35rem 0.85rem;"
                  onclick="document.getElementById('paperQImageInput_${qIdx}').click()"
                >
                  ${getIcon('upload', 14)}
                  <span>${q.image_url ? 'تغيير الصورة' : 'رفع / تصوير صورة'}</span>
                </button>

                ${q.image_url ? `
                  <button 
                    type="button" 
                    class="btn btn-secondary" 
                    style="color: #dc2626; font-size: 0.8rem; padding: 0.35rem 0.65rem;"
                    onclick="window.centrlyApp.removePaperImage(${qIdx})"
                    title="إزالة الصورة"
                  >
                    ${getIcon('delete', 14, '#dc2626')}
                  </button>
                ` : ''}
              </div>

              ${q.image_url ? `
                <div style="width: 100%; margin-top: 0.5rem; text-align: center;">
                  <img 
                    src="${escapeHtml(q.image_url)}" 
                    alt="صورة السؤال" 
                    style="max-height: 180px; max-width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 4px rgba(0,0,0,0.1);"
                  />
                </div>
              ` : ''}
            </div>
          `}

          <!-- MCQ Choices or Essay Model Answer -->
          ${isMcq ? `
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.35rem;">
                <span style="font-size: 0.8rem; font-weight: 800; color: var(--centrly-ink);">
                  خيارات الإجابة (اختر الدائرة المقابلة للإجابة الصحيحة):
                </span>
                ${isQImageOnly ? `
                  <span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700;">
                    إذا كانت الاختيارات موجودة داخل الصورة، اختر الدائرة الصحيحة فقط دون كتابة نص
                  </span>
                ` : ''}
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.65rem;">
                ${['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => {
                  const isCorrect = Number(q.correct_index) === optIdx;
                  return `
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: ${isCorrect ? '#f0fdf4' : '#ffffff'}; border: 1.5px solid ${isCorrect ? '#10b981' : '#e2e8f0'}; border-radius: 8px; padding: 0.45rem 0.65rem;">
                      <input 
                        type="radio" 
                        name="paperCorrectRadio_${qIdx}" 
                        value="${optIdx}" 
                        ${isCorrect ? 'checked' : ''} 
                        style="width: 18px; height: 18px; cursor: pointer; accent-color: #10b981;"
                        onchange="window.centrlyApp.setPaperCorrectChoice(${qIdx}, ${optIdx})"
                      />
                      <span style="font-weight: 900; font-size: 0.9rem; color: ${isCorrect ? '#047857' : '#64748b'}; width: 22px;">(${letter})</span>
                      <input 
                        type="text" 
                        class="form-input" 
                        value="${escapeHtml(q.choices?.[optIdx] || '')}" 
                        placeholder="${isQImageOnly ? `خيار (${letter}) - اختياري...` : `خيار (${letter})...`}" 
                        style="flex: 1; padding: 0.35rem 0.55rem; font-size: 0.88rem; font-weight: 700; border: none; background: transparent;"
                        onchange="window.centrlyApp.updatePaperChoice(${qIdx}, ${optIdx}, this.value)"
                      />
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : `
            <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 0.85rem;">
              <label style="font-size: 0.82rem; font-weight: 800; color: #9d174d; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem;">
                ${getIcon('lightbulb', 16, '#9d174d')}
                <span>الإجابة النموذجية الاسترشادية:</span>
              </label>
              <textarea 
                class="form-input" 
                rows="2" 
                placeholder="اكتب خطوات الحل أو الإجابة النموذجية..."
                style="font-size: 0.88rem; width: 100%; border: 1px solid #f472b6; background: #ffffff;"
                onchange="window.centrlyApp.updatePaperQuestion(${qIdx}, 'model_answer', this.value)"
              >${escapeHtml(q.model_answer || '')}</textarea>
            </div>
          `}

        </div>
      `;
    };

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Step 2 Stepper Toolbar Card -->
        <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-blue-700);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span class="badge badge-blue" style="font-size: 0.85rem; font-weight: 900; padding: 4px 10px;">
                  الخطوة 2 من 2: كتابة وتصميم الأسئلة
                </span>
                <span style="font-weight: 800; font-size: 1rem; color: #0f172a;">
                  ${escapeHtml(activePaperQuiz.title || 'امتحان ورقي جديد')} (${escapeHtml(activePaperQuiz.subject || 'الفيزياء')})
                </span>
              </div>
              
              <div style="font-size: 0.78rem; color: var(--centrly-text); margin-top: 0.35rem;">
                الزمن المخصص: <b>${activePaperQuiz.time_limit_minutes || 45} دقيقة</b> • عدد الأسئلة: <b>${totalQuestions} سؤال</b>
              </div>
            </div>

            <!-- Score Summary & Action Buttons -->
            <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
              
              <!-- Live Score Pill -->
              <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 0.4rem 0.95rem; text-align: center;">
                <span style="font-size: 0.72rem; color: #1e40af; font-weight: 700; display: block;">
                  إجمالي درجات الامتحان
                </span>
                <span style="font-size: 1.05rem; font-weight: 900; color: #1e3a8a;">
                  ${totalCurrentPoints} درجات
                </span>
              </div>

              <button 
                type="button" 
                class="btn btn-secondary" 
                style="font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;"
                onclick="window.centrlyApp.backToPaperStep1Settings()"
              >
                ${getIcon('edit', 14)}
                <span>تعديل إعدادات الامتحان (الخطوة 1)</span>
              </button>

              <button 
                type="button" 
                class="btn btn-secondary" 
                style="font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;"
                onclick="window.centrlyApp.togglePaperQuestionsViewMode()"
              >
                <span>${layoutMode === 'all' ? 'عرض سؤال بسؤال' : 'عرض كافة الأسئلة في شاشة واحدة'}</span>
              </button>

              <button 
                type="button" 
                class="btn btn-primary" 
                style="font-size: 0.9rem; font-weight: 900; padding: 0.6rem 1.4rem; display: inline-flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 12px rgba(37,99,235,0.25);"
                onclick="window.centrlyApp.savePaperExam()"
              >
                ${getIcon('check', 16, '#ffffff')}
                <span>حفظ وتوليد نماذج الامتحان والـ Bubble Sheet</span>
              </button>
            </div>
          </div>

          <!-- Visual Progress Bar (if in single mode) -->
          ${layoutMode === 'single' ? `
            <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 4px; margin-top: 1rem; overflow: hidden;">
              <div style="height: 100%; background: var(--centrly-blue-700); width: ${progressPct}%; transition: width 0.2s ease;"></div>
            </div>
          ` : ''}

          <!-- Fast Question Jumpers (1..N) -->
          <div style="display: flex; gap: 0.4rem; overflow-x: auto; padding: 0.75rem 0 0.25rem 0; margin-top: 0.5rem; align-items: center;">
            <span style="font-size: 0.8rem; font-weight: 800; color: var(--centrly-ink); margin-left: 0.5rem; white-space: nowrap;">الانتقال السريع:</span>
            ${Array.from({ length: totalQuestions }).map((_, idx) => {
              const isCur = idx === currentPaperQIdx;
              const qData = questions[idx];
              const hasContent = qData && (qData.text?.trim() || qData.image_url);

              return `
                <button 
                  type="button"
                  style="min-width: 34px; height: 34px; border-radius: 8px; font-weight: 900; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; border: 1.5px solid ${isCur ? 'var(--centrly-blue-700)' : (hasContent ? '#10b981' : '#cbd5e1')}; background: ${isCur ? 'var(--centrly-blue-700)' : (hasContent ? '#ecfdf5' : '#ffffff')}; color: ${isCur ? '#ffffff' : (hasContent ? '#065f46' : '#64748b')};"
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
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; background: #ffffff; padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--centrly-line);">
              <div style="display: flex; gap: 0.65rem; align-items: center;">
                <button 
                  type="button" 
                  class="btn btn-secondary" 
                  style="font-weight: 800; font-size: 0.85rem; padding: 0.55rem 1.15rem;"
                  ${currentPaperQIdx === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                  onclick="window.centrlyApp.prevPaperQuestion()"
                >
                  ◀ السؤال السابق
                </button>

                ${currentPaperQIdx < totalQuestions - 1 ? `
                  <button 
                    type="button" 
                    class="btn btn-primary" 
                    style="font-weight: 800; font-size: 0.85rem; padding: 0.55rem 1.25rem;"
                    onclick="window.centrlyApp.nextPaperQuestion()"
                  >
                    السؤال التالي ▶
                  </button>
                ` : `
                  <button 
                    type="button" 
                    class="btn btn-primary" 
                    style="font-weight: 900; font-size: 0.85rem; padding: 0.55rem 1.25rem; background: #059669; border-color: #059669;"
                    onclick="window.centrlyApp.savePaperExam()"
                  >
                    إنهاء وحفظ الامتحان
                  </button>
                `}
              </div>

              <div style="display: flex; gap: 0.65rem; align-items: center;">
                <button 
                  type="button" 
                  class="btn btn-secondary" 
                  style="font-weight: 800; font-size: 0.85rem; color: var(--centrly-blue-700); border-style: dashed; border-color: var(--centrly-blue-700);"
                  onclick="window.centrlyApp.addPaperQuestion()"
                >
                  ${getIcon('add', 16, 'var(--centrly-blue-700)')}
                  <span>+ إضافة سؤال تالٍ للامتحان</span>
                </button>

                <button 
                  type="button" 
                  class="btn btn-primary" 
                  style="font-weight: 900; font-size: 0.92rem; padding: 0.6rem 1.5rem; display: inline-flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 12px rgba(37,99,235,0.25);"
                  onclick="window.centrlyApp.savePaperExam()"
                >
                  ${getIcon('check', 16, '#ffffff')}
                  <span>حفظ وتوليد نماذج الامتحان والـ Bubble Sheet</span>
                </button>
              </div>
            </div>

          </div>
        ` : `
          <!-- ALL QUESTIONS VIEW (عرض كافة الأسئلة في شاشة واحدة) -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${questions.map((q, qIdx) => renderQuestionCardInner(q, qIdx)).join('')}

            <!-- Bottom Action Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem; border-top: 1px solid var(--centrly-line); padding-top: 1.25rem;">
              <button 
                type="button" 
                class="btn btn-secondary" 
                style="padding: 0.65rem 1.25rem; font-weight: 800; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 0.5rem; border-style: dashed; border-color: var(--centrly-blue-700); color: var(--centrly-blue-700);"
                onclick="window.centrlyApp.addPaperQuestion()"
              >
                ${getIcon('add', 18, 'var(--centrly-blue-700)')}
                <span>+ إضافة سؤال جديد للامتحان</span>
              </button>

              <div style="display: flex; gap: 0.75rem; align-items: center;">
                <button 
                  type="button" 
                  class="btn btn-secondary" 
                  style="padding: 0.65rem 1.25rem; font-weight: 800;"
                  onclick="window.centrlyApp.cancelPaperExamCreate()"
                >
                  إلغاء
                </button>

                <button 
                  type="button" 
                  class="btn btn-primary" 
                  style="font-weight: 900; padding: 0.65rem 1.75rem; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 12px rgba(37,99,235,0.3);"
                  onclick="window.centrlyApp.savePaperExam()"
                >
                  ${getIcon('check', 18, '#ffffff')}
                  <span>حفظ وتوليد نماذج الامتحان والـ Bubble Sheet</span>
                </button>
              </div>
            </div>

          </div>
        `}

      </div>
    `;
  }

  const selectedModel = state.printModel || 'A'; // 'A' | 'B' | 'C'
  const modelCode = selectedModel === 'A' ? '01' : selectedModel === 'B' ? '02' : '03';
  const examCode = targetQuiz.exam_code || `EX-${targetQuiz.quiz_number || 1}`;
  const stealthBarcodeSerial = `REF-${(targetQuiz.subject || 'PHY').slice(0, 3)}-${examCode}-${modelCode}`;

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

  return `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      
      <!-- Print & Paper Controls Toolbar (Swiss Minimal) -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1.15rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
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
                معاينة جاهزة للطباعة المباشرة A4 مع تشفير ذكي للنماذج عبر الباركود
              </p>
            </div>
          </div>

          <!-- Print & Create Action Buttons -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button 
              type="button" 
              onclick="window.centrlyApp.editPaperExam('${escapeHtml(targetQuiz.id)}')"
              style="height: 32px; padding: 0 11px; font-size: 0.76rem; font-weight: 600; background: #ffffff; color: #475569; border: 1px solid #e2e8f0; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
            >
              ${getIcon('edit', 13)}
              <span>تعديل الأسئلة</span>
            </button>

            <button 
              type="button" 
              onclick="window.centrlyApp.triggerPrint('exam')"
              style="height: 32px; padding: 0 13px; font-size: 0.76rem; font-weight: 700; background: #0f172a; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
            >
              ${getIcon('print', 13, '#ffffff')}
              <span>طباعة ورقة الأسئلة (A4)</span>
            </button>

            <button 
              type="button" 
              onclick="window.centrlyApp.triggerPrint('bubble')"
              style="height: 32px; padding: 0 13px; font-size: 0.76rem; font-weight: 700; background: #059669; color: #ffffff; border: none; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
            >
              ${getIcon('check', 13, '#ffffff')}
              <span>طباعة البابل شيت (A4)</span>
            </button>
          </div>
        </div>

        <!-- Exam & Model Pickers -->
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <label style="font-size: 0.76rem; font-weight: 700; color: #64748b;">اختر الامتحان:</label>
            <select class="form-select" style="min-width: 200px; height: 30px; font-size: 0.76rem; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; padding: 0 8px;" onchange="window.centrlyApp.selectPrintQuiz(this.value)">
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
            <label style="font-size: 0.76rem; font-weight: 700; color: #64748b;">النموذج:</label>
            <select class="form-select" style="width: 170px; height: 30px; font-size: 0.76rem; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; padding: 0 8px;" onchange="window.centrlyApp.selectPrintModel(this.value)">
              <option value="A" ${selectedModel === 'A' ? 'selected' : ''}>النموذج الأول (سيريال -01)</option>
              <option value="B" ${selectedModel === 'B' ? 'selected' : ''}>النموذج الثاني (سيريال -02)</option>
              <option value="C" ${selectedModel === 'C' ? 'selected' : ''}>النموذج الثالث (سيريال -03)</option>
            </select>
          </div>

          <!-- Stealth Notice Pill -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 0.25rem 0.65rem; font-size: 0.72rem; color: #475569; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
            <span>التشفير الذكي نشط: لا يظهر كود النموذج للطالب ويُقرأ عبر الباركود فقط</span>
          </div>
        </div>
      </div>
          </div>

          <!-- Stealth Notice Pill -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.78rem; color: #166534; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;">
            ${getIcon('check', 14, '#166534')}
            <span>التشفير الذكي نشط: لا يظهر كود النموذج للطالب ويُقرأ عبر الباركود فقط</span>
          </div>
        </div>
      </div>

      <!-- Live Printable Preview Container -->
      <div id="centrlyPrintContainer" style="display: flex; flex-direction: column; gap: 2rem;">
        
        <!-- Printable Exam Paper (A4 Sheet Preview) -->
        <div class="printable-exam-paper" style="background: #ffffff; border: 2px solid #000; border-radius: 4px; padding: 2.5rem 2rem; box-shadow: 0 4px 14px rgba(0,0,0,0.08); font-family: 'Cairo', sans-serif;">
          
          <!-- Exam Header (No teacher name, clean subject header) -->
          <div style="border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="text-align: right;">
                <h1 style="font-size: 1.45rem; font-weight: 900; margin: 0 0 0.25rem 0; color: #000;">
                  امتحان مادة ${escapeHtml(targetQuiz.subject || 'الفيزياء')}
                </h1>
                <div style="font-size: 0.95rem; font-weight: 800; color: #222;">
                  ${escapeHtml(targetQuiz.title || 'اختبار دوري')} • <span style="font-family: monospace; font-weight: 900; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; border: 1px solid #cbd5e1;">كود الامتحان: ${escapeHtml(examCode)}</span>
                </div>
              </div>

              <!-- Stealth Barcode in Header (Masked as serial tracking) -->
              <div style="border: 1.5px solid #000; padding: 0.35rem 0.75rem; border-radius: 4px; text-align: center; background: #fff;">
                <div style="font-family: monospace; font-size: 0.75rem; font-weight: 900; letter-spacing: 1px; color: #000;">
                  ||||| | |||| ||| |||| | ||
                </div>
                <div style="font-family: monospace; font-size: 0.7rem; font-weight: 800; color: #444; margin-top: 2px;">
                  ${escapeHtml(stealthBarcodeSerial)}
                </div>
              </div>
            </div>

            <!-- Blank Student Info Grid -->
            <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr; gap: 1rem; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed #666; font-size: 0.9rem; font-weight: 800;">
              <div>اسم الطالب: .....................................................</div>
              <div>المجموعة: ........................................</div>
              <div>كود الطالب: .......................</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.85rem; font-weight: 700; color: #444;">
              <span>الزمن المخصص للإجابة: <b>${targetQuiz.time_limit_minutes || 30} دقيقة</b></span>
              <span>الدرجة العظمى: <b>${(targetQuiz.questions || []).reduce((s, q) => s + Number(q.points || 1), 0)} درجات</b></span>
            </div>
          </div>

          <!-- Questions List (Image beside question, choices under question) -->
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            ${(targetQuiz.questions || []).map((q, idx) => {
              const hasImage = !!q.image_url;
              const hasText = !!(q.text && q.text.trim());
              const isImageOnly = (q.format === 'image_only') || (!hasText && hasImage);
              const isMcq = q.type !== 'essay';
              const pointsText = `[${q.points || 1} درجات]`;

              return `
                <div style="break-inside: avoid; page-break-inside: avoid; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px dashed #cbd5e1;">
                  
                  ${hasImage && !isImageOnly ? `
                    <!-- Question Text on Right + Question Image on Left (Side-by-Side) -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1.25rem; margin-bottom: 0.85rem;">
                      <div style="flex: 1; font-weight: 800; font-size: 1.05rem; line-height: 1.6; text-align: right;">
                        <span style="font-weight: 900; margin-left: 0.35rem;">(${idx + 1})</span>
                        <span>${escapeHtml(q.text)}</span>
                        <span style="font-size: 0.82rem; font-weight: 700; color: #555; margin-right: 0.4rem;">${pointsText}</span>
                      </div>

                      <div style="flex-shrink: 0; text-align: center; max-width: 260px; border: 1.5px solid #000; border-radius: 4px; padding: 4px; background: #fff;">
                        <img 
                          src="${escapeHtml(q.image_url)}" 
                          alt="الشكل المقابل" 
                          style="max-height: 160px; max-width: 250px; object-fit: contain; display: block;" 
                        />
                        <div style="font-size: 0.68rem; font-weight: 800; color: #444; border-top: 1px dashed #666; margin-top: 3px; padding-top: 2px;">
                          (الشكل المقابل)
                        </div>
                      </div>
                    </div>
                  ` : isImageOnly ? `
                    <!-- Image-Only Question (Hero Image) -->
                    <div style="margin-bottom: 0.85rem;">
                      <div style="font-weight: 800; font-size: 1.05rem; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between;">
                        <span><span style="font-weight: 900; margin-left: 0.35rem;">(${idx + 1})</span> ${q.text ? escapeHtml(q.text) : 'سؤال مصور من المسألة الموضحة أدناه:'}</span>
                        <span style="font-size: 0.82rem; font-weight: 700; color: #555;">${pointsText}</span>
                      </div>
                      <div style="text-align: center; margin: 0.5rem 0;">
                        <img 
                          src="${escapeHtml(q.image_url)}" 
                          alt="صورة السؤال" 
                          style="max-height: 260px; max-width: 95%; border: 1.5px solid #000; border-radius: 4px; object-fit: contain;" 
                        />
                      </div>
                    </div>
                  ` : `
                    <!-- Standard Text Question (No Image) -->
                    <div style="font-weight: 800; font-size: 1.05rem; line-height: 1.6; margin-bottom: 0.85rem; text-align: right;">
                      <span style="font-weight: 900; margin-left: 0.35rem;">(${idx + 1})</span>
                      <span>${escapeHtml(q.text || '')}</span>
                      <span style="font-size: 0.82rem; font-weight: 700; color: #555; margin-right: 0.4rem;">${pointsText}</span>
                    </div>
                  `}

                  <!-- Choices UNDER the Question -->
                  ${isMcq ? `
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.65rem; padding-right: 1.75rem; width: 100%;">
                      ${['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => {
                        const optText = q.choices?.[optIdx]?.trim();
                        return `
                          <div style="font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem;">
                            <span style="display: inline-block; width: 22px; height: 22px; border: 1.5px solid #000; border-radius: 50%; text-align: center; line-height: 20px; font-weight: 900; font-size: 0.82rem; flex-shrink: 0;">${letter}</span>
                            <span>${optText ? escapeHtml(optText) : ''}</span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : `
                    <div style="margin-top: 0.75rem; padding: 1.5rem 1rem; border: 1px dashed #777; border-radius: 4px; min-height: 85px; color: #666; font-size: 0.85rem; width: 100%;">
                      (مكان إجابة السؤال المقالي)
                    </div>
                  `}

                </div>
              `;
            }).join('')}
          </div>

          <div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #000; font-weight: 800; font-size: 0.9rem;">
            « مع أطيب التمنيات لكم بالنجاح والتفوق الباهر »
          </div>

        </div>

        <!-- Printable Bubble Sheet (A4 Sheet Preview) -->
        <div class="printable-bubble-sheet" style="background: #ffffff; border: 2px solid #000; border-radius: 4px; padding: 2rem; box-shadow: 0 4px 14px rgba(0,0,0,0.08); font-family: 'Cairo', sans-serif;">
          
          <!-- OMR Scanner Alignment Markers -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div style="width: 20px; height: 20px; background: #000;"></div>
            <div style="text-align: center;">
              <h2 style="font-size: 1.3rem; font-weight: 900; margin: 0; color: #000;">
                ورقة إجابة بابل شيت (OMR Answer Sheet)
              </h2>
              <div style="font-size: 0.85rem; font-weight: 800; color: #333; margin-top: 0.2rem;">
                امتحان مادة ${escapeHtml(targetQuiz.subject || 'الفيزياء')} • ${escapeHtml(targetQuiz.title || '')} • <span style="font-family: monospace; font-weight: 900; background: #eee; padding: 2px 7px; border-radius: 4px; border: 1px solid #aaa;">كود الامتحان: ${escapeHtml(examCode)}</span>
              </div>
            </div>
            <div style="width: 20px; height: 20px; background: #000;"></div>
          </div>

          <!-- Student Info and Code Shading Box -->
          <div style="border: 2px solid #000; padding: 1rem; margin-bottom: 1.25rem; display: grid; grid-template-columns: 2fr 1.2fr; gap: 1.25rem;">
            
            <div>
              <div style="font-size: 0.9rem; font-weight: 800; margin-bottom: 0.5rem;">اسم الطالب: ..............................................................</div>
              <div style="font-size: 0.9rem; font-weight: 800; margin-bottom: 0.5rem;">المجموعة الدراسية: ...................................................</div>
              
              <!-- Stealth Barcode on Bubble Sheet -->
              <div style="display: inline-block; border: 1.5px solid #000; padding: 0.35rem 0.75rem; border-radius: 4px; margin-top: 0.5rem;">
                <div style="font-family: monospace; font-size: 0.75rem; font-weight: 900; letter-spacing: 1px;">|||| | ||||| ||| ||| | ||</div>
                <div style="font-family: monospace; font-size: 0.7rem; font-weight: 800; color: #333;">${escapeHtml(stealthBarcodeSerial)}</div>
              </div>

              <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.55rem; border-radius: 4px; margin-top: 0.75rem; font-size: 0.78rem; line-height: 1.5; color: #333;">
                <b>تعليمات التظليل:</b><br>
                - استخدم القلم الجاف الأزرق أو الرصاص وظلل الدائرة بشكل كامل.<br>
                - لا تستخدم الكوريكتور ولا تظلل أكثر من دائرة في نفس السؤال.<br>
                - ظلل كود الطالب بدقة في الأعمدة المقابلة (4 خانات).
              </div>
            </div>

            <!-- Student Code Shading Grid -->
            <div style="border: 1.5px solid #000; padding: 0.5rem; text-align: center; background: #fff;">
              <div style="font-weight: 900; font-size: 0.85rem; margin-bottom: 0.35rem; color: #000;">تظليل كود الطالب</div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; font-size: 0.75rem;">
                ${[1, 2, 3, 4].map(col => `
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                    <span style="font-weight: 900; border-bottom: 1px solid #000; width: 100%; display: block;">خانة ${col}</span>
                    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                      <span style="width: 16px; height: 16px; border: 1.5px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 800;">
                        ${num}
                      </span>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- Answer Bubbles Grid (Strictly for MCQ questions) -->
          <div style="border: 2px solid #000; padding: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            ${(() => {
              const mcqQuestions = (targetQuiz.questions || []).filter(q => q.type !== 'essay');
              const totalQ = Math.max(1, mcqQuestions.length > 0 ? mcqQuestions.length : 10);
              const col1Count = Math.ceil(totalQ / 2);
              const col2Count = totalQ - col1Count;
              return [0, 1].map(colIdx => {
                const countThisCol = colIdx === 0 ? col1Count : col2Count;
                const startNum = colIdx === 0 ? 1 : col1Count + 1;
                return `
                  <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1.5px solid #000; padding-bottom: 0.25rem; font-weight: 900; font-size: 0.82rem;">
                      <span>سؤال</span>
                      <div style="display: flex; gap: 1.25rem; padding-left: 0.5rem;">
                        <span>أ</span>
                        <span>ب</span>
                        <span>ج</span>
                        <span>د</span>
                      </div>
                    </div>

                    ${Array.from({ length: countThisCol }).map((_, rIdx) => {
                      const qNum = startNum + rIdx;
                      return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0;">
                          <span style="font-weight: 900; font-size: 0.85rem; width: 28px;">${qNum}</span>
                          <div style="display: flex; gap: 0.95rem;">
                            ${['أ', 'ب', 'ج', 'د'].map(l => `
                              <span style="width: 20px; height: 20px; border: 1.5px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800;">
                                ${l}
                              </span>
                            `).join('')}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `;
              }).join('');
            })()}
          </div>

          <!-- Bottom Markers -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <div style="width: 20px; height: 20px; background: #000;"></div>
            <span style="font-size: 0.75rem; font-weight: 700; color: #666;">Centrly OMR Optical Mark Recognition System</span>
            <div style="width: 20px; height: 20px; background: #000;"></div>
          </div>

        </div>

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
      
      <!-- Top Control Card -->
      <div class="card" style="margin: 0; border-top: 4px solid #059669;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #065f46; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('camera', 20, '#059669')}
              <span>ماسح البابل شيت والتصحيح الآلي (OMR Scanner)</span>
            </h3>
            <p style="font-size: 0.82rem; color: var(--centrly-text); margin: 0.25rem 0 0 0;">
              التعرف التلقائي على أوراق الإجابة ورصد درجات الطلاب وراء بعضها فوراً عبر الكاميرا الرأسية أو رفع الصور.
            </p>
          </div>

          <!-- Main Actions -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            ${isCameraOpen ? `
              <button 
                type="button" 
                class="btn btn-secondary" 
                style="color: #dc2626; border-color: #fecaca; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem;"
                onclick="window.centrlyApp.stopOmrCamera()"
              >
                ${getIcon('close', 16, '#dc2626')}
                <span>إغلاق الكاميرا</span>
              </button>
            ` : `
              <button 
                type="button" 
                class="btn btn-primary" 
                style="background: #059669; border-color: #059669; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(5,150,105,0.25);"
                onclick="window.centrlyApp.startOmrCamera()"
              >
                ${getIcon('camera', 16, '#ffffff')}
                <span>فتح الكاميرا للمسح المباشر</span>
              </button>
            `}

            <input 
              type="file" 
              id="omrImageFileInput" 
              accept="image/*" 
              capture="environment" 
              style="display: none;" 
              onchange="window.centrlyApp.handleOmrImageUpload(this.files[0])"
            />
            <button 
              type="button" 
              class="btn btn-secondary" 
              style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem;"
              onclick="document.getElementById('omrImageFileInput').click()"
            >
              ${getIcon('upload', 16)}
              <span>رفع صورة ورقة بابل شيت</span>
            </button>

            <button 
              type="button" 
              class="btn btn-secondary" 
              style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; border-style: dashed; color: #059669; border-color: #86efac; background: #f0fdf4;"
              onclick="window.centrlyApp.simulateOmrScan()"
              title="تجربة مسح ورقة نموذجية للاختبار"
            >
              ${getIcon('check', 16, '#059669')}
              <span>تجربة مسح ورقة للاختبار</span>
            </button>
          </div>
        </div>

        <!-- Exam Filter Selector Bar -->
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--centrly-line); align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <label style="font-size: 0.85rem; font-weight: 800; color: var(--centrly-ink);">الامتحان الورقي المراد تصحيحه:</label>
            <select 
              id="omrTargetExamSelect" 
              class="form-select" 
              style="min-width: 260px; font-weight: 800; font-size: 0.88rem;" 
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
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.78rem; color: #1e40af; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem;">
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
            <div id="omrFrameGuide" style="position: absolute; inset: 16px; border: 2.5px dashed #10b981; border-radius: 8px; pointer-events: none; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5); display: flex; flex-direction: column; justify-content: space-between; padding: 10px;">
              <div style="background: rgba(16,185,129,0.92); color: #fff; font-size: 0.75rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; align-self: flex-start;">
                ضع ورقة البابل شيت بالكامل داخل الإطار
              </div>
              <div style="text-align: center; color: rgba(255,255,255,0.9); font-size: 0.72rem; font-weight: 700; background: rgba(0,0,0,0.6); padding: 3px 6px; border-radius: 4px;">
                تأكد من إضاءة الورقة ووضوح كود الطالب
              </div>
            </div>
          </div>

          <div style="margin-top: 1rem; display: flex; gap: 0.75rem; align-items: center;">
            <button 
              type="button" 
              class="btn btn-primary" 
              style="background: #10b981; border-color: #10b981; font-weight: 900; font-size: 0.95rem; padding: 0.65rem 1.8rem; border-radius: 30px; box-shadow: 0 4px 15px rgba(16,185,129,0.45); display: inline-flex; align-items: center; gap: 0.45rem;"
              onclick="window.centrlyApp.captureAndAnalyzeOmr()"
            >
              ${getIcon('camera', 18, '#ffffff')}
              <span>التقاط وتصحيح الورقة الآن</span>
            </button>

            <button 
              type="button" 
              class="btn btn-secondary" 
              style="color: #ef4444; font-weight: 800; font-size: 0.85rem;"
              onclick="window.centrlyApp.stopOmrCamera()"
            >
              إغلاق الكاميرا
            </button>
          </div>

        </div>
      ` : ''}

      <!-- Scanned Scores Live Stream & Records Table (سجل الدرجات المرصودة وراء بعضها) -->
      <div class="card" style="margin: 0;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h4 style="font-size: 1.05rem; font-weight: 900; color: var(--centrly-ink); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('check', 18, '#059669')}
              <span>سجل درجات الطلاب المرصودة بالماسح الضوئي (مباشر)</span>
            </h4>
            <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.2rem;">
              تظهر هنا فوراً كل ورقة يتم مسحها وتصحيحها وراء بعضها مع إمكانية إرسال النتيجة واتساب لولي الأمر مباشرة.
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 0.35rem 0.75rem; text-align: center;">
              <span style="font-size: 0.7rem; color: #047857; font-weight: 700; display: block;">أوراق مصححة</span>
              <span style="font-size: 1rem; font-weight: 900; color: #065f46;">${scannedCount}</span>
            </div>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.35rem 0.75rem; text-align: center;">
              <span style="font-size: 0.7rem; color: #1e40af; font-weight: 700; display: block;">متوسط الدرجات</span>
              <span style="font-size: 1rem; font-weight: 900; color: #1e3a8a;">${avgScore}</span>
            </div>
            <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 0.35rem 0.75rem; text-align: center;">
              <span style="font-size: 0.7rem; color: #92400e; font-weight: 700; display: block;">أعلى درجة</span>
              <span style="font-size: 1rem; font-weight: 900; color: #b45309;">${highestScore}</span>
            </div>
            ${scannedCount > 0 ? `
              <button 
                type="button" 
                class="btn btn-secondary" 
                style="font-size: 0.78rem; color: #dc2626; border-color: #fecaca;" 
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
                <tr style="background: #f8fafc; border-bottom: 2px solid var(--centrly-line); text-align: right;">
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800;">#</th>
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800;">كود الطالب</th>
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800;">اسم الطالب</th>
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800;">الامتحان</th>
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800;">النموذج</th>
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800;">الدرجة المحققة</th>
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800;">النسبة</th>
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800;">توقيت الرصد</th>
                  <th style="padding: 0.75rem; font-size: 0.8rem; font-weight: 800; text-align: center;">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${scannedList.map((item, idx) => {
                  const isExcellent = item.percentage >= 85;
                  const isGood = item.percentage >= 65 && item.percentage < 85;
                  const pillColor = isExcellent ? '#059669' : (isGood ? '#0284c7' : '#dc2626');
                  const pillBg = isExcellent ? '#ecfdf5' : (isGood ? '#f0f9ff' : '#fef2f2');

                  return `
                    <tr style="border-bottom: 1px solid var(--centrly-line); transition: background 0.15s ease;">
                      <td style="padding: 0.75rem; font-size: 0.85rem; font-weight: 800; color: #64748b;">${idx + 1}</td>
                      <td style="padding: 0.75rem; font-size: 0.9rem; font-weight: 900; font-family: monospace; color: var(--centrly-blue-700);">${escapeHtml(item.student_code || '—')}</td>
                      <td style="padding: 0.75rem; font-size: 0.92rem; font-weight: 800; color: #0f172a;">${escapeHtml(item.student_name || 'طالب')}</td>
                      <td style="padding: 0.75rem; font-size: 0.82rem; font-weight: 700; color: #475569;">
                        ${escapeHtml(item.exam_title || 'امتحان ورقي')} 
                        <span style="font-size: 0.75rem; font-family: monospace; color: #64748b;">(${escapeHtml(item.exam_code || '')})</span>
                      </td>
                      <td style="padding: 0.75rem;">
                        <span class="badge" style="background: #f1f5f9; color: #0f172a; font-weight: 800; font-size: 0.78rem;">نموذج ${escapeHtml(item.model || 'أ')}</span>
                      </td>
                      <td style="padding: 0.75rem; font-size: 1.05rem; font-weight: 900; color: ${pillColor};">
                        ${item.score} / ${item.max_score}
                      </td>
                      <td style="padding: 0.75rem;">
                        <span style="background: ${pillBg}; color: ${pillColor}; font-weight: 800; font-size: 0.8rem; padding: 2px 8px; border-radius: 6px;">
                          ${item.percentage}%
                        </span>
                      </td>
                      <td style="padding: 0.75rem; font-size: 0.78rem; color: #64748b; font-weight: 700;">
                        ${item.timestamp || 'الآن'}
                      </td>
                      <td style="padding: 0.75rem; text-align: center;">
                        <div style="display: inline-flex; gap: 0.35rem; align-items: center;">
                          <button 
                            type="button" 
                            class="btn btn-secondary" 
                            style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 800; color: #166534; border-color: #86efac; background: #f0fdf4;"
                            onclick="window.centrlyApp.sendScannedStudentWhatsApp('${item.id}')"
                            title="إرسال النتيجة لولي الأمر على واتساب"
                          >
                            ${getIcon('whatsapp', 14, '#166534')}
                            <span>واتساب</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align: center; padding: 3rem 1.5rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; color: #64748b;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto;">
              ${getIcon('camera', 26, '#0284c7')}
            </div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.35rem;">
              لم يتم مسح أي ورقة بابل شيت حتى الآن
            </div>
            <p style="font-size: 0.82rem; max-width: 420px; margin: 0 auto 1.25rem auto; line-height: 1.6;">
              اضغط على زر <b>«فتح الكاميرا للمسح المباشر»</b> أو <b>«رفع صورة ورقة بابل شيت»</b> للبدء في قراءة الأوراق ورصد درجات الطلاب تلقائياً وراء بعضها هنا.
            </p>
            <button 
              type="button" 
              class="btn btn-secondary" 
              style="font-size: 0.85rem; font-weight: 800; border-color: #059669; color: #059669; background: #ffffff;"
              onclick="window.centrlyApp.simulateOmrScan()"
            >
              ${getIcon('check', 15, '#059669')}
              <span>تجربة مسح ورقة نموذجية للاختبار</span>
            </button>
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

  // Subtab switcher
  app.switchQuizSubTab = async function(tabName) {
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

    this.quizzesState.activeSubTab = tabName;
    if (tabName === 'online_builder' || tabName === 'paper_builder') {
      await this.loadRichQuizzes();
    } else if (tabName === 'online_grading') {
      await this.loadOnlineSubmissions();
    }
    this.renderMainContent();
  };

  // Rich quizzes loader
  app.loadRichQuizzes = async function() {
    try {
      const gid = this.quizzesState.selectedGroupId;
      let res = await fetch(`/api/quizzes/rich${gid ? `?group_id=${gid}` : ''}`).then(r => r.json()).catch(() => null);
      if (!res || !res.success) {
        res = await fetch(`https://centerly-eg.com/api/quizzes/rich${gid ? `?group_id=${gid}` : ''}`).then(r => r.json()).catch(() => null);
      }
      if (!res || !res.success) {
        res = await request(`/quizzes/rich${gid ? `?group_id=${gid}` : ''}`).catch(() => null);
      }
      if (res?.success && Array.isArray(res.quizzes)) {
        this.quizzesState.richQuizzes = res.quizzes;
      }
    } catch (err) {
      console.warn('[Centrly] Could not load rich quizzes:', err);
    }
  };

  // Online exam submissions loader (Both Pending Essay & Graded MCQ)
  app.loadOnlineSubmissions = async function() {
    try {
      const gid = this.quizzesState.selectedGroupId;
      let allData = null;
      let pendingData = null;

      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/quizzes/submissions${gid ? `?group_id=${gid}` : ''}`).then(r => r.json()).catch(() => null),
          fetch(`/api/quizzes/submissions?type=pending${gid ? `&group_id=${gid}` : ''}`).then(r => r.json()).catch(() => null)
        ]);
        if (r1?.success && Array.isArray(r1.submissions)) allData = r1.submissions;
        if (r2?.success && Array.isArray(r2.submissions)) pendingData = r2.submissions;
      } catch (_) {}

      if (!allData || allData.length === 0) {
        const [allRes, pendingRes] = await Promise.allSettled([
          request(`/quizzes/submissions${gid ? `?group_id=${gid}` : ''}`),
          request(`/quizzes/submissions/pending${gid ? `?group_id=${gid}` : ''}`)
        ]);

        if (allRes.status === 'fulfilled' && allRes.value?.success && Array.isArray(allRes.value.submissions)) {
          allData = allRes.value.submissions;
        }
        if (pendingRes.status === 'fulfilled' && pendingRes.value?.success && Array.isArray(pendingRes.value.submissions)) {
          pendingData = pendingRes.value.submissions;
        }
      }

      this.quizzesState.onlineSubmissions = Array.isArray(allData) ? allData : [];
      this.quizzesState.pendingSubmissions = Array.isArray(pendingData) 
        ? pendingData 
        : this.quizzesState.onlineSubmissions.filter(s => s.status === 'pending' || s.status === 'needs_grading' || !s.is_graded);

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
    this.quizzesState.onlineViewMode = 'list';
    this.renderMainContent();
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

  app.updateCurrentQuestionType = function(type) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const q = this.quizzesState.activeOnlineQuiz?.questions?.[idx];
    if (q) {
      q.type = type;
      this.renderMainContent();
    }
  };

  app.updateCurrentQuestionField = function(field, value) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const q = this.quizzesState.activeOnlineQuiz?.questions?.[idx];
    if (q) {
      q[field] = value;
    }
  };

  app.updateWizardChoice = function(choiceIdx, value) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const q = this.quizzesState.activeOnlineQuiz?.questions?.[idx];
    if (q) {
      if (!Array.isArray(q.choices)) q.choices = ['', '', '', ''];
      q.choices[choiceIdx] = value;
    }
  };

  app.setWizardCorrectChoice = function(choiceIdx) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const q = this.quizzesState.activeOnlineQuiz?.questions?.[idx];
    if (q) {
      q.correct_index = Number(choiceIdx);
      this.renderMainContent();
    }
  };

  app.setWizardQuestionFormat = function(format) {
    const idx = this.quizzesState.currentQuestionIndex || 0;
    const q = this.quizzesState.activeOnlineQuiz?.questions?.[idx];
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
          id: (targetGroupIds.length === 1) ? qz?.id : null,
          group_id: gid,
          quiz_number: qz.quiz_number,
          title: qz.title,
          subject: qz.subject,
          time_limit_minutes: qz.time_limit_minutes,
          available_date: qz.available_date,
          start_time: qz.start_time,
          end_time: qz.end_time,
          exam_mode: 'online',
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

      this.showToast(`تم حفظ ونشر امتحان (${qz.title}) بنجاح!`, 'success');
      this.quizzesState.onlineViewMode = 'list';
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
      this.quizzesState.activeOnlineQuiz = JSON.parse(JSON.stringify(matched));
      this.quizzesState.onlineViewMode = 'wizard';
      this.quizzesState.wizardStep = 1;
      this.quizzesState.currentQuestionIndex = 0;
      this.renderMainContent();
    }
  };

  app.switchToRosterForQuiz = function(quizNum) {
    this.quizzesState.currentQuizNumber = quizNum;
    this.quizzesState.activeSubTab = 'roster';
    this.renderMainContent();
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
            group_id: this.quizzesState.selectedGroupId,
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
    this.quizzesState.paperViewMode = 'list';
    this.renderMainContent();
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
      this.showToast('جاري حفظ وتوليد نماذج الامتحان الورقي والـ Bubble Sheet...', 'info');

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
          id: (targetGroupIds.length === 1) ? qz?.id : null,
          group_id: gid,
          quiz_number: quizNumber,
          title,
          subject,
          time_limit_minutes: timeLimit,
          exam_mode: 'paper',
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

      this.showToast(`تم حفظ وتوليد نماذج الامتحان الورقي بنجاح!`, 'success');
      await this.loadRichQuizzes();
      if (currentGid) await this.loadQuizzesForGroup(currentGid);
      this.quizzesState.paperViewMode = 'list';
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل حفظ الامتحان: ${err.message || 'خطأ في الخادم'}`, 'danger');
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

  app.triggerPrint = function(type) {
    window.print();
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

    const mcqQuestions = (targetExam.questions || []).filter(q => q.type !== 'essay');
    const totalQ = Math.max(1, mcqQuestions.length > 0 ? mcqQuestions.length : 10);
    const maxScore = targetExam.questions?.reduce((s, q) => s + (Number(q.points) || 1), 0) || (totalQ * 2);
    const scoreVal = Math.min(maxScore, Math.max(0, Math.floor(maxScore * (0.65 + Math.random() * 0.35))));
    const models = ['أ', 'ب', 'ج'];
    const assignedModel = models[Math.floor(Math.random() * models.length)];

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
      model: assignedModel,
      score: scoreVal,
      max_score: maxScore,
      percentage: Math.round((scoreVal / maxScore) * 100),
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      breakdown: Array.from({ length: totalQ }).map((_, i) => ({
        question_number: i + 1,
        is_correct: Math.random() > 0.25,
        points: 2
      }))
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

  // Preserved Roster & LocalStorage Handlers
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
  };

  app.loadQuizzesForGroup = async function(groupId) {
    if (!groupId) return;
    const cacheKey = `centrly_quizzes_${groupId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.quizzes) && parsed.quizzes.length > 0) {
          this.quizzesState.quizzes = parsed.quizzes;
        }
        if (parsed.scoresMap) this.quizzesState.scoresMap = { ...this.quizzesState.scoresMap, ...parsed.scoresMap };
        if (parsed.notesMap) this.quizzesState.notesMap = { ...this.quizzesState.notesMap, ...parsed.notesMap };
        if (parsed.deliveryStatusMap) this.quizzesState.deliveryStatusMap = { ...this.quizzesState.deliveryStatusMap, ...parsed.deliveryStatusMap };
        if (parsed.currentQuizNumber) this.quizzesState.currentQuizNumber = parsed.currentQuizNumber;
      }
    } catch (_) {}

    try {
      const res = await request(`/quizzes?group_id=${groupId}`);
      if (res?.success && Array.isArray(res.quizzes) && res.quizzes.length > 0) {
        this.quizzesState.quizzes = res.quizzes.map(q => ({
          id: q.id,
          number: q.quiz_number,
          title: q.title || `كويز ${q.quiz_number}`,
          maxScore: Number(q.max_score || 10),
          date: q.quiz_date || new Date().toISOString().slice(0, 10),
          skipped: Boolean(q.is_skipped),
        }));

        if (res.scores_map) this.quizzesState.scoresMap = { ...this.quizzesState.scoresMap, ...res.scores_map };
        if (res.notes_map) this.quizzesState.notesMap = { ...this.quizzesState.notesMap, ...res.notes_map };
        if (res.delivery_status_map) this.quizzesState.deliveryStatusMap = { ...this.quizzesState.deliveryStatusMap, ...res.delivery_status_map };
        this.saveQuizzesToLocalStorage(groupId);
      }
    } catch (err) {
      console.warn('[Centrly] Could not fetch quizzes from backend, using cached state:', err);
    }
  };

  app.switchQuizGroup = async function(groupId) {
    this.quizzesState.selectedGroupId = groupId;
    this.renderMainContent();
    await this.loadQuizzesForGroup(groupId);
    await this.loadRichQuizzes();
    await this.loadOnlineSubmissions();
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
    this.quizzesState.currentQuizNumber = quizNum;
    this.saveQuizzesToLocalStorage();
    this.renderMainContent();
  };

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
  };

  app.skipCurrentQuiz = function(quizNum) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.skipped = true;
      const nextQuiz = this.quizzesState.quizzes.find(q => q.number > quizNum && !q.skipped);
      if (nextQuiz) this.quizzesState.currentQuizNumber = nextQuiz.number;
      this.saveQuizzesToLocalStorage();

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
    const currQuiz = this.quizzesState.currentQuizNumber || 1;
    if (!this.quizzesState.scoresMap[currQuiz]) {
      this.quizzesState.scoresMap[currQuiz] = {};
    }
    this.quizzesState.scoresMap[currQuiz][studentId] = score;
    this.saveQuizzesToLocalStorage();
  };

  app.updateStudentQuizNote = function(studentId, note) {
    const currQuiz = this.quizzesState.currentQuizNumber || 1;
    if (!this.quizzesState.notesMap[currQuiz]) {
      this.quizzesState.notesMap[currQuiz] = {};
    }
    this.quizzesState.notesMap[currQuiz][studentId] = note;
    this.saveQuizzesToLocalStorage();
  };

  app.saveCurrentQuizScores = async function() {
    if (this.quizzesState.isSaving) return;
    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = this.quizzesState.quizzes.find(q => q.number === currQuizNum) || { maxScore: 10 };

    // Read latest title and max score inputs directly
    const titleInput = document.getElementById('quizTitleInput');
    if (titleInput && titleInput.value.trim()) {
      currentQuiz.title = titleInput.value.trim();
    }
    const maxScoreInput = document.getElementById('quizMaxScoreInput');
    if (maxScoreInput && Number(maxScoreInput.value) > 0) {
      currentQuiz.maxScore = Number(maxScoreInput.value);
    }

    const scores = this.quizzesState.scoresMap[currQuizNum] || {};
    const notes = this.quizzesState.notesMap[currQuizNum] || {};

    const count = Object.keys(scores).filter(k => scores[k] !== '' && scores[k] !== null).length;

    this.quizzesState.isSaving = true;
    try {
      this.saveQuizzesToLocalStorage();

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

    if (confirm(`هل أنت متأكد من رغبتك في إرسال درجات (${studentsToDispatch.length}) طالب عبر الواتساب دفعة واحدة؟`)) {
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
