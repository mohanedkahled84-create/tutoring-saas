import { request } from "../services/api.js";
import { normalizeDigits } from "../utils/normalizeDigits.js";
import { renderStudentSearchBar } from "./StudentSearchBar.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Students Directory Component (DEV-89)
 * Clean vector icons, mandatory student phone, cards navigation, and direct parent notes.
 */

export function renderStudentsView(students = [], groups = [], isLoading = false, billing = {}, hasLoaded = true) {
  const studentList = students || [];
  const unsentCount = studentList.filter(s => 
    (!s.parent_portal_sent_at || !s.student_portal_sent_at) && 
    ((s.parentPhone || s.parent_phone) || (s.studentPhone || s.student_phone))
  ).length;

  const currentCount = studentList.length;
  const appObj = typeof window !== 'undefined' ? window.centrlyApp : null;
  let activeGroupFilter = appObj?.studentsGroupFilter;
  if (activeGroupFilter === undefined || activeGroupFilter === null) {
    try {
      activeGroupFilter = sessionStorage.getItem('centrly_students_group_filter') || '';
    } catch (_) {
      activeGroupFilter = '';
    }
  }
  let activeSearchQuery = appObj?.studentsSearchQuery || '';
  const billingData = billing || appObj?.billingState || {};
  const isPaidActive = Boolean(
    (appObj?.isUserSubscribed && appObj.isUserSubscribed()) ||
    billingData.is_paid_active === true ||
    billingData.subscription_status === 'active' ||
    billingData.status === 'active' ||
    (billingData.subscription_ends_at && new Date(billingData.subscription_ends_at).getTime() > Date.now()) ||
    (Array.isArray(billingData.payment_proofs) && billingData.payment_proofs.some(p => p.status === 'approved')) ||
    appObj?.user?.role === 'admin'
  );
  const studentLimit = billingData.students_limit || 300;
  const ratio = studentLimit > 0 ? (currentCount / studentLimit) : 0;
  const isApproaching = ratio >= 0.85 && ratio < 1.0;
  const isReachedOrExceeded = currentCount >= studentLimit;

  // Track when limit was first reached in localStorage for 3-day grace period calculation
  let graceDaysLeft = 3;
  let isGraceExpired = false;
  try {
    if (isReachedOrExceeded) {
      const storageKey = 'centrly_quota_exceeded_timestamp';
      let reachedTimestamp = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (!reachedTimestamp) {
        reachedTimestamp = Date.now().toString();
        if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, reachedTimestamp);
      }
      const elapsedDays = (Date.now() - Number(reachedTimestamp)) / (1000 * 60 * 60 * 24);
      if (elapsedDays > 3) {
        isGraceExpired = true;
        graceDaysLeft = 0;
      } else {
        graceDaysLeft = Math.max(1, Math.ceil(3 - elapsedDays));
      }
    } else {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('centrly_quota_exceeded_timestamp');
    }
  } catch (_) {}

  let quotaBannerHtml = '';
  if (isReachedOrExceeded) {
    if (isGraceExpired) {
      quotaBannerHtml = `
        <div class="card" style="margin: 0; background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 12px; padding: 1rem 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="display: flex; align-items: center;">${getIcon('alertTriangle', 28, '#dc2626')}</div>
              <div>
                <div style="font-weight: 800; color: #991b1b; font-size: 0.95rem;">تم إيقاف إضافة طلاب جدد مؤقتاً (استنفاد المقاعد وانتهاء مهلة السماح)</div>
                <div style="font-size: 0.825rem; color: #b91c1c; margin-top: 0.2rem;">
                  لقد استهلكت كامل سعة باقتك (${currentCount} من ${studentLimit} طالب) وانتهت فترة السماح المحددة بـ 3 أيام. لمتابعة تسجيل طلاب جدد، يرجى الترقية إلى باقة 750 أو 1500 طالب.
                </div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('billing')" style="background: #dc2626; border-color: #dc2626; font-weight: 800; padding: 0.5rem 1rem;">
              ترقية الباقة الآن
            </button>
          </div>
        </div>
      `;
    } else {
      quotaBannerHtml = `
        <div class="card" style="margin: 0; background: #fff7ed; border: 1.5px solid #fdba74; border-radius: 12px; padding: 1rem 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="display: flex; align-items: center;">${getIcon('alertTriangle', 28, '#ea580c')}</div>
              <div>
                <div style="font-weight: 800; color: #9a3412; font-size: 0.95rem;">تنبيه فترة سماح: تم الوصول للحد الأقصى للباقة (${currentCount} / ${studentLimit} طالب)</div>
                <div style="font-size: 0.825rem; color: #c2410c; margin-top: 0.2rem;">
                  أنت الآن في فترة سماح استثنائية (متبقي <strong>${graceDaysLeft} أيام</strong>). يمكنك إضافة طلاب مؤقتاً، ولكن بادر بالترقية قبل انتهاء المهلة لضمان عدم توقف التسجيل.
                </div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('billing')" style="background: #ea580c; border-color: #ea580c; font-weight: 800; padding: 0.5rem 1rem;">
              ترقية الباقة قبل الإيقاف
            </button>
          </div>
        </div>
      `;
    }
  } else if (isApproaching) {
    quotaBannerHtml = `
      <div class="card" style="margin: 0; background: #fefce8; border: 1.5px solid #fde047; border-radius: 12px; padding: 0.85rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="display: flex; align-items: center;">${getIcon('alertTriangle', 22, '#ca8a04')}</div>
            <div>
              <div style="font-weight: 800; color: #854d0e; font-size: 0.9rem;">اقتربت من السعة القصوى للباقة (${currentCount} / ${studentLimit} طالب)</div>
              <div style="font-size: 0.8rem; color: #a16207; margin-top: 0.15rem;">
                متبقي لديك <strong>${studentLimit - currentCount} مقاعد</strong> فقط. سارع بترقية باقتك للاستمرار بإضافة الطلاب بسلاسة دون قيود.
              </div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('billing')" style="font-weight: 800; font-size: 0.8rem;">
            ترقية الباقة
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      ${quotaBannerHtml}

      <!-- Top Action Bar (Swiss Minimalist) -->
      <div class="card" style="margin: 0; padding: 0.85rem 1.15rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <h2 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a;">
                دليل الطلاب وقاعدة البيانات
              </h2>
              <span style="font-size: 0.72rem; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                ${(!hasLoaded || isLoading) ? 'جارٍ التحميل...' : `المقاعد: ${currentCount} / ${studentLimit}`}
              </span>
            </div>
            <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #64748b;">
              إدارة بيانات الطلاب، الحسابات، كروت الباركود، وبوابات المتابعة
            </p>
          </div>

          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-secondary" onclick="window.centrlyApp.openBatchPortalLinksModal()" style="height: 30px; font-size: 0.76rem; font-weight: 600;" title="${isPaidActive ? 'إرسال روابط المتابعة والمنصة للطلاب الجدد' : 'ميزة خاصة بالمشتركين: إرسال روابط المتابعة والمنصة'}">
              ${getIcon('whatsapp', 14, '#166534')}
              <span>إرسال الروابط</span>
              ${!isPaidActive 
                ? `<span style="display: inline-flex; align-items: center; color: #f59e0b;">${getIcon('crown', 12, '#f59e0b')}</span>`
                : (unsentCount > 0 
                  ? `<span style="background: #ef4444; color: #fff; font-size: 0.65rem; padding: 1px 5px; border-radius: 6px; font-weight: 800;">${unsentCount}</span>` 
                  : `<span style="background: #ecfdf5; color: #065f46; font-size: 0.65rem; padding: 1px 5px; border-radius: 6px; font-weight: 800;">✔</span>`)
              }
            </button>
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddStudentModal()" style="height: 30px; font-size: 0.76rem; font-weight: 700;">
              ${getIcon('add', 14, '#ffffff')}
              <span>طالب جديد</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.navigate('student-cards')" style="height: 30px; font-size: 0.76rem; font-weight: 600;">
              ${getIcon('cards', 14)}
              <span>كروت الطلاب</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.openImportModal()" style="height: 30px; font-size: 0.76rem; font-weight: 600;">
              ${getIcon('download', 14)}
              <span>استيراد Excel</span>
            </button>
          </div>
        </div>

        <!-- Search & Filter Controls -->
        <div style="display: flex; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap; align-items: center;">
          <div style="flex: 2; min-width: 240px;">
            ${renderStudentSearchBar({
              id: "studentSearchInput",
              placeholder: "ابحث بالاسم، كود الطالب، أو رقم الهاتف...",
              value: activeSearchQuery,
              onInputHandler: "window.centrlyApp.filterStudentsTable()",
            })}
          </div>
          <select id="studentGroupFilter" class="form-select" style="flex: 1; min-width: 180px;" onchange="window.centrlyApp.filterStudentsTable()">
            <option value="" ${!activeGroupFilter ? 'selected' : ''}>جميع المجاميع</option>
            ${(groups || []).map(g => {
              const val = g.name || g.id;
              const isSelected = activeGroupFilter && (
                String(val).trim() === String(activeGroupFilter).trim() ||
                String(g.id).trim() === String(activeGroupFilter).trim() ||
                String(g.name).trim() === String(activeGroupFilter).trim()
              );
              return `<option value="${escapeHtml(val)}" ${isSelected ? 'selected' : ''}>${escapeHtml(g.name)}</option>`;
            }).join('')}
          </select>
        </div>
      </div>

      <!-- Students Table -->
      <div class="card" id="studentsTableCard" style="margin: 0; padding: 0; border: 1px solid var(--centrly-line); position: relative; border-radius: var(--radius-lg); overflow: hidden;">
        <div id="studentsTableContainer" style="overflow-x: auto; -webkit-overflow-scrolling: touch;" onscroll="window.centrlyApp && window.centrlyApp.syncStudentsTableScroll('table')">
          <table class="data-table" id="studentsTable" style="margin: 0;">
            <thead>
              <tr>
                <th>كود الطالب</th>
                <th>اسم الطالب</th>
                <th>المجموعة</th>
                <th>هاتف الطالب *</th>
                <th>هاتف ولي الأمر *</th>
                <th>الرسوم والخصم</th>
                <th>رابط المتابعة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${((isLoading || !hasLoaded) && studentList.length === 0) ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 2rem 1rem; background: #ffffff; border-bottom: 1px solid #e2e8f0;">
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
                    <td><span class="skeleton-box" style="width: 55px; height: 18px;"></span></td>
                    <td><span class="skeleton-box" style="width: 140px; height: 18px;"></span></td>
                    <td><span class="skeleton-box" style="width: 85px; height: 20px; border-radius: 12px;"></span></td>
                    <td><span class="skeleton-box" style="width: 100px; height: 18px;"></span></td>
                    <td><span class="skeleton-box" style="width: 100px; height: 18px;"></span></td>
                    <td><span class="skeleton-box" style="width: 60px; height: 18px;"></span></td>
                    <td>
                      <div style="display: flex; gap: 0.35rem;">
                        <span class="skeleton-box" style="width: 50px; height: 22px; border-radius: 4px;"></span>
                        <span class="skeleton-box" style="width: 50px; height: 22px; border-radius: 4px;"></span>
                      </div>
                    </td>
                    <td>
                      <div style="display: flex; gap: 0.35rem;">
                        <span class="skeleton-box" style="width: 30px; height: 26px; border-radius: 6px;"></span>
                        <span class="skeleton-box" style="width: 30px; height: 26px; border-radius: 6px;"></span>
                        <span class="skeleton-box" style="width: 30px; height: 26px; border-radius: 6px;"></span>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              ` : studentList.length > 0 ? studentList.map(s => {
                const matchedGroup = (groups || []).find(g => g.id === s.group_id || g.id === s.groupId);
                const displayGroupName = s.groupName || s.group_name || matchedGroup?.name || 'مجموعة عامة';
                const sGroupId = s.group_id || s.groupId || matchedGroup?.id || '';
                const studentPhone = s.studentPhone || s.student_phone;
                const parentPhone = s.parentPhone || s.parent_phone;
                const canonicalOrigin = typeof window !== 'undefined' ? (window.location.origin || 'https://centerly-eg.com') : 'https://centerly-eg.com';
                const parentPortalUrl = `${canonicalOrigin}/portal?role=parent&preview=true${parentPhone ? `&phone=${encodeURIComponent(parentPhone)}` : ''}`;
                const studentPortalUrl = `${canonicalOrigin}/portal?role=student&preview=true${studentPhone ? `&phone=${encodeURIComponent(studentPhone)}` : ''}`;
                const portalPassword = s.portal_password || s.portalPassword || (s.code ? String(s.code).padStart(6, '0') : '');

                let isRowVisible = true;
                if (activeGroupFilter) {
                  const gFilterLower = activeGroupFilter.toLowerCase().trim();
                  const matchG = displayGroupName.toLowerCase().includes(gFilterLower) ||
                                 String(sGroupId).toLowerCase() === gFilterLower ||
                                 (matchedGroup && matchedGroup.name && matchedGroup.name.toLowerCase().includes(gFilterLower));
                  if (!matchG) isRowVisible = false;
                }
                if (activeSearchQuery && isRowVisible) {
                  const qClean = normalizeDigits(activeSearchQuery).trim().toLowerCase();
                  const rowCode = normalizeDigits(s.code || s.student_code || '').trim().toLowerCase();
                  const rowName = (s.name || s.full_name || '').trim().toLowerCase();
                  const cleanDigits = qClean.replace(/\D/g, '');
                  const sPh = normalizeDigits(studentPhone || '').replace(/\D/g, '');
                  const pPh = normalizeDigits(parentPhone || '').replace(/\D/g, '');
                  let matchQ = false;
                  if (!qClean) matchQ = true;
                  else if (rowCode && (rowCode === qClean || rowCode.startsWith(qClean))) matchQ = true;
                  else if (rowName && rowName.includes(qClean)) matchQ = true;
                  else if (cleanDigits.length >= 7 && (sPh.includes(cleanDigits) || pPh.includes(cleanDigits))) matchQ = true;
                  else if (cleanDigits.length < 7 && !rowCode && (displayGroupName.toLowerCase().includes(qClean) || rowName.includes(qClean))) matchQ = true;
                  if (!matchQ) isRowVisible = false;
                }

                return `
                <tr data-code="${escapeHtml(s.code || s.student_code || '')}" data-name="${escapeHtml(s.name || s.full_name || '')}" data-phone="${escapeHtml(studentPhone || '')}" data-parent-phone="${escapeHtml(parentPhone || '')}" data-group="${escapeHtml(displayGroupName)}" data-group-id="${escapeHtml(sGroupId)}" style="${isRowVisible ? '' : 'display: none;'}">
                  <td style="font-family: monospace; font-weight: 700; color: var(--centrly-blue-800);">${escapeHtml(s.code || s.student_code || '—')}</td>
                  <td style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(s.name || s.full_name || '—')}</td>
                  <td style="max-width: 150px;">
                    <span class="badge badge-blue" title="${escapeHtml(displayGroupName)}" style="font-weight: 700; display: inline-block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; padding: 0.3rem 0.65rem; border-radius: 8px; font-size: 0.8rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                      ${escapeHtml(displayGroupName)}
                    </span>
                  </td>
                  <td dir="ltr" style="text-align: right; font-family: monospace; font-size: 0.85rem; font-weight: 600;">
                    ${escapeHtml(studentPhone || '—')}
                  </td>
                  <td dir="ltr" style="text-align: right; font-family: monospace; font-size: 0.85rem; color: var(--centrly-text);">
                    ${escapeHtml(parentPhone || '—')}
                  </td>
                  <td>
                    ${s.exempt ? '<span class="badge badge-success">منحة / معفي</span>' : (s.feeOverride || s.fee_override ? `<span class="badge badge-warning">خصم: ${escapeHtml(s.feeOverride || s.fee_override)} ج.م</span>` : '<span style="color:var(--centrly-text); font-size:0.85rem;">أساسي</span>')}
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 0.35rem; min-width: 165px;">
                      <!-- Password Badge -->
                      ${portalPassword ? `
                        <div style="font-size: 0.72rem; color: #1e3a8a; font-weight: 800; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 5px; padding: 0.2rem 0.45rem; display: flex; align-items: center; justify-content: space-between;">
                          <span style="color: #1e40af; font-size: 0.7rem;">كلمة المرور:</span>
                          <span style="font-family: monospace; color: #1e3a8a; font-weight: 800; letter-spacing: 1.5px; font-size: 0.78rem;">${escapeHtml(portalPassword)}</span>
                        </div>
                      ` : ''}

                      <!-- Parent Link Row -->
                      <div style="display: flex; align-items: center; gap: 0.2rem;">
                        <span style="font-size: 0.65rem; color: #64748b; font-weight: 700; width: 35px;">الأمر:</span>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.copyParentLink('${escapeHtml(s.id)}')" title="نسخ رسالة واتساب كاملة لولي الأمر جاهزة للإرسال اليدوي" style="padding: 0.15rem 0.4rem; font-size: 0.72rem; display: flex; align-items: center; gap: 0.2rem;">
                          ${getIcon('copy', 12)}
                          <span>نسخ</span>
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.sendSingleParentLink('${escapeHtml(s.id)}')" title="إرسال رابط المتابعة لولي الأمر عبر واتساب" style="padding: 0.15rem 0.4rem; font-size: 0.72rem; display: flex; align-items: center; gap: 0.2rem; color: #059669; border-color: rgba(5, 150, 105, 0.3);">
                          ${getIcon('whatsapp', 12)}
                          <span>إرسال</span>
                        </button>
                        <a class="btn btn-secondary btn-sm" href="${parentPortalUrl}" onclick="if (window.centrlyApp && window.centrlyApp.previewParentPortal) { window.centrlyApp.previewParentPortal('${escapeHtml(s.id)}'); return false; }" target="_blank" rel="noopener noreferrer" title="معاينة بوابة ولي الأمر" style="padding: 0.15rem 0.35rem; font-size: 0.72rem; display: flex; align-items: center; justify-content: center; color: var(--centrly-blue-700); text-decoration: none;">
                          ${getIcon('link', 12)}
                        </a>
                      </div>

                      <!-- Student Link Row -->
                      <div style="display: flex; align-items: center; gap: 0.2rem;">
                        <span style="font-size: 0.65rem; color: #1d4ed8; font-weight: 700; width: 35px;">الطالب:</span>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.copyStudentLink('${escapeHtml(s.id)}')" title="نسخ رسالة واتساب كاملة للطالب جاهزة للإرسال اليدوي" style="padding: 0.15rem 0.4rem; font-size: 0.72rem; display: flex; align-items: center; gap: 0.2rem; background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; font-weight: 700;">
                          ${getIcon('copy', 12)}
                          <span>نسخ</span>
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.sendSingleStudentLink('${escapeHtml(s.id)}')" title="إرسال رابط البوابة للطالب عبر واتساب" style="padding: 0.15rem 0.4rem; font-size: 0.72rem; display: flex; align-items: center; gap: 0.2rem; color: #1d4ed8; border-color: rgba(29, 78, 216, 0.3);">
                          ${getIcon('whatsapp', 12)}
                          <span>إرسال</span>
                        </button>
                        <a class="btn btn-secondary btn-sm" href="${studentPortalUrl}" onclick="if (window.centrlyApp && window.centrlyApp.previewStudentPortal) { window.centrlyApp.previewStudentPortal('${escapeHtml(s.id)}'); return false; }" target="_blank" rel="noopener noreferrer" title="معاينة بوابة الطالب (رفع الواجبات والماتريال)" style="padding: 0.15rem 0.35rem; font-size: 0.72rem; display: flex; align-items: center; justify-content: center; color: #1d4ed8; text-decoration: none;">
                          ${getIcon('link', 12)}
                        </a>
                      </div>

                      <div style="font-size: 0.65rem; display: flex; flex-direction: column; gap: 0.15rem; margin-top: 0.1rem;">
                        ${s.parent_portal_sent_at ? `
                          <span style="color: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 0.2rem;" title="تم إرسال رابط ولي الأمر مسبقاً">
                            <span style="display:inline-block; width:5px; height:5px; background:#059669; border-radius:50%;"></span>
                            تم الإرسال لولي الأمر
                          </span>
                        ` : ''}
                        ${s.student_portal_sent_at ? `
                          <span style="color: #2563eb; font-weight: 700; display: inline-flex; align-items: center; gap: 0.2rem;" title="تم إرسال رابط بوابة الطالب مسبقاً">
                            <span style="display:inline-block; width:5px; height:5px; background:#2563eb; border-radius:50%;"></span>
                            تم الإرسال للطالب
                          </span>
                        ` : ''}
                        ${(!s.parent_portal_sent_at && !s.student_portal_sent_at) ? `
                          <span style="color: #94a3b8; font-weight: 600; display: inline-flex; align-items: center; gap: 0.2rem;">
                            <span style="display:inline-block; width:5px; height:5px; background:#cbd5e1; border-radius:50%;"></span>
                            جديد (لم يُرسل بعد)
                          </span>
                        ` : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.35rem;">
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openParentNoteModal('${escapeHtml(s.id)}', '${escapeHtml(s.name)}')" title="إرسال ملاحظة خاصة لولي الأمر عبر الواتساب" style="display: flex; align-items: center; gap: 0.3rem;">
                        ${getIcon('note', 14)}
                        <span>ملاحظة</span>
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.editStudent('${escapeHtml(s.id)}')" title="تعديل بيانات الطالب">
                        ${getIcon('edit', 14)}
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.confirmDeleteStudent('${escapeHtml(s.id)}', '${escapeHtml(s.name)}')" title="حذف الطالب" style="color: var(--centrly-danger); border-color: rgba(239, 68, 68, 0.3);">
                        ${getIcon('close', 14)}
                      </button>
                    </div>
                  </td>
                </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا يوجد طلاب مسجلون حتى الآن. اضغط على "طالب جديد" لبدء الإضافة.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Floating Horizontal Scrollbar (Fixed to viewport bottom whenever students table is in view) -->
      <div id="studentsStickyScrollWrap" style="display: none; position: fixed; bottom: 0; z-index: 50; background: #ffffff; border: 1px solid #cbd5e1; border-bottom: none; box-shadow: 0 -3px 12px rgba(0, 0, 0, 0.08); padding: 5px 8px; border-radius: 8px 8px 0 0; box-sizing: border-box;">
        <div id="studentsStickyScrollTrack" style="width: 100%; overflow-x: auto; overflow-y: hidden; height: 14px;" onscroll="window.centrlyApp && window.centrlyApp.syncStudentsTableScroll('bar')">
          <div id="studentsStickyScrollDummy" style="height: 1px; width: 1200px;"></div>
        </div>
      </div>

    </div>
  `;
}

export function registerStudentsActions(app) {
  app.openAddStudentModal = function() {
    const studentLimit = this.billingState?.students_limit || 300;
    const currentCount = (this.students || []).length;
    if (currentCount >= studentLimit) {
      const storageKey = 'centrly_quota_exceeded_timestamp';
      let reachedTimestamp = null;
      try {
        reachedTimestamp = (typeof localStorage !== 'undefined') ? localStorage.getItem(storageKey) : null;
        if (!reachedTimestamp) {
          reachedTimestamp = Date.now().toString();
          localStorage.setItem(storageKey, reachedTimestamp);
        }
      } catch (_) {
        reachedTimestamp = Date.now().toString();
      }
      const elapsedDays = (Date.now() - Number(reachedTimestamp)) / (1000 * 60 * 60 * 24);
      if (elapsedDays > 3) {
        this.showQuotaBlockedModal(currentCount, studentLimit);
        return;
      }
    }

    const groupOptions = this.renderGroupOptionsForImport ? this.renderGroupOptionsForImport() : (this.groups || []).map(g => `<option value="${g.id}">${g.name} (${g.center_name || 'السنتر'})</option>`).join('');
    const bodyHtml = `
      <form id="addStudentModalForm" onsubmit="window.centrlyApp.handleCreateStudent(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب رباعي *</label>
          <input type="text" id="newStudentName" class="form-input" placeholder="اسم الطالب بالكامل" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف الطالب الشخصي *</label>
          <input type="tel" id="newStudentOwnPhone" class="form-input" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم هاتف الطالب للتواصل المباشر والباركود (إلزامي)</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر (واتساب) *</label>
          <input type="tel" id="newStudentPhone" class="form-input" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم مصري مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">كود الطالب (اختياري)</label>
          <input type="text" id="newStudentCode" class="form-input" placeholder="اتركه فارغاً للتوليد التلقائي (مثال: 1025)" dir="ltr">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">يمكنك كتابة كود مخصص للطالب أو تركه فارغاً ليقوم النظام بتوليد كود تسلسلي فريد تلقائياً.</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <label class="form-label" style="font-weight: 700; margin-bottom: 0;">المجموعة الأساسية *</label>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleQuickAddGroupInSingleStudent()" style="font-size: 0.78rem; font-weight: 700; padding: 0.15rem 0.55rem; color: #2563eb; display: inline-flex; align-items: center; gap: 0.25rem; border-color: #cbd5e1;">
              ${getIcon('add', 12, '#2563eb')}
              <span>إضافة مجموعة جديدة</span>
            </button>
          </div>
          <select id="newStudentGroup" class="form-input" required onchange="window.centrlyApp.handleStudentModalGroupChange(this)">
            ${groupOptions}
          </select>
          <div id="quickGroupCreatorSingleStudent" style="display: none; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 0.75rem; margin-top: 0.5rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <div style="font-weight: 800; color: #166534; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                ${getIcon('add', 14, '#16a34a')}
                <span>إنشاء مجموعة جديدة فوراً واختيارها</span>
              </div>
              <button type="button" onclick="window.centrlyApp.cancelQuickAddGroupInSingleStudent()" style="background: none; border: none; font-size: 1.15rem; line-height: 1; cursor: pointer; color: #64748b;" title="إغلاق">&times;</button>
            </div>
            <div class="modal-form-grid" style="gap: 0.5rem; margin-bottom: 0;">
              <div>
                <label style="font-weight: 700; font-size: 0.75rem; color: #1e293b; display: block; margin-bottom: 0.15rem;">اسم المجموعة *</label>
                <input type="text" id="quickGroupNameStudent" class="form-input" placeholder="مثال: 1ث أ" style="font-size: 0.8rem; padding: 0.35rem 0.5rem;">
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.75rem; color: #1e293b; display: block; margin-bottom: 0.15rem;">المقر / السنتر (اختياري)</label>
                <input type="text" id="quickGroupCenterStudent" class="form-input" placeholder="اسم السنتر" style="font-size: 0.8rem; padding: 0.35rem 0.5rem;">
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.75rem; color: #1e293b; display: block; margin-bottom: 0.15rem;">سعر الحصة (ج.م) *</label>
                <input type="number" id="quickGroupPriceStudent" class="form-input" value="50" min="0" step="5" style="font-size: 0.8rem; padding: 0.35rem 0.5rem;">
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.75rem; color: #1e293b; display: block; margin-bottom: 0.15rem;">يوم الحصة الأسبوعي</label>
                <select id="quickGroupDayStudent" class="form-input" style="font-size: 0.8rem; padding: 0.35rem 0.5rem;">
                  <option value="السبت">السبت</option>
                  <option value="الأحد">الأحد</option>
                  <option value="الإثنين">الإثنين</option>
                  <option value="الثلاثاء">الثلاثاء</option>
                  <option value="الأربعاء">الأربعاء</option>
                  <option value="الخميس">الخميس</option>
                  <option value="الجمعة">الجمعة</option>
                </select>
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.35rem; margin-top: 0.6rem;">
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" onclick="window.centrlyApp.cancelQuickAddGroupInSingleStudent()">إلغاء</button>
              <button type="button" class="btn btn-primary btn-sm" id="btnSaveQuickGroupStudent" onclick="window.centrlyApp.executeQuickCreateGroupForSingleStudent()" style="background: #16a34a; border-color: #16a34a; font-weight: 700; font-size: 0.75rem; padding: 0.2rem 0.6rem;">
                حفظ واختيار المجموعة الآن ✓
              </button>
            </div>
          </div>
        </div>
        <div id="addStudentFeedback" style="display: none; padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem; line-height: 1.4;"></div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="addStudentModalForm" id="btnSaveStudent" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('add', 16)} <span>إضافة الطالب</span>
      </button>
    `;
    this.showModal('إضافة طالب جديد', bodyHtml, footerHtml);
  }

  app.handleCreateStudent = async function(e) {
    e.preventDefault();
    const name = document.getElementById('newStudentName').value.trim();
    const parent_phone = document.getElementById('newStudentPhone').value.trim();
    const student_phone = document.getElementById('newStudentOwnPhone')?.value.trim() || '';
    const rawCode = document.getElementById('newStudentCode')?.value.trim();
    const groupId = document.getElementById('newStudentGroup').value;
    const feedback = document.getElementById('addStudentFeedback');
    const saveBtn = document.getElementById('btnSaveStudent');

    if (!groupId || groupId === '__NEW_GROUP__') {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = 'يرجى اختيار المجموعة الأساسية للطالب أو إنشاء مجموعة جديدة أولاً.';
      }
      return;
    }

    const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;
    const cleanParentPhone = parent_phone.replace(/[\s\-().]/g, '');
    if (!egyptianPhoneRegex.test(cleanParentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `رقم ولي الأمر غير صحيح (${cleanParentPhone.length} أرقام). يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    const cleanStudentPhone = student_phone.replace(/[\s\-().]/g, '');
    if (!cleanStudentPhone || !egyptianPhoneRegex.test(cleanStudentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `رقم هاتف الطالب إلزامي وغير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    // Client-side uniqueness check if a custom code is entered
    if (rawCode) {
      const duplicateStudent = (this.students || []).find(s => {
        const c1 = (s.code || '').trim();
        const c2 = (s.student_code || s.studentCode || '').trim();
        return c1 === rawCode || c2 === rawCode;
      });
      if (duplicateStudent) {
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.backgroundColor = 'var(--centrly-danger-light)';
          feedback.style.color = 'var(--centrly-danger)';
          feedback.textContent = `كود الطالب (${rawCode}) مسجل بالفعل للطالب "${duplicateStudent.name}". لا يمكن تكرار الأكواد.`;
        }
        return;
      }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الإضافة...';

    try {
      const res = await request('/students', {
        method: 'POST',
        body: {
          name,
          parent_phone: cleanParentPhone,
          student_phone: cleanStudentPhone,
          code: rawCode || undefined,
        },
      });

      const studentId = res.student?.id;
      if (studentId && groupId) {
        await request(`/groups/${groupId}/students`, {
          method: 'POST',
          body: { student_id: studentId },
        }).catch(err => console.warn('Enrollment note:', err));
      }

      this.closeModal();
      this.showToast(`تمت إضافة الطالب (${name}) بنجاح! والكود التلقائي: ${res.student?.code || res.student?.student_code || 'تم التعيين'}`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل إضافة الطالب. تأكد من صحة رقم الهاتف والبيانات.'}`;
      } else {
        this.showToast(`فشل إضافة الطالب: ${err.message || 'تأكد من صحة البيانات'}`, 'danger');
      }
      saveBtn.disabled = false;
      saveBtn.textContent = 'إضافة الطالب';
    }
  }

  app.handleStudentModalGroupChange = function(selectEl) {
    if (selectEl.value === '__NEW_GROUP__') {
      this.toggleQuickAddGroupInSingleStudent(true);
    } else {
      this.toggleQuickAddGroupInSingleStudent(false);
    }
  }

  app.toggleQuickAddGroupInSingleStudent = function(forceState = null) {
    const container = document.getElementById('quickGroupCreatorSingleStudent');
    if (!container) return;
    const isVisible = container.style.display !== 'none';
    const shouldShow = forceState !== null ? forceState : !isVisible;
    container.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) {
      const nameInput = document.getElementById('quickGroupNameStudent');
      if (nameInput) setTimeout(() => nameInput.focus(), 80);
    } else {
      const sel = document.getElementById('newStudentGroup');
      if (sel && sel.value === '__NEW_GROUP__') {
        sel.value = (this.groups && this.groups[0]?.id) || '';
      }
    }
  }

  app.cancelQuickAddGroupInSingleStudent = function() {
    this.toggleQuickAddGroupInSingleStudent(false);
  }

  app.executeQuickCreateGroupForSingleStudent = async function() {
    const nameInput = document.getElementById('quickGroupNameStudent');
    const centerInput = document.getElementById('quickGroupCenterStudent');
    const priceInput = document.getElementById('quickGroupPriceStudent');
    const dayInput = document.getElementById('quickGroupDayStudent');
    const saveBtn = document.getElementById('btnSaveQuickGroupStudent');

    const name = nameInput?.value?.trim();
    if (!name) {
      this.showToast('يرجى كتابة اسم المجموعة أولاً', 'warning');
      nameInput?.focus();
      return;
    }

    const center_name = centerInput?.value?.trim() || undefined;
    const price = Number(priceInput?.value) || 0;
    const day_of_week = dayInput?.value || 'السبت';
    const session_time = '04:00 م';
    const schedule = `${day_of_week} • ${session_time}`;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ... ⏳';
    }

    try {
      const res = await request('/groups', {
        method: 'POST',
        body: {
          name,
          center_name,
          price,
          session_price: price,
          day_of_week,
          session_time,
          sessions_per_week: 1,
          billing_model: 'percentage',
          center_cut_percentage: 20,
          schedule,
        },
      });

      const newGroup = res?.group || res;
      if (!newGroup || !newGroup.id) {
        throw new Error('لم يتم استلام بيانات المجموعة من الخادم');
      }

      if (!this.groups) this.groups = [];
      this.groups.unshift(newGroup);
      this.saveCache('groups', this.groups);

      const selStudent = document.getElementById('newStudentGroup');
      if (selStudent) {
        selStudent.innerHTML = this.renderGroupOptionsForImport(newGroup.id);
        selStudent.value = newGroup.id;
      }

      this.toggleQuickAddGroupInSingleStudent(false);
      this.showToast(`تم إنشاء مجموعة (${escapeHtml(name)}) واختيارها بنجاح! ✓`, 'success');
    } catch (err) {
      console.error('Quick group creation failed:', err);
      this.showToast(`تعذر إنشاء المجموعة: ${err.message || 'خطأ غير متوقع'}`, 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ واختيار المجموعة الآن ✓';
      }
    }
  }

  app.editStudent = function(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    if (!student) {
      this.showToast('لم يتم العثور على بيانات الطالب المحدد', 'danger');
      return;
    }

    const currentGroupId = student.group_id || (Array.isArray(student.group_ids) && student.group_ids[0]) || student.groupId || '';
    const groupOptions = (this.groups || []).map(g => `
      <option value="${g.id}" ${g.id === currentGroupId ? 'selected' : ''}>${g.name} (${g.center_name || g.centerName || 'السنتر'})</option>
    `).join('');

    const currentName = student.name || student.full_name || '';
    const currentCode = student.code || student.student_code || student.studentCode || '';
    const currentStudentPhone = student.student_phone || student.studentPhone || '';
    const currentParentPhone = student.parent_phone || student.parentPhone || '';

    const bodyHtml = `
      <form id="editStudentModalForm" onsubmit="window.centrlyApp.saveStudentEdit(event, '${escapeHtml(studentId)}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب الرباعي *</label>
          <input type="text" id="editStudentName" class="form-input" value="${escapeHtml(currentName)}" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">كود الطالب *</label>
          <input type="text" id="editStudentCode" class="form-input" value="${escapeHtml(currentCode)}" placeholder="مثال: 1025" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">كود الطالب التعريفي في المنصة والباركود (يجب أن يكون فريداً وغير مكرر)</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف الطالب الشخصي *</label>
          <input type="tel" id="editStudentOwnPhone" class="form-input" value="${escapeHtml(currentStudentPhone)}" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم هاتف الطالب للتواصل المباشر والباركود (إلزامي 11 رقماً)</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر (واتساب) *</label>
          <input type="tel" id="editStudentPhone" class="form-input" value="${escapeHtml(currentParentPhone)}" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم مصري مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">المجموعة الأساسية</label>
          <select id="editStudentGroup" class="form-input">
            <option value="" ${!currentGroupId ? 'selected' : ''}>-- عام (بدون مجموعة محددة) --</option>
            ${groupOptions}
          </select>
        </div>
        <div id="editStudentFeedback" style="display: none; padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem; line-height: 1.4;"></div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="editStudentModalForm" id="btnUpdateStudent" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('check', 16)} <span>حفظ التعديلات</span>
      </button>
    `;

    this.showModal(`تعديل بيانات الطالب: ${escapeHtml(currentName || student.name)}`, bodyHtml, footerHtml);
  }

  app.saveStudentEdit = async function(e, studentId) {
    e.preventDefault();
    const currentGroupFilter = document.getElementById('studentGroupFilter')?.value;
    if (currentGroupFilter !== undefined && currentGroupFilter !== null) {
      this.studentsGroupFilter = currentGroupFilter;
    }
    const name = document.getElementById('editStudentName')?.value.trim();
    const code = document.getElementById('editStudentCode')?.value.trim();
    const parent_phone = document.getElementById('editStudentPhone')?.value.trim();
    const student_phone = document.getElementById('editStudentOwnPhone')?.value.trim() || '';
    const rawGroupId = document.getElementById('editStudentGroup')?.value;
    const targetGroupId = rawGroupId && rawGroupId.trim().length > 0 ? rawGroupId.trim() : null;
    const feedback = document.getElementById('editStudentFeedback');
    const saveBtn = document.getElementById('btnUpdateStudent');

    if (!code) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = 'كود الطالب إلزامي ولا يمكن تركه فارغاً.';
      }
      return;
    }

    const duplicateStudent = (this.students || []).find(s => {
      if (s.id === studentId) return false;
      const c1 = (s.code || '').trim();
      const c2 = (s.student_code || s.studentCode || '').trim();
      return c1 === code || c2 === code;
    });
    if (duplicateStudent) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `كود الطالب (${code}) مسجل بالفعل للطالب "${duplicateStudent.name}". لا يمكن تكرار الأكواد.`;
      }
      return;
    }

    const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;
    const cleanParentPhone = parent_phone.replace(/[\s\-().]/g, '');
    if (!egyptianPhoneRegex.test(cleanParentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `رقم ولي الأمر غير صحيح (${cleanParentPhone.length} أرقام). يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    const cleanStudentPhone = student_phone.replace(/[\s\-().]/g, '');
    if (!cleanStudentPhone || !egyptianPhoneRegex.test(cleanStudentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `رقم هاتف الطالب إلزامي وغير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';
    }

    try {
      const updateRes = await request(`/students/${studentId}`, {
        method: 'PUT',
        body: {
          name,
          parent_phone: cleanParentPhone,
          student_phone: cleanStudentPhone,
          group_id: targetGroupId,
          code,
        },
      });

      const updatedStudent = updateRes?.student || updateRes;
      const matchedGroup = (this.groups || []).find(g => g.id === targetGroupId);
      const groupTitle = matchedGroup ? matchedGroup.name : (targetGroupId ? 'مجموعة محددة' : 'مجموعة عامة');

      // Update in-memory state and cache immediately
      if (Array.isArray(this.students)) {
        const studentIndex = this.students.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
          this.students[studentIndex] = {
            ...this.students[studentIndex],
            ...(updatedStudent && typeof updatedStudent === 'object' ? updatedStudent : {}),
            name,
            code,
            student_code: code,
            studentCode: code,
            parent_phone: cleanParentPhone,
            parentPhone: cleanParentPhone,
            student_phone: cleanStudentPhone,
            studentPhone: cleanStudentPhone,
            group_id: targetGroupId,
            groupId: targetGroupId,
            group_ids: targetGroupId ? [targetGroupId] : [],
            group_name: groupTitle,
            groupName: groupTitle,
          };
          this.saveCache('students', this.students);
        }
      }

      this.closeModal();
      this.showToast(`تم تحديث بيانات الطالب (${name}) بنجاح!`, 'success');

      // Re-fetch route data with cache-busting to guarantee server synchronization
      try {
        if (this.currentRoute === 'students') {
          const freshRes = await request(`/students?_t=${Date.now()}`);
          if (freshRes) {
            const fetched = Array.isArray(freshRes) ? freshRes : (freshRes.students || []);
            if (fetched.length > 0) {
              this.students = fetched;
              this.saveCache('students', this.students);
            }
          }
        } else {
          await this.loadRouteData(this.currentRoute);
        }
      } catch (rErr) {
        console.warn('Background sync note:', rErr);
      }

      this.renderMainContent();
      if (typeof this.filterStudentsTable === 'function') {
        this.filterStudentsTable();
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل تحديث بيانات الطالب.'}`;
      } else {
        this.showToast(`فشل تحديث بيانات الطالب: ${err.message || 'خطأ في البيانات'}`, 'danger');
      }
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ التعديلات';
      }
    }
  }

  app.confirmDeleteStudent = function(studentId, studentName) {
    const currentGroupFilter = document.getElementById('studentGroupFilter')?.value;
    if (currentGroupFilter !== undefined && currentGroupFilter !== null) {
      this.studentsGroupFilter = currentGroupFilter;
    }

    this.showConfirmModal({
      title: 'حذف الطالب نهائياً',
      message: `هل أنت متأكد من رغبتك في حذف الطالب "${studentName}"؟ سيتم حذف جميع بياناته وسجلات حضوره بالكامل.`,
      confirmText: 'حذف الطالب',
      cancelText: 'إلغاء',
      isDanger: true,
      onConfirm: async () => {
        try {
          await request(`/students/${studentId}`, { method: 'DELETE' });
          this.showToast(`تم حذف الطالب (${studentName}) بنجاح`, 'success');
          await this.loadRouteData(this.currentRoute);
          if (typeof this.filterStudentsTable === 'function') {
            this.filterStudentsTable();
          }
        } catch (err) {
          this.showToast(`فشل حذف الطالب: ${err.message || 'خطأ في الخادم'}`, 'danger');
        }
      },
    });
  }

  app.filterStudentsTable = function() {
    const searchEl = document.getElementById('studentSearchInput');
    const groupEl = document.getElementById('studentGroupFilter');

    const rawVal = searchEl ? searchEl.value : (this.studentsSearchQuery || '');
    const q = normalizeDigits(rawVal).trim().toLowerCase();

    let groupFilter = groupEl ? groupEl.value : (this.studentsGroupFilter || '');
    if (!groupFilter && !groupEl) {
      try {
        groupFilter = sessionStorage.getItem('centrly_students_group_filter') || '';
      } catch (_) {}
    }

    this.studentsGroupFilter = groupFilter;
    if (searchEl) {
      this.studentsSearchQuery = rawVal;
    }

    try {
      if (groupFilter) {
        sessionStorage.setItem('centrly_students_group_filter', groupFilter);
      } else {
        sessionStorage.removeItem('centrly_students_group_filter');
      }
    } catch (_) {}

    const rows = document.querySelectorAll('#studentsTable tbody tr');
    const cleanDigits = q.replace(/\D/g, '');

    rows.forEach(r => {
      if (r.classList.contains('skeleton-row')) return;
      const rowCode = normalizeDigits(r.getAttribute('data-code') || '').trim().toLowerCase();
      const rowName = (r.getAttribute('data-name') || '').trim().toLowerCase();
      const rowPhone = normalizeDigits(r.getAttribute('data-phone') || '').replace(/\D/g, '');
      const rowParentPhone = normalizeDigits(r.getAttribute('data-parent-phone') || '').replace(/\D/g, '');
      const rowGroup = (r.getAttribute('data-group') || '').toLowerCase();
      const rowGroupId = (r.getAttribute('data-group-id') || '').toLowerCase();
      const rowText = r.textContent.toLowerCase();

      let matchQ = false;
      if (!q) {
        matchQ = true;
      } else if (rowCode && (rowCode === q || rowCode.startsWith(q))) {
        matchQ = true;
      } else if (rowName && rowName.includes(q)) {
        matchQ = true;
      } else if (cleanDigits.length >= 7 && (rowPhone.includes(cleanDigits) || rowParentPhone.includes(cleanDigits))) {
        matchQ = true;
      } else if (cleanDigits.length < 7 && !rowCode && rowText.includes(q)) {
        matchQ = true;
      }

      const gVal = (groupFilter || '').toLowerCase().trim();
      const matchG = !gVal || rowGroup.includes(gVal) || rowGroupId === gVal || rowText.includes(gVal);
      r.style.display = matchQ && matchG ? '' : 'none';
    });

    if (typeof this.updateStudentsFloatingScrollbar === 'function') {
      this.updateStudentsFloatingScrollbar();
    }
  }

  app.scrollStudentsTable = function(direction) {
    const container = document.getElementById('studentsTableContainer');
    if (!container) return;

    const step = 350;
    try {
      if (direction === 'full-right') {
        container.scrollBy({ left: 10000, behavior: 'smooth' });
      } else if (direction === 'full-left') {
        container.scrollBy({ left: -10000, behavior: 'smooth' });
      } else if (direction === 'right') {
        container.scrollBy({ left: step, behavior: 'smooth' });
      } else if (direction === 'left') {
        container.scrollBy({ left: -step, behavior: 'smooth' });
      }
    } catch (e) {
      if (direction === 'full-right') container.scrollLeft += 10000;
      else if (direction === 'full-left') container.scrollLeft -= 10000;
      else if (direction === 'right') container.scrollLeft += step;
      else if (direction === 'left') container.scrollLeft -= step;
    }
  }

  app.syncStudentsTableScroll = function(source) {
    if (this._isSyncingTableScroll) return;
    const tableContainer = document.getElementById('studentsTableContainer');
    const scrollTrack = document.getElementById('studentsStickyScrollTrack');
    if (!tableContainer || !scrollTrack) return;

    this._isSyncingTableScroll = true;
    try {
      if (source === 'table') {
        scrollTrack.scrollLeft = tableContainer.scrollLeft;
      } else if (source === 'bar') {
        tableContainer.scrollLeft = scrollTrack.scrollLeft;
      }
    } finally {
      requestAnimationFrame(() => {
        this._isSyncingTableScroll = false;
      });
    }
  }

  app.updateStudentsFloatingScrollbar = function() {
    const container = document.getElementById('studentsTableContainer');
    const floatingWrap = document.getElementById('studentsStickyScrollWrap');
    const dummy = document.getElementById('studentsStickyScrollDummy');
    const scrollTrack = document.getElementById('studentsStickyScrollTrack');
    if (!container || !floatingWrap || !dummy || !scrollTrack) return;

    const isOverflowing = container.scrollWidth > (container.clientWidth + 2);
    if (!isOverflowing) {
      floatingWrap.style.display = 'none';
      return;
    }

    dummy.style.width = `${container.scrollWidth}px`;

    const rect = container.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;

    const isTableInView = rect.top < (windowHeight - 20) && rect.bottom > 60;

    if (isTableInView) {
      const left = Math.max(0, rect.left);
      const width = Math.min(rect.width, (window.innerWidth || document.documentElement.clientWidth) - left);
      floatingWrap.style.display = 'block';
      floatingWrap.style.left = `${left}px`;
      floatingWrap.style.width = `${width}px`;
      if (!this._isSyncingTableScroll) {
        scrollTrack.scrollLeft = container.scrollLeft;
      }
    } else {
      floatingWrap.style.display = 'none';
    }
  }

  app.initStudentsTableScrollSync = function() {
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.updateStudentsFloatingScrollbar();

        const container = document.getElementById('studentsTableContainer');
        if (container && window.ResizeObserver && !this._studentsResizeObserver) {
          this._studentsResizeObserver = new ResizeObserver(() => {
            if (this.currentRoute === 'students') {
              this.updateStudentsFloatingScrollbar();
            }
          });
          this._studentsResizeObserver.observe(container);
        }

        if (!this._hasStudentsScrollListener) {
          this._hasStudentsScrollListener = true;
          window.addEventListener('scroll', () => {
            if (this.currentRoute === 'students') {
              this.updateStudentsFloatingScrollbar();
            }
          }, { passive: true });
          window.addEventListener('resize', () => {
            if (this.currentRoute === 'students') {
              this.updateStudentsFloatingScrollbar();
            }
          }, { passive: true });
        }
      }, 60);
    });
  }


}
