import { request } from "../services/api.js";
import { normalizeDigits } from "../utils/normalizeDigits.js";
import { getIcon } from "../utils/icons.js";
import { escapeHtml } from "../utils/escapeHtml.js";

/**
 * Centrly Onboarding Wizard (DEV-15 & DEV-38)
 * Self-Serve Signup + Quick Add Group & Students + WhatsApp Connect
 */

export function renderOnboardingWizard(step = 1, state = {}) {
  const defaultState = {
    groupName: state.groupName || '',
    sessionPrice: state.sessionPrice !== undefined ? state.sessionPrice : '',
    students: state.students && state.students.length > 0 ? state.students : [
      { name: '', studentPhone: '', parentPhone: '' },
      { name: '', studentPhone: '', parentPhone: '' },
      { name: '', studentPhone: '', parentPhone: '' },
    ],
    homeworkSubmission: state.homeworkSubmission || 'in_session',
    autoNotification: state.autoNotification !== false,
    ...state,
  };

  return `
    <style>
      .onboarding-student-grid {
        display: grid;
        grid-template-columns: 24px 1.3fr 1fr 1fr 32px;
        gap: 0.5rem;
        align-items: center;
      }
      @media (max-width: 680px) {
        .onboarding-student-grid {
          grid-template-columns: 24px 1fr 32px;
          gap: 0.45rem;
          background: #f8fafc;
          padding: 0.75rem;
          border-radius: var(--radius-sm, 6px);
          border: 1px solid var(--centrly-line, #e2e8f0);
        }
        .onboarding-student-grid .ob-student-name {
          grid-column: 2 / 3;
        }
        .onboarding-student-grid .ob-student-phone {
          grid-column: 2 / 3;
        }
        .onboarding-student-grid .ob-parent-phone {
          grid-column: 2 / 3;
        }
      }
    </style>

    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: var(--centrly-surface); padding: 1.5rem;">
      <div class="card" style="max-width: 720px; width: 100%; padding: 2.25rem; box-shadow: var(--shadow-lg);">
        
        <!-- Wizard Header & Steps -->
        <div style="margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
            <div>
              <h1 style="font-size: 1.4rem; font-weight: 800; color: var(--centrly-ink); margin-bottom: 0.35rem;">
                أهلاً بك في منصة سنترلي (Centrly)
              </h1>
              <p style="color: var(--centrly-text); font-size: 0.85rem; margin: 0;">
                إعداد سريع لحسابك لتتمكن من رصد الحضور وإرسال رسائل الواتساب
              </p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.skipAllOnboarding()" style="font-size: 0.78rem; color: var(--centrly-text); border: 1px solid var(--centrly-line); background: #fff; cursor: pointer; white-space: nowrap;">
              تخطي الإعداد بالكامل والبدء فوراً
            </button>
          </div>
          
          <!-- Stepper Indicator -->
          <div style="display: flex; justify-content: center; gap: 1.25rem; margin-top: 1rem; border-top: 1px solid var(--centrly-line); padding-top: 1.25rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.45rem; color: ${step >= 1 ? 'var(--centrly-blue-700)' : 'var(--centrly-text)'}; font-weight: 700; font-size: 0.85rem;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step >= 1 ? 'var(--centrly-blue-700)' : 'var(--centrly-line)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">1</span>
              <span>المجموعة</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem; color: ${step >= 2 ? 'var(--centrly-blue-700)' : 'var(--centrly-text)'}; font-weight: 700; font-size: 0.85rem;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step >= 2 ? 'var(--centrly-blue-700)' : 'var(--centrly-line)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">2</span>
              <span>الطلاب</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem; color: ${step >= 3 ? 'var(--centrly-blue-700)' : 'var(--centrly-text)'}; font-weight: 700; font-size: 0.85rem;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step >= 3 ? 'var(--centrly-blue-700)' : 'var(--centrly-line)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">3</span>
              <span>سير العمل والتواصل</span>
            </div>
          </div>
        </div>

        <div id="onboardingAlert" style="display: none; padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-size: 0.85rem;"></div>

        <!-- Step 1: Create First Group -->
        ${step === 1 ? `
          <div id="step1">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('groups', 18, 'var(--centrly-blue-700)')}
              <span>الخطوة 1: إنشاء مجموعتك الأولى</span>
            </h3>
            <div class="form-group">
              <label class="form-label">اسم المجموعة / الصف الدراسي</label>
              <input type="text" id="obGroupName" class="form-input" value="${defaultState.groupName}" placeholder="اسم المجموعة الدراسية">
            </div>
            <div class="form-group">
              <label class="form-label">سعر الحصة للطالب (جنيه مصري)</label>
              <input type="number" id="obSessionPrice" class="form-input" value="${defaultState.sessionPrice}" placeholder="100" min="0">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.75rem;">
              <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.skipOnboardingStep(1)" style="color: var(--centrly-text); border: 1px solid var(--centrly-line); background: #fff;">
                تخطي هذه الخطوة
              </button>
              <button type="button" class="btn btn-primary" onclick="window.centrlyApp.submitOnboardingStep1()">
                التالي: إضافة الطلاب
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Step 2: Quick Add Students -->
        ${step === 2 ? `
          <div id="step2">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('students', 18, 'var(--centrly-blue-700)')}
                <span>الخطوة 2: إضافة طلاب المجموعة سريعاً</span>
              </h3>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.addQuickStudentRow()" style="display: inline-flex; align-items: center; gap: 0.35rem;">
                ${getIcon('add', 14)}
                <span>إضافة طالب آخر</span>
              </button>
            </div>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 1rem;">
              أدخل أسماء الطلاب وأرقام هواتفهم (رقم الطالب، أو رقم ولي الأمر، أو كلاهما):
            </p>
            
            <div id="quickStudentsList" style="max-height: 290px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.5rem; padding: 0.25rem;">
              ${defaultState.students.map((s, idx) => `
                <div class="student-row onboarding-student-grid">
                  <span style="font-size: 0.8rem; font-weight: 700; color: var(--centrly-text); text-align: center;">${idx + 1}.</span>
                  <input type="text" class="form-input ob-student-name" value="${s.name || ''}" placeholder="اسم الطالب">
                  <input type="tel" class="form-input ob-student-phone" value="${s.studentPhone || s.phone || ''}" placeholder="هاتف الطالب (010...)" dir="ltr">
                  <input type="tel" class="form-input ob-parent-phone" value="${s.parentPhone || ''}" placeholder="هاتف ولي الأمر (010...)" dir="ltr">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.removeQuickStudentRow(this)" style="padding: 0.4rem; color: var(--centrly-danger); border: none; background: transparent; cursor: pointer;" title="حذف الصف">
                    ${getIcon('delete', 14, 'var(--centrly-danger)')}
                  </button>
                </div>
              `).join('')}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.nextOnboardingStep(1)">
                السابق
              </button>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.skipOnboardingStep(2)" style="color: var(--centrly-text); border: 1px solid var(--centrly-line); background: #fff;">
                  تخطي هذه الخطوة
                </button>
                <button type="button" class="btn btn-primary" onclick="window.centrlyApp.submitOnboardingStep2()">
                  التالي: إعدادات سير العمل
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Step 3: Workflow Settings & Contact Phone (DEV-38) -->
        ${step === 3 ? `
          <div id="step3">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('dashboard', 18, 'var(--centrly-blue-700)')}
              <span>الخطوة 3: تفضيلات سير العمل ورقم التواصل</span>
            </h3>
            
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-weight: 700;">رقم واتساب للتواصل مع الطلاب وأولياء الأمور 💬</label>
              <input type="tel" id="obContactPhone" class="form-input" placeholder="010..." value="${escapeHtml(defaultState.contactPhone || '')}" dir="ltr" style="font-size: 0.9rem;">
              <span style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; display: block;">
                سيظهر هذا الرقم كزر مباشر في بوابات المتابعة للطلاب وأولياء الأمور للتواصل معك عبر واتساب.
              </span>
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">طريقة فحص وتصحيح الواجب الدراسي:</label>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
                  <input type="radio" name="obHomework" value="in_session" ${defaultState.homeworkSubmission === 'in_session' ? 'checked' : ''}>
                  <span>فحص واستلام الواجب ورقياً أثناء الحصة (المعتاد)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
                  <input type="radio" name="obHomework" value="online_before_session" ${defaultState.homeworkSubmission === 'online_before_session' ? 'checked' : ''}>
                  <span>تسليم الواجب أونلاين عبر بوابة الطالب قبل موعد الحصة</span>
                </label>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
              <label class="form-label">متابعة الطلاب وأولياء الأمور:</label>
              <div style="background: #f8fafc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.85rem; font-size: 0.85rem; color: var(--centrly-text); line-height: 1.6;">
                🔗 يتم تفعيل <strong>بوابات المتابعة الذكية</strong> تلقائياً لكل طالب وولي أمر لمتابعة الحضور والدرجات لحظياً، مع إمكانية المراسلة الفورية عبر واتساب بنقرة واحدة.
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.nextOnboardingStep(2)">
                السابق
              </button>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-primary" onclick="window.centrlyApp.saveOnboardingDataAndGoToStep4()" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border: none; font-weight: 800; padding: 0.65rem 1.35rem; display: inline-flex; align-items: center; gap: 0.4rem;">
                  <span>حفظ وإنهاء الإعداد والبدء فوراً</span>
                  <span>←</span>
                </button>
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}

