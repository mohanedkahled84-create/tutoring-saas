import { getIcon } from "../utils/icons.js";

/**
 * Centrly Interactive Onboarding Tour Modal
 * Step-by-step visual product tour for students and parents
 * explaining each section of the portal dashboard.
 */

export function renderStudentPortalTourHtml() {
  return `
    <!-- Student Portal Walkthrough Tour Modal -->
    <div id="student-portal-tour-modal" style="display: none; position: fixed; inset: 0; z-index: 99999; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); align-items: center; justify-content: center; padding: 1rem; direction: rtl; font-family: system-ui, -apple-system, sans-serif; animation: tourFadeIn 0.25s ease;">
      <div style="background: #ffffff; width: 100%; max-width: 480px; border-radius: 1.25rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column;">
        
        <!-- Header Bar: Step Indicator & Close Button -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="background: #eff6ff; color: #1d4ed8; font-size: 0.78rem; font-weight: 800; padding: 0.25rem 0.65rem; border-radius: 9999px; border: 1px solid #bfdbfe;" id="student-tour-step-badge">
              الخطوة 1 من 4
            </span>
            <!-- Progress Dots -->
            <div style="display: flex; gap: 0.35rem; align-items: center;" id="student-tour-dots">
              <span class="tour-dot" onclick="window.setStudentPortalTourStep(1)" style="width: 8px; height: 8px; border-radius: 9999px; background: #2563eb; cursor: pointer; transition: all 0.2s;"></span>
              <span class="tour-dot" onclick="window.setStudentPortalTourStep(2)" style="width: 8px; height: 8px; border-radius: 9999px; background: #cbd5e1; cursor: pointer; transition: all 0.2s;"></span>
              <span class="tour-dot" onclick="window.setStudentPortalTourStep(3)" style="width: 8px; height: 8px; border-radius: 9999px; background: #cbd5e1; cursor: pointer; transition: all 0.2s;"></span>
              <span class="tour-dot" onclick="window.setStudentPortalTourStep(4)" style="width: 8px; height: 8px; border-radius: 9999px; background: #cbd5e1; cursor: pointer; transition: all 0.2s;"></span>
            </div>
          </div>

          <button type="button" onclick="window.closeStudentPortalTour(true)" 
            style="background: transparent; border: none; font-size: 0.8rem; font-weight: 700; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border-radius: 0.4rem;" 
            onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='#64748b'">
            <span>تخطي</span>
            ${getIcon('close', 14, '#64748b')}
          </button>
        </div>

        <!-- Body / Step Cards Container -->
        <div style="padding: 1.5rem 1.25rem 1.25rem; min-height: 330px; display: flex; flex-direction: column; justify-content: center;">
          
          <!-- STEP 1: Study Materials -->
          <div id="student-tour-card-1" class="student-tour-step-card" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <!-- Visual Graphic -->
            <div style="width: 72px; height: 72px; border-radius: 1.25rem; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);">
              ${getIcon('materials', 36, '#2563eb')}
            </div>
            
            <span style="font-size: 0.8rem; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 0.2rem 0.75rem; border-radius: 9999px; margin-bottom: 0.4rem;">
              الخانة الأولى
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0 0 0.5rem 0;">
              المذكرات وملازم الشرح
            </h3>
            <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0 0 1rem 0;">
              هنا هتلاقي كل ملازم الحصص وملخصات الدروس والـ PDF اللي المعلم بيرفعها لمجموعتك.
            </p>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem; width: 100%; box-sizing: border-box; text-align: right; display: flex; flex-direction: column; gap: 0.4rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #334155; font-weight: 700;">
                <span style="color: #10b981;">✓</span>
                <span>اضغط <b>"عرض أو تحميل"</b> لتحميل الملزمة على موبايلك فوراً.</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #334155; font-weight: 700;">
                <span style="color: #10b981;">✓</span>
                <span>تذاكر منها في أي وقت ومن غير ما تحتاج نت في كل مرة.</span>
              </div>
            </div>
          </div>

          <!-- STEP 2: Homework Submissions -->
          <div id="student-tour-card-2" class="student-tour-step-card" style="display: none; flex-direction: column; align-items: center; text-align: center;">
            <!-- Visual Graphic -->
            <div style="width: 72px; height: 72px; border-radius: 1.25rem; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.12);">
              ${getIcon('homework', 36, '#059669')}
            </div>

            <span style="font-size: 0.8rem; font-weight: 800; color: #059669; background: #ecfdf5; padding: 0.2rem 0.75rem; border-radius: 9999px; margin-bottom: 0.4rem;">
              الخانة الثانية
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0 0 0.5rem 0;">
              الواجبات ورفع الحل
            </h3>
            <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0 0 0.75rem 0;">
              اعرف الواجب المطلوب منك، وحل في كشكولك وارفع الحل في ثوانٍ!
            </p>

            <!-- Visual 3-step pills -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; width: 100%; margin-bottom: 0.75rem;">
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem 0.25rem; font-size: 0.75rem; font-weight: 800; color: #334155;">
                <div style="font-size: 1rem; margin-bottom: 0.15rem;">📖</div>
                <span>1. حل بكشكولك</span>
              </div>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem 0.25rem; font-size: 0.75rem; font-weight: 800; color: #334155;">
                <div style="font-size: 1rem; margin-bottom: 0.15rem;">📸</div>
                <span>2. صوّر الحل</span>
              </div>
              <div style="background: #ecfdf5; border: 1px solid #86efac; border-radius: 0.5rem; padding: 0.5rem 0.25rem; font-size: 0.75rem; font-weight: 800; color: #065f46;">
                <div style="font-size: 1rem; margin-bottom: 0.15rem;">📤</div>
                <span>3. ارفع واعتمد</span>
              </div>
            </div>

            <div style="font-size: 0.8rem; color: #166534; background: #f0fdf4; border-radius: 0.5rem; padding: 0.5rem 0.75rem; width: 100%; box-sizing: border-box; text-align: right; border-right: 3px solid #16a34a;">
              المعلم بيراجع حلك ويكتبلك ملاحظات التصحيح ويعتمد واجبك فوراً!
            </div>
          </div>

          <!-- STEP 3: Quizzes & Grades -->
          <div id="student-tour-card-3" class="student-tour-step-card" style="display: none; flex-direction: column; align-items: center; text-align: center;">
            <!-- Visual Graphic -->
            <div style="width: 72px; height: 72px; border-radius: 1.25rem; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #fcd34d; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.12);">
              ${getIcon('chart', 36, '#d97706')}
            </div>

            <span style="font-size: 0.8rem; font-weight: 800; color: #b45309; background: #fffbeb; padding: 0.2rem 0.75rem; border-radius: 9999px; margin-bottom: 0.4rem;">
              الخانة الثالثة
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0 0 0.5rem 0;">
              الكويزات والامتحانات
            </h3>
            <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0 0 1rem 0;">
              كشف حساب كامل ومحدث لحظياً بكل كويز أو امتحان شهري في السنتر.
            </p>

            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 0.75rem; padding: 0.75rem 1rem; width: 100%; box-sizing: border-box; text-align: right; display: flex; flex-direction: column; gap: 0.4rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #78350f; font-weight: 700;">
                <span>🎯</span>
                <span>درجتك من الدرجة النهائية والنسبة المئوية لكل كويز.</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #78350f; font-weight: 700;">
                <span>💬</span>
                <span>ملاحظات المعلم وتوجيهاته لتصحيح أخطائك ورفع مستواك.</span>
              </div>
            </div>
          </div>

          <!-- STEP 4: Barcode Attendance Pass -->
          <div id="student-tour-card-4" class="student-tour-step-card" style="display: none; flex-direction: column; align-items: center; text-align: center;">
            <!-- Visual Graphic -->
            <div style="width: 72px; height: 72px; border-radius: 1.25rem; background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border: 1px solid #c4b5fd; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);">
              ${getIcon('barcode', 36, '#7c3aed')}
            </div>

            <span style="font-size: 0.8rem; font-weight: 800; color: #7c3aed; background: #f5f3ff; padding: 0.2rem 0.75rem; border-radius: 9999px; margin-bottom: 0.4rem;">
              الخانة الرابعة
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0 0 0.5rem 0;">
              باركود الحضور الشخصي
            </h3>
            <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0 0 1rem 0;">
              كارت الحضور الذكي المخصص لك لتسجيل دخولك الحصة عند باب السنتر.
            </p>

            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 0.75rem; padding: 0.75rem 1rem; width: 100%; box-sizing: border-box; text-align: right; display: flex; flex-direction: column; gap: 0.4rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #5b21b6; font-weight: 700;">
                <span>⚡</span>
                <span>أول ما توصل السنتر، افتح الباركود من موبايلك.</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #5b21b6; font-weight: 700;">
                <span>📲</span>
                <span>المشرف بيمسحه بالاسكانر ويسجل حضورك في ثانية واحدة تلقائياً!</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer / Action Buttons -->
        <div style="padding: 1rem 1.25rem; border-top: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
          <button type="button" id="student-tour-prev-btn" onclick="window.prevStudentPortalTourStep()" 
            style="display: none; background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 0.6rem 1rem; border-radius: 0.65rem; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
            السابق
          </button>

          <div style="flex: 1; display: flex; justify-content: flex-end;">
            <button type="button" id="student-tour-next-btn" onclick="window.nextStudentPortalTourStep()" 
              style="width: 100%; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; border: none; padding: 0.65rem 1.25rem; border-radius: 0.65rem; font-size: 0.88rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
              <span>التالي: الواجبات</span>
              <span>←</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

export function renderParentPortalTourHtml() {
  return `
    <!-- Parent Portal Walkthrough Tour Modal -->
    <div id="parent-portal-tour-modal" style="display: none; position: fixed; inset: 0; z-index: 99999; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); align-items: center; justify-content: center; padding: 1rem; direction: rtl; font-family: system-ui, -apple-system, sans-serif; animation: tourFadeIn 0.25s ease;">
      <div style="background: #ffffff; width: 100%; max-width: 480px; border-radius: 1.25rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column;">
        
        <!-- Header Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="background: #ecfdf5; color: #059669; font-size: 0.78rem; font-weight: 800; padding: 0.25rem 0.65rem; border-radius: 9999px; border: 1px solid #a7f3d0;" id="parent-tour-step-badge">
              الخطوة 1 من 3
            </span>
            <!-- Progress Dots -->
            <div style="display: flex; gap: 0.35rem; align-items: center;" id="parent-tour-dots">
              <span class="parent-tour-dot" onclick="window.setParentPortalTourStep(1)" style="width: 8px; height: 8px; border-radius: 9999px; background: #059669; cursor: pointer; transition: all 0.2s;"></span>
              <span class="parent-tour-dot" onclick="window.setParentPortalTourStep(2)" style="width: 8px; height: 8px; border-radius: 9999px; background: #cbd5e1; cursor: pointer; transition: all 0.2s;"></span>
              <span class="parent-tour-dot" onclick="window.setParentPortalTourStep(3)" style="width: 8px; height: 8px; border-radius: 9999px; background: #cbd5e1; cursor: pointer; transition: all 0.2s;"></span>
            </div>
          </div>

          <button type="button" onclick="window.closeParentPortalTour(true)" 
            style="background: transparent; border: none; font-size: 0.8rem; font-weight: 700; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border-radius: 0.4rem;">
            <span>تخطي</span>
            ${getIcon('close', 14, '#64748b')}
          </button>
        </div>

        <!-- Body / Step Cards Container -->
        <div style="padding: 1.5rem 1.25rem 1.25rem; min-height: 310px; display: flex; flex-direction: column; justify-content: center;">
          
          <!-- STEP 1: Instant Attendance -->
          <div id="parent-tour-card-1" class="parent-tour-step-card" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div style="width: 72px; height: 72px; border-radius: 1.25rem; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.12);">
              ${getIcon('calendar', 36, '#059669')}
            </div>
            
            <span style="font-size: 0.8rem; font-weight: 800; color: #059669; background: #ecfdf5; padding: 0.2rem 0.75rem; border-radius: 9999px; margin-bottom: 0.4rem;">
              المتابعة اللحظية
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0 0 0.5rem 0;">
              تسجيل الحضور والغياب فوراً
            </h3>
            <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0 0 1rem 0;">
              بمجرد دخول الطالب باب السنتر ومسح باركوده، يتحدث تقرير حضوره هنا بالساعة والتاريخ.
            </p>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem; width: 100%; box-sizing: border-box; text-align: right; display: flex; flex-direction: column; gap: 0.4rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #334155; font-weight: 700;">
                <span style="color: #10b981;">✓</span>
                <span>متابعة دقيقة ومستمرة لنسبة حضور والتزام الطالب.</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #334155; font-weight: 700;">
                <span style="color: #ef4444;">⚠</span>
                <span>تنبيه فوري واضح في حال تسجيل أي غياب لمراجعته.</span>
              </div>
            </div>
          </div>

          <!-- STEP 2: Quiz & Exam Monitoring -->
          <div id="parent-tour-card-2" class="parent-tour-step-card" style="display: none; flex-direction: column; align-items: center; text-align: center;">
            <div style="width: 72px; height: 72px; border-radius: 1.25rem; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);">
              ${getIcon('chart', 36, '#2563eb')}
            </div>

            <span style="font-size: 0.8rem; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 0.2rem 0.75rem; border-radius: 9999px; margin-bottom: 0.4rem;">
              كشف الدرجات
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0 0 0.5rem 0;">
              درجات الكويزات والامتحانات
            </h3>
            <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0 0 1rem 0;">
              تقرير دوري يوضح درجات الطالب في كل كويز مع النسبة المئوية ومستوى التحصيل.
            </p>

            <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 0.75rem; padding: 0.75rem 1rem; width: 100%; box-sizing: border-box; text-align: right; display: flex; flex-direction: column; gap: 0.4rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #1e40af; font-weight: 700;">
                <span>📊</span>
                <span>رصد فوري لدرجات الامتحانات فور اعتمادها من المعلم.</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #1e40af; font-weight: 700;">
                <span>📝</span>
                <span>قراءة ملاحظات وتوجيهات المعلم المباشرة على مستوى ابنكم.</span>
              </div>
            </div>
          </div>

          <!-- STEP 3: Homework & Real-time Refresh -->
          <div id="parent-tour-card-3" class="parent-tour-step-card" style="display: none; flex-direction: column; align-items: center; text-align: center;">
            <div style="width: 72px; height: 72px; border-radius: 1.25rem; background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border: 1px solid #c4b5fd; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);">
              ${getIcon('homework', 36, '#7c3aed')}
            </div>

            <span style="font-size: 0.8rem; font-weight: 800; color: #7c3aed; background: #f5f3ff; padding: 0.2rem 0.75rem; border-radius: 9999px; margin-bottom: 0.4rem;">
              الواجبات والتحديث
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0 0 0.5rem 0;">
              متابعة الواجبات وتحديث البيانات
            </h3>
            <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0 0 1rem 0;">
              معرفة هل سلّم الطالب الواجب في موعده مع زر تحديث البيانات في أي لحظة.
            </p>

            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 0.75rem; padding: 0.75rem 1rem; width: 100%; box-sizing: border-box; text-align: right; display: flex; flex-direction: column; gap: 0.4rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #5b21b6; font-weight: 700;">
                <span>✅</span>
                <span>متابعة حالة الواجب: تم التسليم والاعتماد أو بحاجة لإعادة.</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #5b21b6; font-weight: 700;">
                <span>🔄</span>
                <span>اضغط زر "تحديث البيانات" أعلى الصفحة لعرض أي مستجدات فوراً.</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer / Action Buttons -->
        <div style="padding: 1rem 1.25rem; border-top: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
          <button type="button" id="parent-tour-prev-btn" onclick="window.prevParentPortalTourStep()" 
            style="display: none; background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 0.6rem 1rem; border-radius: 0.65rem; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
            السابق
          </button>

          <div style="flex: 1; display: flex; justify-content: flex-end;">
            <button type="button" id="parent-tour-next-btn" onclick="window.nextParentPortalTourStep()" 
              style="width: 100%; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; border: none; padding: 0.65rem 1.25rem; border-radius: 0.65rem; font-size: 0.88rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
              <span>التالي: الدرجات</span>
              <span>←</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

// Global Handlers for Client-Side Interactivity
if (typeof window !== 'undefined') {
  window._studentTourCurrentStep = 1;
  const STUDENT_TOTAL_STEPS = 4;
  const STUDENT_STEP_TITLES = [
    'التالي: الواجبات ←',
    'التالي: الكويزات ←',
    'التالي: باركود الحضور ←',
    '✨ فهمت تماماً، ابدأ الآن!'
  ];

  window.setStudentPortalTourStep = function(step) {
    if (step < 1) step = 1;
    if (step > STUDENT_TOTAL_STEPS) step = STUDENT_TOTAL_STEPS;
    window._studentTourCurrentStep = step;

    // Update cards
    for (let i = 1; i <= STUDENT_TOTAL_STEPS; i++) {
      const card = document.getElementById('student-tour-card-' + i);
      if (card) {
        card.style.display = (i === step) ? 'flex' : 'none';
      }
    }

    // Update step badge
    const badge = document.getElementById('student-tour-step-badge');
    if (badge) {
      badge.textContent = `الخطوة ${step} من ${STUDENT_TOTAL_STEPS}`;
    }

    // Update dots
    const dots = document.querySelectorAll('#student-tour-dots .tour-dot');
    dots.forEach((dot, idx) => {
      if (idx + 1 === step) {
        dot.style.background = '#2563eb';
        dot.style.width = '18px';
      } else {
        dot.style.background = '#cbd5e1';
        dot.style.width = '8px';
      }
    });

    // Update previous button
    const prevBtn = document.getElementById('student-tour-prev-btn');
    if (prevBtn) {
      prevBtn.style.display = (step > 1) ? 'block' : 'none';
    }

    // Update next button
    const nextBtn = document.getElementById('student-tour-next-btn');
    if (nextBtn) {
      nextBtn.innerHTML = `<span>${STUDENT_STEP_TITLES[step - 1]}</span>`;
      if (step === STUDENT_TOTAL_STEPS) {
        nextBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
        nextBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
      } else {
        nextBtn.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';
        nextBtn.style.boxShadow = '0 4px 10px rgba(37, 99, 235, 0.25)';
      }
    }
  };

  window.nextStudentPortalTourStep = function() {
    if (window._studentTourCurrentStep < STUDENT_TOTAL_STEPS) {
      window.setStudentPortalTourStep(window._studentTourCurrentStep + 1);
    } else {
      window.closeStudentPortalTour(true);
    }
  };

  window.prevStudentPortalTourStep = function() {
    if (window._studentTourCurrentStep > 1) {
      window.setStudentPortalTourStep(window._studentTourCurrentStep - 1);
    }
  };

  window.openStudentPortalTour = function(force = true) {
    const modal = document.getElementById('student-portal-tour-modal');
    if (!modal) return;
    if (!force) {
      const seen = localStorage.getItem('centrly_student_tour_seen');
      if (seen === 'true') return;
    }
    window.setStudentPortalTourStep(1);
    modal.style.display = 'flex';
  };

  window.closeStudentPortalTour = function(markSeen = true) {
    const modal = document.getElementById('student-portal-tour-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    if (markSeen) {
      try {
        localStorage.setItem('centrly_student_tour_seen', 'true');
      } catch (_) {}
    }
  };

  // --- Parent Portal Handlers ---
  window._parentTourCurrentStep = 1;
  const PARENT_TOTAL_STEPS = 3;
  const PARENT_STEP_TITLES = [
    'التالي: درجات الكويزات ←',
    'التالي: الواجبات والتحديث ←',
    '✨ فهمت تماماً، ابدأ الآن!'
  ];

  window.setParentPortalTourStep = function(step) {
    if (step < 1) step = 1;
    if (step > PARENT_TOTAL_STEPS) step = PARENT_TOTAL_STEPS;
    window._parentTourCurrentStep = step;

    for (let i = 1; i <= PARENT_TOTAL_STEPS; i++) {
      const card = document.getElementById('parent-tour-card-' + i);
      if (card) {
        card.style.display = (i === step) ? 'flex' : 'none';
      }
    }

    const badge = document.getElementById('parent-tour-step-badge');
    if (badge) {
      badge.textContent = `الخطوة ${step} من ${PARENT_TOTAL_STEPS}`;
    }

    const dots = document.querySelectorAll('#parent-tour-dots .parent-tour-dot');
    dots.forEach((dot, idx) => {
      if (idx + 1 === step) {
        dot.style.background = '#059669';
        dot.style.width = '18px';
      } else {
        dot.style.background = '#cbd5e1';
        dot.style.width = '8px';
      }
    });

    const prevBtn = document.getElementById('parent-tour-prev-btn');
    if (prevBtn) {
      prevBtn.style.display = (step > 1) ? 'block' : 'none';
    }

    const nextBtn = document.getElementById('parent-tour-next-btn');
    if (nextBtn) {
      nextBtn.innerHTML = `<span>${PARENT_STEP_TITLES[step - 1]}</span>`;
    }
  };

  window.nextParentPortalTourStep = function() {
    if (window._parentTourCurrentStep < PARENT_TOTAL_STEPS) {
      window.setParentPortalTourStep(window._parentTourCurrentStep + 1);
    } else {
      window.closeParentPortalTour(true);
    }
  };

  window.prevParentPortalTourStep = function() {
    if (window._parentTourCurrentStep > 1) {
      window.setParentPortalTourStep(window._parentTourCurrentStep - 1);
    }
  };

  window.openParentPortalTour = function(force = true) {
    const modal = document.getElementById('parent-portal-tour-modal');
    if (!modal) return;
    if (!force) {
      const seen = localStorage.getItem('centrly_parent_tour_seen');
      if (seen === 'true') return;
    }
    window.setParentPortalTourStep(1);
    modal.style.display = 'flex';
  };

  window.closeParentPortalTour = function(markSeen = true) {
    const modal = document.getElementById('parent-portal-tour-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    if (markSeen) {
      try {
        localStorage.setItem('centrly_parent_tour_seen', 'true');
      } catch (_) {}
    }
  };
}
