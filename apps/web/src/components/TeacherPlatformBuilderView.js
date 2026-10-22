import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";

/**
 * Centrly White-Label Platform Builder View
 * Allows teachers to configure, brand, preview, and launch their custom platform.
 * Includes PRO plan tier gating with interactive preview for non-PRO users.
 */

export function renderTeacherPlatformBuilderView(state = {}, user = {}) {
  const settings = state.settings || {};
  const plan = state.plan || {};
  const isPro = Boolean(plan.is_pro);

  const subdomain = settings.subdomain || "";
  const displayTitle = settings.display_title || (user.name ? `منصة ${user.name}` : "منصة الأستاذ");
  const subjectTitle = settings.subject_title || user.subject || "المرحلة الثانوية";
  const headlineText = settings.headline_text || "بوابتك التعليمية الشاملة للتفوق والدرجة النهائية";
  const subtitleText = settings.subtitle_text || "هنا تجد كل ما تحتاجه من واجبات تفاعلية، امتحانات دورية، وشروحات ومذكرات معتمدة.";
  const themePreset = settings.theme_preset || "navy";
  const cutoutAvatarUrl = settings.cutout_avatar_url || "";
  const isActive = settings.is_active !== false;

  return `
    <div class="platform-builder-view" style="max-width: 1200px; margin: 0 auto; padding-bottom: 3rem;">
      
      <!-- الهيدر الترحيبي وشارة PRO -->
      <div style="background: linear-gradient(135deg, #11204d 0%, #0d173b 100%); color: #ffffff; border-radius: 16px; padding: 24px 28px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 25px -5px rgba(15,23,42,0.2);">
        <div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <h1 style="font-size: 1.4rem; font-weight: 900; margin: 0; color: #ffffff;">إنشاء وتخصيص منصتك الخاصة</h1>
            <span style="background: #f59e0b; color: #0f172a; font-size: 0.75rem; font-weight: 900; padding: 2px 10px; border-radius: 20px; letter-spacing: 0.5px;">PRO</span>
          </div>
          <p style="font-size: 0.88rem; color: #cbd5e1; margin: 0; max-width: 650px; line-height: 1.6;">
            أطلق منصتك التعليمية بهويتك البصرية، وألوانك الموحدة، ورابطك المستقل لطلابك بدون أي تعقيد.
          </p>
        </div>

        <div style="text-align: left;">
          ${isPro ? `
            <div style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; padding: 6px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
              <span>حسابك مفعل في باقة برو</span>
            </div>
          ` : `
            <button type="button" onclick="window.centrlyApp && window.centrlyApp.navigateTo('settings')" style="background: #f59e0b; color: #0f172a; border: none; padding: 10px 20px; border-radius: 8px; font-size: 0.88rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
              <span>ترقية لباقة PRO للتفعيل</span>
            </button>
          `}
        </div>
      </div>

      ${!isPro ? `
        <!-- تنبيه المعاينة للمشتركين العاديين -->
        <div style="background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 8px; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${getIcon('info', 20, '#b45309')}
            </div>
            <div>
              <h4 style="font-size: 0.92rem; font-weight: 800; margin: 0 0 2px 0;">أنت الآن في وضع المعاينة التجريبية</h4>
              <p style="font-size: 0.8rem; margin: 0; color: #b45309;">
                يمكنك تخصيص اسم ورابط وألوان منصتك ورؤية شكلها في المعاينة الحية. عند الرغبة في نشر وتفعيل الرابط للطلاب يلزم الترقية لباقة PRO.
              </p>
            </div>
          </div>
          <button type="button" onclick="window.centrlyApp && window.centrlyApp.navigateTo('settings')" style="background: #b45309; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; font-weight: 800; cursor: pointer;">
            ترقية الحساب الآن
          </button>
        </div>
      ` : ''}

      <!-- شبكة البناء: الإعدادات على اليمين والمعاينة الحية على اليسار -->
      <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 24px; align-items: start;">
        
        <!-- العمود الأيمن: نموذج الإعدادات -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
          
          <!-- القسم 1: حجز السب دومين -->
          <div class="card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px;">
            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">1. رابط المنصة المخصص (السب دومين)</h3>
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 16px;">الرابط الذي ستشاركه مع طلابك للدخول لمنصتك الخاصة مباشرة.</p>
            
            <div style="margin-bottom: 10px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 6px;">اختر اسم الرابط (بالحروف الإنجليزية والأرقام)</label>
              <div style="display: flex; align-items: center; direction: ltr; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; height: 44px;">
                <span style="background: #e2e8f0; color: #475467; font-size: 0.85rem; font-weight: 800; padding: 0 12px; height: 100%; display: flex; align-items: center; border-right: 1px solid #cbd5e1;">https://</span>
                <input type="text" id="builderSubdomainInput" value="${escapeHtml(subdomain)}" placeholder="omarjamal" 
                  style="border: none; background: transparent; padding: 0 12px; font-size: 0.95rem; font-weight: 800; color: #0f172a; outline: none; flex: 1; text-align: left;"
                  oninput="window.teacherPlatformActions.handleSubdomainInput(this.value)">
                <span style="background: #e2e8f0; color: #475467; font-size: 0.85rem; font-weight: 800; padding: 0 12px; height: 100%; display: flex; align-items: center; border-left: 1px solid #cbd5e1;">.centrly.com</span>
              </div>
              <div id="subdomainCheckFeedback" style="font-size: 0.78rem; font-weight: 700; margin-top: 6px; min-height: 20px;"></div>
            </div>
          </div>

          <!-- القسم 2: الاسم والعنوان الترويجي -->
          <div class="card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px;">
            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">2. بيانات وهوية المنصة</h3>
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 16px;">العناوين والنصوص التي تظهر للطلاب في صفحة الدخول والسايد بار.</p>

            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 6px;">اسم المنصة الرسمي</label>
              <input type="text" id="builderDisplayTitleInput" value="${escapeHtml(displayTitle)}" placeholder="مثال: منصة الأستاذ عمر جمال"
                style="width: 100%; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px; font-size: 0.9rem; font-weight: 700;"
                oninput="window.teacherPlatformActions.updatePreviewText('title', this.value)">
            </div>

            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 6px;">التخصص والمرحلة الدراسية</label>
              <input type="text" id="builderSubjectTitleInput" value="${escapeHtml(subjectTitle)}" placeholder="مثال: خبير اللغة الإنجليزية للثانوية العامة"
                style="width: 100%; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px; font-size: 0.9rem; font-weight: 700;"
                oninput="window.teacherPlatformActions.updatePreviewText('subject', this.value)">
            </div>

            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 6px;">العنوان الرئيسي الترويجي</label>
              <input type="text" id="builderHeadlineInput" value="${escapeHtml(headlineText)}" placeholder="مثال: بوابتك التعليمية الشاملة للتفوق والدرجة النهائية"
                style="width: 100%; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px; font-size: 0.9rem; font-weight: 700;"
                oninput="window.teacherPlatformActions.updatePreviewText('headline', this.value)">
            </div>
          </div>

          <!-- القسم 3: الصورة المفرغة واللون الموحد -->
          <div class="card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px;">
            <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">3. اللون الموحد وصورة المدرس</h3>
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 16px;">اختر لون علامتك التجارية وارفع صورتك المفرغة للظهور داخل الفريم الدائري.</p>

            <div style="margin-bottom: 18px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 8px;">اختر اللون الموحد لمنصتك</label>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${[
                  { id: 'navy', name: 'كحلي ملكي', color: '#11204d' },
                  { id: 'red', name: 'أحمر ناري', color: '#b91c1c' },
                  { id: 'emerald', name: 'زمردي راقي', color: '#064e3b' },
                  { id: 'purple', name: 'بنفسجي فاخر', color: '#581c87' },
                  { id: 'slate', name: 'أسود كربوني', color: '#0f172a' },
                ].map(th => `
                  <button type="button" class="builder-theme-btn ${themePreset === th.id ? 'active' : ''}" 
                    data-theme="${th.id}"
                    onclick="window.teacherPlatformActions.selectTheme('${th.id}')"
                    style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; border: 1.5px solid ${themePreset === th.id ? '#2563eb' : '#e2e8f0'}; background: #ffffff; cursor: pointer; font-size: 0.82rem; font-weight: 800;">
                    <span style="width: 14px; height: 14px; border-radius: 50%; background: ${th.color}; display: inline-block;"></span>
                    <span>${th.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div style="margin-bottom: 10px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 6px;">رابط الصورة المفرغة (PNG Cutout)</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="builderCutoutInput" value="${escapeHtml(cutoutAvatarUrl)}" placeholder="https://.../photo.png أو ارفع ملفك"
                  style="flex: 1; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px; font-size: 0.85rem;"
                  oninput="window.teacherPlatformActions.updatePreviewAvatar(this.value)">
                <button type="button" onclick="document.getElementById('builderCutoutFileUploader').click()" 
                  style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 14px; font-size: 0.82rem; font-weight: 800; cursor: pointer; color: #334155;">
                  رفع صورة
                </button>
                <input type="file" id="builderCutoutFileUploader" accept="image/png,image/jpeg,image/webp" style="display: none;" onchange="window.teacherPlatformActions.handleImageUpload(event)">
              </div>
              <p style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">يُفضل رفع صورة بصيغة PNG شفافة بدون خلفية للحصول على تأثير الخروج من الفريم بأفضل شكل.</p>
            </div>
          </div>

          <!-- زر الحفظ والنشر -->
          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 6px;">
            <button type="button" id="btnPublishPlatform" onclick="window.teacherPlatformActions.savePlatformSettings()" 
              style="background: ${isPro ? '#11204d' : '#94a3b8'}; color: #ffffff; border: none; height: 48px; padding: 0 32px; border-radius: 10px; font-size: 0.95rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(17,32,77,0.25);">
              <span>${isPro ? 'حفظ ونشر منصتي الآن' : 'حفظ ونشر (يلزم باقة PRO)'}</span>
            </button>
          </div>

        </div>

        <!-- العمود الأيسر: المعاينة الحية الفورية (Live Phone Mockup Preview) -->
        <div style="position: sticky; top: 20px;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; box-shadow: 0 4px 20px -2px rgba(15,23,42,0.06);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">معاينة فورية حية للمنصة</span>
              <span style="font-size: 0.72rem; color: #10b981; font-weight: 800; background: #ecfdf5; padding: 2px 8px; border-radius: 4px;">تحديث مباشر</span>
            </div>

            <!-- مجسم المعاينة -->
            <div id="livePreviewContainer" style="background: #11204d; border-radius: 12px; padding: 16px; color: #ffffff; min-height: 440px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; transition: background 0.3s ease;">
              
              <!-- هيدر المعاينة المصغر -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; position: relative; z-index: 2;">
                <div>
                  <div id="previewTitle" style="font-size: 0.88rem; font-weight: 900;">${escapeHtml(displayTitle)}</div>
                  <div id="previewSubdomain" style="font-size: 0.68rem; color: rgba(255,255,255,0.7); direction: ltr;">${escapeHtml(subdomain || 'yourname')}.centrly.com</div>
                </div>
                <span style="background: rgba(255,255,255,0.15); font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">تسجيل دخول</span>
              </div>

              <!-- قلب المعاينة: صورة المدرس داخل/خارج الفريم -->
              <div style="position: relative; width: 100%; height: 260px; display: flex; justify-content: center; align-items: flex-end; margin: 10px 0;">
                <div id="previewCircleBackdrop" style="position: absolute; bottom: 0; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, #2563eb 0%, #0a1330 100%); border: 2px solid rgba(255,255,255,0.25); z-index: 1;"></div>
                <div style="position: relative; width: 200px; height: 260px; border-radius: 0 0 100px 100px; overflow: hidden; display: flex; justify-content: center; align-items: flex-end; z-index: 2;">
                  <img id="previewAvatarImg" src="${escapeHtml(cutoutAvatarUrl || '/teacher-platform-sample/teacher_cutout.png')}" 
                    style="width: 100%; max-height: 250px; object-fit: contain; object-position: bottom center;" 
                    onerror="this.src='/teacher-platform-sample/teacher_cutout.png'">
                </div>
              </div>

              <!-- نصوص الهيدر في المعاينة -->
              <div style="position: relative; z-index: 2; text-align: center; margin-top: 8px;">
                <h4 id="previewHeadline" style="font-size: 0.88rem; font-weight: 900; margin: 0 0 4px 0; line-height: 1.3;">${escapeHtml(headlineText)}</h4>
                <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 8px; margin-top: 10px;">
                  <span style="font-size: 0.72rem; color: #e2e8f0; display: block; margin-bottom: 6px;">كارت تسجيل دخول الطالب</span>
                  <div style="height: 26px; background: rgba(0,0,0,0.25); border-radius: 4px; margin-bottom: 6px;"></div>
                  <div style="height: 28px; background: #ffffff; color: #11204d; border-radius: 4px; font-size: 0.72rem; font-weight: 800; display: flex; align-items: center; justify-content: center;">دخول إلى منصتي</div>
                </div>
              </div>

            </div>

            <!-- رابط المشاركة الجاهز إذا كانت المنصة محفوظة ومفعلة -->
            ${subdomain ? `
              <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a; margin-bottom: 6px;">رابط منصتك الحالي:</div>
                <div style="display: flex; gap: 6px;">
                  <input type="text" readonly value="https://${escapeHtml(subdomain)}.centrly.com" 
                    style="flex: 1; height: 34px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; font-weight: 700; padding: 0 8px; direction: ltr;">
                  <button type="button" onclick="navigator.clipboard.writeText('https://${escapeHtml(subdomain)}.centrly.com'); alert('تم نسخ رابط منصتك بنجاح!');" 
                    style="background: #11204d; color: #ffffff; border: none; padding: 0 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
                    نسخ
                  </button>
                </div>
              </div>
            ` : ''}

          </div>
        </div>

      </div>

    </div>
  `;
}

/**
 * Global Actions Object attached to window for builder interactivity
 */
export function registerTeacherPlatformActions(appInstance) {
  let debounceTimer = null;
  let currentTheme = 'navy';

  const themeColors = {
    navy: { bg: '#11204d', circle: 'radial-gradient(circle, #2563eb 0%, #0a1330 100%)' },
    red: { bg: '#b91c1c', circle: 'radial-gradient(circle, #ef4444 0%, #7f1d1d 100%)' },
    emerald: { bg: '#064e3b', circle: 'radial-gradient(circle, #10b981 0%, #022c22 100%)' },
    purple: { bg: '#581c87', circle: 'radial-gradient(circle, #9333ea 0%, #2e1065 100%)' },
    slate: { bg: '#0f172a', circle: 'radial-gradient(circle, #334155 0%, #020617 100%)' },
  };

  window.teacherPlatformActions = {
    selectTheme(themeId) {
      currentTheme = themeId;
      document.querySelectorAll('.builder-theme-btn').forEach(btn => {
        if (btn.getAttribute('data-theme') === themeId) {
          btn.style.borderColor = '#2563eb';
        } else {
          btn.style.borderColor = '#e2e8f0';
        }
      });

      const conf = themeColors[themeId] || themeColors.navy;
      const previewBox = document.getElementById('livePreviewContainer');
      const circle = document.getElementById('previewCircleBackdrop');
      if (previewBox) previewBox.style.background = conf.bg;
      if (circle) circle.style.background = conf.circle;
    },

    updatePreviewText(field, val) {
      if (field === 'title') {
        const el = document.getElementById('previewTitle');
        if (el) el.innerText = val || 'منصة الأستاذ';
      } else if (field === 'headline') {
        const el = document.getElementById('previewHeadline');
        if (el) el.innerText = val || 'بوابتك التعليمية الشاملة';
      }
    },

    updatePreviewAvatar(url) {
      const el = document.getElementById('previewAvatarImg');
      if (el) el.src = url || '/teacher-platform-sample/teacher_cutout.png';
    },

    handleSubdomainInput(val) {
      const clean = (val || '').trim().toLowerCase();
      const previewSub = document.getElementById('previewSubdomain');
      if (previewSub) previewSub.innerText = `${clean || 'yourname'}.centrly.com`;

      const feedback = document.getElementById('subdomainCheckFeedback');
      if (!feedback) return;

      if (!clean) {
        feedback.innerText = '';
        return;
      }

      if (debounceTimer) clearTimeout(debounceTimer);
      feedback.style.color = '#64748b';
      feedback.innerText = 'جاري التحقق من توفر الرابط...';

      debounceTimer = setTimeout(async () => {
        try {
          const res = await request(`/platform/check/${encodeURIComponent(clean)}`);
          if (res && res.available) {
            feedback.style.color = '#059669';
            feedback.innerText = 'هذا الرابط متاح ومناسب للاستخدام';
          } else {
            feedback.style.color = '#dc2626';
            feedback.innerText = res?.reason || 'هذا الرابط غير متاح';
          }
        } catch (_) {
          feedback.innerText = '';
        }
      }, 450);
    },

    handleImageUpload(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      // Local preview via FileReader
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        document.getElementById('builderCutoutInput').value = base64;
        window.teacherPlatformActions.updatePreviewAvatar(base64);
      };
      reader.readAsDataURL(file);
    },

    async savePlatformSettings() {
      const plan = appInstance.platformBuilderState?.plan || {};
      if (!plan.is_pro) {
        alert('ميزة تفعيل ونشر منصتك المستقلة متاحة فقط لمشتركي باقة PRO. اضغط حسناً للانتقال لصفحة الاشتراك والترقية.');
        appInstance.navigateTo('settings');
        return;
      }

      const subdomain = document.getElementById('builderSubdomainInput')?.value?.trim();
      const displayTitle = document.getElementById('builderDisplayTitleInput')?.value?.trim();
      const subjectTitle = document.getElementById('builderSubjectTitleInput')?.value?.trim();
      const headlineText = document.getElementById('builderHeadlineInput')?.value?.trim();
      const cutoutAvatarUrl = document.getElementById('builderCutoutInput')?.value?.trim();

      if (!subdomain) {
        alert('يرجى تحديد اسم الرابط (السب دومين) أولاً');
        return;
      }

      if (!displayTitle) {
        alert('يرجى إدخال اسم المنصة الرسمي');
        return;
      }

      if (!subjectTitle) {
        alert('يرجى إدخال تخصص المعلم والمرحلة الدراسية');
        return;
      }

      try {
        appInstance.startProgressBar();
        const res = await request('/platform/settings', {
          method: 'POST',
          body: JSON.stringify({
            subdomain,
            display_title: displayTitle,
            subject_title: subjectTitle,
            headline_text: headlineText,
            cutout_avatar_url: cutoutAvatarUrl,
            theme_preset: currentTheme,
            is_active: true,
          }),
        });

        appInstance.finishProgressBar();
        if (res && res.success) {
          alert('تم حفظ ونشر إعدادات منصتك بنجاح! الرابط أصبح فعالاً لطلابك الآن.');
          if (appInstance.loadRouteData) {
            await appInstance.loadRouteData('platform-builder', true);
          }
          appInstance.render();
        }
      } catch (err) {
        appInstance.finishProgressBar();
        alert(err.message || 'حدث خطأ أثناء حفظ الإعدادات');
      }
    },
  };
}