export function registerOnboardingActions(app) {
  // Onboarding Wizard Flow (DEV-15 & DEV-38)
  // ==========================================================================
  app.startOnboarding = function() {
    this.onboardingStep = 1;
    const appEl = this.getAppEl();
    if (appEl) appEl.innerHTML = renderOnboardingWizard(this.onboardingStep, this.onboardingState);
  }

  app.nextOnboardingStep = function(step) {
    // Save state from step 1
    if (this.onboardingStep === 1) {
      const gName = document.getElementById('obGroupName')?.value?.trim();
      const gPrice = document.getElementById('obSessionPrice')?.value;
      if (gName) this.onboardingState.groupName = gName;
      if (gPrice !== undefined && gPrice !== '') this.onboardingState.sessionPrice = Number(gPrice);
    }

    // Save state from step 2
    if (this.onboardingStep === 2) {
      this.captureOnboardingStep2Students();
    }

    this.onboardingStep = step;
    const appEl = this.getAppEl();
    if (appEl) appEl.innerHTML = renderOnboardingWizard(this.onboardingStep, this.onboardingState);

    if (step === 4) {
      this.initOnboardingStep4();
    } else {
      this.stopWhatsAppStatusPolling();
    }
  }

  app.submitOnboardingStep1 = function() {
    const gName = document.getElementById('obGroupName')?.value?.trim();
    const gPrice = document.getElementById('obSessionPrice')?.value;
    if (gName) this.onboardingState.groupName = gName;
    if (gPrice !== undefined && gPrice !== '') this.onboardingState.sessionPrice = Number(gPrice);
    this.nextOnboardingStep(2);
  }

  app.skipOnboardingStep = function(step) {
    if (step === 1) {
      this.nextOnboardingStep(2);
    } else if (step === 2) {
      this.nextOnboardingStep(3);
    } else if (step === 3) {
      this.nextOnboardingStep(4);
    } else if (step === 4) {
      this.finishOnboarding();
    }
  }

  app.skipAllOnboarding = function() {
    this.finishOnboarding();
  }

  app.captureOnboardingStep2Students = function() {
    const rows = Array.from(document.querySelectorAll('#quickStudentsList .student-row'));
    const students = [];
    rows.forEach(row => {
      const name = row.querySelector('.ob-student-name')?.value?.trim() || '';
      const studentPhone = row.querySelector('.ob-student-phone')?.value?.trim() || '';
      const parentPhone = row.querySelector('.ob-parent-phone')?.value?.trim() || '';
      if (name || studentPhone || parentPhone) {
        students.push({
          name,
          studentPhone,
          parentPhone,
          phone: studentPhone || parentPhone,
        });
      }
    });
    if (students.length > 0) {
      this.onboardingState.students = students;
    }
  }

  app.submitOnboardingStep2 = function() {
    this.captureOnboardingStep2Students();
    this.nextOnboardingStep(3);
  }

  app.addQuickStudentRow = function() {
    const list = document.getElementById('quickStudentsList');
    if (!list) return;
    const count = list.querySelectorAll('.student-row').length + 1;
    const div = document.createElement('div');
    div.className = 'student-row onboarding-student-grid';
    div.innerHTML = `
      <span style="font-size: 0.8rem; font-weight: 700; color: var(--centrly-text); text-align: center;">${count}.</span>
      <input type="text" class="form-input ob-student-name" placeholder="اسم الطالب">
      <input type="tel" class="form-input ob-student-phone" placeholder="هاتف الطالب (010...)" dir="ltr">
      <input type="tel" class="form-input ob-parent-phone" placeholder="هاتف ولي الأمر (010...)" dir="ltr">
      <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.removeQuickStudentRow(this)" style="padding: 0.4rem; color: var(--centrly-danger); border: none; background: transparent; cursor: pointer;" title="حذف الصف">
        ${getIcon('delete', 14, 'var(--centrly-danger)')}
      </button>
    `;
    list.appendChild(div);
  }

  app.removeQuickStudentRow = function(buttonEl) {
    const row = buttonEl.closest('.student-row');
    if (!row) return;
    const list = document.getElementById('quickStudentsList');
    row.remove();
    if (list) {
      Array.from(list.querySelectorAll('.student-row')).forEach((r, idx) => {
        const numSpan = r.querySelector('span');
        if (numSpan) numSpan.textContent = `${idx + 1}.`;
      });
    }
  }

  app.persistOnboardingGroupAndStudents = async function() {
    if (this.onboardingState.persisted) return;

    const groupName = this.onboardingState.groupName?.trim();
    const sessionPrice = Number(this.onboardingState.sessionPrice) || 0;

    let createdGroupId = null;
    if (groupName) {
      try {
        const groupRes = await request('/groups', {
          method: 'POST',
          body: {
            name: groupName,
            price: sessionPrice,
            session_price: sessionPrice,
            billing_model: 'percentage',
          },
        });
        createdGroupId = groupRes?.group?.id || null;
      } catch (e) {
        console.warn('Onboarding group creation error:', e);
      }
    }

    const studentsToSave = (this.onboardingState.students || []).filter(s => s && s.name && s.name.trim());
    for (const st of studentsToSave) {
      const studentName = st.name.trim();
      const studentPhone = (st.studentPhone || '').trim() || null;
      const parentPhone = (st.parentPhone || '').trim() || studentPhone || '';
      try {
        const stRes = await request('/students', {
          method: 'POST',
          body: {
            name: studentName,
            student_phone: studentPhone,
            parent_phone: parentPhone,
          },
        });
        const stId = stRes?.student?.id;
        if (stId && createdGroupId) {
          await request(`/groups/${createdGroupId}/students`, {
            method: 'POST',
            body: { student_id: stId },
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Onboarding student creation error:', err);
      }
    }

    this.onboardingState.persisted = true;
  }

  app.saveOnboardingDataAndGoToStep4 = async function() {
    const selectedHw = document.querySelector('input[name="obHomework"]:checked')?.value || 'in_session';
    const autoNotif = document.getElementById('obAutoNotification')?.checked ?? true;
    const obContactPhone = normalizeDigits(document.getElementById('obContactPhone')?.value?.trim() || '');

    this.onboardingState.homeworkSubmission = selectedHw;
    this.onboardingState.autoNotification = autoNotif;
    if (obContactPhone && this.user) {
      this.user.contact_phone = obContactPhone;
    }

    try {
      await request('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          homework_submission: selectedHw,
          auto_notification: autoNotif,
          enable_top_performers: true,
          ...(obContactPhone ? { contact_phone: obContactPhone } : {}),
        }),
      }).catch(() => {});

      await this.persistOnboardingGroupAndStudents().catch(() => {});
      await this.finishOnboarding();
    } catch (err) {
      await this.finishOnboarding();
    }
  }

  app.sendTestWhatsAppMessage = async function() {
    const phone = document.getElementById('obTestPhone')?.value;
    const resultBox = document.getElementById('obTestMsgResult');
    if (!phone) {
      this.showToast('يرجى كتابة رقم الهاتف أولاً', 'info');
      return;
    }

    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.style.color = 'var(--centrly-blue-800)';
      resultBox.textContent = 'جاري إرسال الرسالة الاختبارية عبر الواتساب...';
    }

    try {
      await request('/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ phone, message: 'رسالة اختبارية من منصة سنترلي - الاتصال يعمل بنجاح!' }),
      });
      if (resultBox) {
        resultBox.style.color = 'var(--centrly-success)';
        resultBox.textContent = 'تم إرسال الرسالة بنجاح لهاتفك!';
      }
    } catch (err) {
      if (resultBox) {
        resultBox.style.color = 'var(--centrly-danger)';
        resultBox.textContent = `فشل إرسال الرسالة الاختبارية: ${err.message || 'خطأ في الاتصال بخدمة واتساب'}`;
      } else {
        this.showToast(`فشل إرسال الرسالة الاختبارية: ${err.message || 'خطأ في الاتصال بخدمة واتساب'}`, 'danger');
      }
    }
  }

  app.finishOnboarding = async function() {
    this.stopWhatsAppStatusPolling();
    if (!this.onboardingState.persisted) {
      this.persistOnboardingGroupAndStudents().catch(() => {});
    }
    this.renderApp();
    this.loadRouteData(this.currentRoute);
  }
}
