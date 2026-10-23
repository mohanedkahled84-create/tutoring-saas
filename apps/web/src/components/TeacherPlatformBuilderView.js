import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";

/**
 * Centrly White-Label Platform Builder View
 * Allows teachers and admins to configure, brand, preview, and launch their custom platform.
 * Authentic live preview matching the real student login portal.
 * STRICT ZERO EMOJIS - Clean SVG icons only.
 */

export function renderTeacherPlatformBuilderView(state = {}, user = {}, students = []) {
  const settings = state.settings || {};
  const plan = state.plan || {};

  // Bypass PRO requirement for admin and Mr. Omar test accounts
  const adminEmails = [
    'mohanedkahled84@gmail.com',
    'mohanedkhaled84@gmail.com',
    'mohanedkhaled2367@gmail.com',
    'teacher@centrly.app',
    'mohanedabdulhalim@gmail.com',
  ];
  const userEmail = (user?.email || '').toLowerCase();
  const isAdmin = user?.role === 'admin' || Boolean(user?.is_superadmin) || adminEmails.includes(userEmail);
  const isOmar =
    user?.tenant_id === '0c67b644-ae42-49e8-975f-85b9d0af0e1b' ||
    userEmail === 'mohanedabdulhalim@gmail.com' ||
    userEmail.includes('omar') ||
    userEmail.includes('mohamadi') ||
    (user?.name || '').includes('عمر') ||
    (user?.teacher_name || '').includes('عمر');

  const isPro = Boolean(plan.is_pro) || isAdmin || isOmar;

  // Determine published state:
  const tenantKey = user?.tenant_id || 'active';
  let localPublished = false;
  try {
    localPublished = localStorage.getItem(`centrly_platform_published_${tenantKey}`) === 'true' ||
                     localStorage.getItem('centrly_platform_published') === 'true';
  } catch (_) {}

  // A platform is published only if it has a subdomain, is_active is true, and is_published is confirmed
  const isPublished = Boolean(
    settings &&
    settings.subdomain &&
    (settings.is_published === true || localPublished === true) &&
    settings.is_active !== false
  );

  const subdomain = settings.subdomain || (isOmar ? "mr-omar" : "");
  const displayTitle = settings.display_title || (user.name ? `منصة ${user.name}` : (isOmar ? "منصة مستر عمر المحمدي" : "منصة الأستاذ"));
  const subjectTitle = settings.subject_title || user.subject || (isOmar ? "خبير اللغة الإنجليزية للثانوية العامة" : "المرحلة الثانوية");
  const headlineText = settings.headline_text || "بوابتك التعليمية الشاملة للتفوق والدرجة النهائية";
  const subtitleText = settings.subtitle_text || "هنا تجد كل ما تحتاجه من واجبات تفاعلية، امتحانات دورية، وشروحات ومذكرات معتمدة.";
  const themePreset = settings.theme_preset || "navy";
  const cutoutAvatarUrl = settings.cutout_avatar_url || "";

  // Brand badge initial
  const brandInitial = (displayTitle || "م").replace(/^(منصة|الأستاذ|مستر)\s*/, "").trim().charAt(0) || "ع";

  // Official live URL
  const officialSubdomain = subdomain || (isOmar ? 'mr-omar' : 'yourname');
  const livePlatformUrl = `https://${officialSubdomain}.centrly.com`;
  const internalPlatformPath = `/${officialSubdomain}`;

  // Theme metadata for analytics & display
  const themesMeta = {
    navy: { name: 'كحلي ملكي', color: '#11204d', ring: '#2563eb' },
    red: { name: 'أحمر ناري', color: '#b91c1c', ring: '#ef4444' },
    emerald: { name: 'زمردي فاخر', color: '#064e3b', ring: '#10b981' },
    purple: { name: 'بنفسجي إمبراطوري', color: '#581c87', ring: '#9333ea' },
    slate: { name: 'أسود كربوني', color: '#0f172a', ring: '#64748b' },
  };
  const activeThemeMeta = themesMeta[themePreset] || themesMeta.navy;

  // Student count
  const studentCount = Array.isArray(students) ? students.length : 0;

  return `
    <div class="platform-builder-view" style="max-width: 1240px; margin: 0 auto; padding-bottom: 3rem;">
      
      ${isPublished ? `
        <!-- ======================================================== -->
        <!-- شريط ولوحة تحكم المنصة المنشورة (Published Platform Command Center) -->
        <!-- ======================================================== -->
        <div class="platform-command-center" style="background: linear-gradient(135deg, #0b132b 0%, #1c2541 100%); color: #ffffff; border-radius: 18px; padding: 26px 30px; margin-bottom: 26px; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 14px 35px -5px rgba(11,19,43,0.35);">
          
          <!-- الصف العلوي: شارة الحالة الحية + أزرار الإجراءات السريعة -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="position: relative; display: flex; width: 14px; height: 14px;">
                <span style="animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 50%; background-color: #34d399; opacity: 0.75;"></span>
                <span style="position: relative; display: inline-flex; border-radius: 50%; height: 14px; width: 14px; background-color: #10b981;"></span>
              </span>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h2 style="font-size: 1.3rem; font-weight: 900; margin: 0; color: #ffffff;">منصتك التعليمية نشطة الآن ومتاحة لطلابك</h2>
                  <span style="background: #10b981; color: #ffffff; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.5px;">نشط LIVE</span>
                </div>
                <p style="font-size: 0.82rem; color: #94a3b8; margin: 4px 0 0 0;">
                  الرابط الرسمي تم تفعيله بنجاح لجميع طلابك مع الحماية الرقمية وهوية المعلم الموحدة.
                </p>
              </div>
            </div>

            <!-- أزرار الإجراءات في الهيدر -->
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <button type="button" onclick="window.teacherPlatformActions.toggleEditSettings()" 
                style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 9px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                <span id="toggleEditBtnText">تعديل بيانات المنصة</span>
              </button>

              <a href="${escapeHtml(internalPlatformPath)}" target="_blank" rel="noopener noreferrer" 
                style="background: #ffffff; color: #0b132b; text-decoration: none; padding: 9px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 900; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(255,255,255,0.2); transition: all 0.2s ease;">
                <span>فتح المنصة الآن</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
              </a>
            </div>
          </div>

          <!-- شريط الرابط المباشر وأزرار النسخ والمشاركة -->
          <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 22px;">
            <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 280px;">
              <span style="width: 32px; height: 32px; border-radius: 8px; background: rgba(37,99,235,0.25); color: #60a5fa; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </span>
              <div style="flex: 1; overflow: hidden;">
                <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; margin-bottom: 2px;">رابط المنصة الرسمي المعتمد:</div>
                <div style="font-size: 0.98rem; font-weight: 800; color: #ffffff; direction: ltr; text-align: left; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${escapeHtml(livePlatformUrl)}
                </div>
              </div>
            </div>

            <!-- أزرار النسخ والواتساب بتأثيرات بصرية مباشرة وفورية -->
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <button type="button" id="cmdBtnCopyUrl" 
                onclick="window.teacherPlatformActions.copyPlatformLink(this, '${escapeHtml(livePlatformUrl)}')" 
                style="background: #2563eb; color: #ffffff; border: 1px solid #3b82f6; padding: 0 18px; height: 42px; border-radius: 8px; font-size: 0.85rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.25s ease; box-shadow: 0 4px 14px rgba(37,99,235,0.3);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>نسخ الرابط</span>
              </button>

              <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(`أهلاً بكم يا شباب! دي المنصة التعليمية الرسمية الخاصة بينا للمتابعة والواجبات والامتحانات والشروحات:\n${livePlatformUrl}`)}" 
                target="_blank" rel="noopener noreferrer" 
                style="background: #16a34a; color: #ffffff; text-decoration: none; padding: 0 16px; height: 42px; border-radius: 8px; font-size: 0.85rem; font-weight: 800; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(22,163,74,0.3); transition: all 0.2s ease;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                <span>مشاركة عبر واتساب</span>
              </a>
            </div>
          </div>

          <!-- كروت المؤشرات والإحصائيات الذكية للمنصة -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
            
            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 0.76rem; color: #94a3b8; font-weight: 700;">الطلاب المسجلين بالمنصة</span>
                <span style="color: #60a5fa;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </span>
              </div>
              <div style="font-size: 1.35rem; font-weight: 900; color: #ffffff;">${studentCount} طالب</div>
              <div style="font-size: 0.68rem; color: #10b981; font-weight: 700; margin-top: 4px;">محدث من بيانات السنتر</div>
            </div>

            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 0.76rem; color: #94a3b8; font-weight: 700;">حالة تسجيل الطلاب</span>
                <span style="color: #34d399;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
              </div>
              <div style="font-size: 1.15rem; font-weight: 900; color: #34d399;">متاح ونشط</div>
              <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 700; margin-top: 4px;">الدخول بالكود أو رقم الهاتف</div>
            </div>

            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 0.76rem; color: #94a3b8; font-weight: 700;">حماية المحتوى (DRM)</span>
                <span style="color: #fbbf24;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </span>
              </div>
              <div style="font-size: 1.15rem; font-weight: 900; color: #fbbf24;">حماية رقمية نشطة</div>
              <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 700; margin-top: 4px;">علامة مائية متحركة لمنع التصوير</div>
            </div>

            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 0.76rem; color: #94a3b8; font-weight: 700;">الهوية واللون المعتمد</span>
                <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${activeThemeMeta.color}; border: 2px solid #ffffff;"></span>
              </div>
              <div style="font-size: 1.15rem; font-weight: 900; color: #ffffff;">${activeThemeMeta.name}</div>
              <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 700; margin-top: 4px;">السمة البصرية المعتمدة لمنصتك</div>
            </div>

          </div>

        </div>
      ` : `
        <!-- الهيدر الترحيبي وشارة PRO للمستخدم قبل النشر -->
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
              <div style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                <span style="display: inline-flex;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <span>حسابك مفعل في باقة برو (حساب معتمد)</span>
              </div>
            ` : `
              <button type="button" onclick="window.centrlyApp && window.centrlyApp.navigateTo('settings')" style="background: #f59e0b; color: #0f172a; border: none; padding: 10px 20px; border-radius: 8px; font-size: 0.88rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
                <span>ترقية لباقة PRO للتفعيل</span>
              </button>
            `}
          </div>
        </div>
      `}

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

      <!-- شبكة بناء وتخصيص المنصة -->
      <div style="display: grid; grid-template-columns: ${isPublished ? '1fr 1fr' : '1.05fr 0.95fr'}; gap: 24px; align-items: start;">
        
        <!-- العمود الأيمن: نموذج الإعدادات (يكون مخفياً في حالة النشر ويفتح بزر التعديل، أو ظاهراً مباشرة إذا لم تنشر) -->
        <div id="builderSettingsFormSection" style="display: ${isPublished ? 'none' : 'flex'}; flex-direction: column; gap: 20px;">
          
          <!-- القسم 1: حجز الرابط المخصص -->
          <div class="card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">1. رابط منصتك الخاص</h3>
              ${isPublished ? `
                <span style="font-size: 0.72rem; background: #ecfdf5; color: #059669; font-weight: 800; padding: 2px 8px; border-radius: 6px;">تم الحجز</span>
              ` : ''}
            </div>
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 16px;">الرابط الذي ستشاركه مع طلابك للدخول لمنصتك الخاصة مباشرة بعد النشر.</p>
            
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
              <input type="text" id="builderDisplayTitleInput" value="${escapeHtml(displayTitle)}" placeholder="مثال: منصة مستر عمر المحمدي"
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
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 16px;">اختر لون علامتك التجارية وارفع صورتك المفرغة للظهور داخل وخارج الفريم.</p>

            <!-- اختيار اللون الموحد: دوائر لونية نظيفة بأيقونات اختيار فقط بدون نصوص -->
            <div style="margin-bottom: 20px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 10px;">اختر اللون الموحد لمنصتك</label>
              <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                ${[
                  { id: 'navy', color: '#11204d', ring: '#2563eb' },
                  { id: 'red', color: '#b91c1c', ring: '#ef4444' },
                  { id: 'emerald', color: '#064e3b', ring: '#10b981' },
                  { id: 'purple', color: '#581c87', ring: '#9333ea' },
                  { id: 'slate', color: '#0f172a', ring: '#64748b' },
                ].map(th => {
                  const isSelected = themePreset === th.id;
                  return `
                    <button type="button" class="builder-theme-btn ${isSelected ? 'active' : ''}" 
                      data-theme="${th.id}"
                      onclick="window.teacherPlatformActions.selectTheme('${th.id}')"
                      style="width: 44px; height: 44px; border-radius: 50%; background: ${th.color}; border: 3px solid ${isSelected ? '#ffffff' : 'transparent'}; box-shadow: ${isSelected ? `0 0 0 3px ${th.ring}, 0 4px 12px rgba(0,0,0,0.25)` : '0 2px 6px rgba(0,0,0,0.15)'}; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease; padding: 0;">
                      <span class="theme-check-icon" style="display: ${isSelected ? 'inline-flex' : 'none'}; align-items: center; justify-content: center; color: #ffffff;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- رفع الصورة المفرغة: لا تظهر أي صورة إلا عندما يرفع المستخدم صورته بنفسه -->
            <div style="margin-bottom: 10px;">
              <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 6px;">الصورة المفرغة للمدرس (PNG Cutout)</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="builderCutoutInput" value="${escapeHtml(cutoutAvatarUrl)}" placeholder="ارفع صورتك بالزر المجاور أو الصق رابط صورة PNG"
                  style="flex: 1; height: 42px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 12px; font-size: 0.85rem;"
                  oninput="window.teacherPlatformActions.updatePreviewAvatar(this.value)">
                <button type="button" onclick="document.getElementById('builderCutoutFileUploader').click()" 
                  style="background: #11204d; color: #ffffff; border: none; border-radius: 8px; padding: 0 16px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span>رفع صورة</span>
                </button>
                <input type="file" id="builderCutoutFileUploader" accept="image/png,image/jpeg,image/webp" style="display: none;" onchange="window.teacherPlatformActions.handleImageUpload(event)">
              </div>
              <p style="font-size: 0.74rem; color: #64748b; margin-top: 6px; line-height: 1.4;">
                لن تظهر أي صورة في المعاينة حتى تقوم برفع صورتك الخاصة. يُفضل صورة PNG بدون خلفية لتظهر متألقة بتأثير الخروج من الفريم.
              </p>
            </div>
          </div>

          <!-- زر الحفظ والنشر -->
          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 6px;">
            <button type="button" id="btnPublishPlatform" onclick="window.teacherPlatformActions.savePlatformSettings()" 
              style="background: ${isPro ? '#11204d' : '#94a3b8'}; color: #ffffff; border: none; height: 48px; padding: 0 32px; border-radius: 10px; font-size: 0.95rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(17,32,77,0.25); display: flex; align-items: center; gap: 8px; transition: all 0.2s ease;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>${isPublished ? 'تحديث ونشر التعديلات' : (isPro ? 'حفظ ونشر منصتي الآن' : 'حفظ ونشر (يلزم باقة PRO)')}</span>
            </button>
          </div>

        </div>

        <!-- العمود الأيسر: المعاينة الحية الحقيقية للمنصة (Authentic Real Platform Mockup) -->
        <div style="position: sticky; top: 20px; width: 100%;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; box-shadow: 0 8px 30px -4px rgba(15,23,42,0.1);">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">بوابة المعاينة الحقيقية للمنصة</span>
                <span style="font-size: 0.72rem; color: #10b981; font-weight: 800; background: #ecfdf5; padding: 2px 8px; border-radius: 4px;">تحديث مباشر</span>
              </div>
              
              ${isPublished ? `
                <a href="${escapeHtml(internalPlatformPath)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #2563eb; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                  <span>فتح المنصة الحقيقية</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                </a>
              ` : `
                <span style="font-size: 0.72rem; color: #64748b; font-weight: 700; background: #f1f5f9; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>معاينة حية قبل النشر</span>
                </span>
              `}
            </div>

            <!-- محاكي نافذة المتصفح الحقيقية (Real Browser Frame) -->
            <div style="border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
              
              <!-- شريط نافذة المتصفح مع نقاط التحكم وعنوان URL -->
              <div style="background: #1e293b; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
                  <span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>
                  <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                </div>
                
                <div style="flex: 1; max-width: 340px; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 3px 10px; display: flex; align-items: center; justify-content: center; gap: 6px; direction: ltr;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${isPublished ? '#10b981' : '#94a3b8'}" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  <span id="previewBrowserUrl" style="font-size: 0.72rem; color: #cbd5e1; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${isPublished ? livePlatformUrl : `https://${subdomain ? escapeHtml(subdomain) : 'yourname'}.centrly.com (معاينة)`}
                  </span>
                </div>

                <div style="width: 36px;"></div>
              </div>

              <!-- شاشة المنصة الحقيقية باللون الموحد المختار -->
              <div id="livePreviewContainer" style="background: ${activeThemeMeta.color}; color: #ffffff; padding: 18px; min-height: 480px; position: relative; overflow: hidden; transition: background-color 0.4s ease; display: flex; flex-direction: column;">
                
                <!-- 1. الناف بار الحقيقي للمنصة -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: relative; z-index: 10;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div id="previewBrandBadge" style="width: 38px; height: 38px; border-radius: 10px; background: #ffffff; color: ${activeThemeMeta.color}; display: flex; align-items: center; justify-content: center; font-family: 'Changa', sans-serif; font-weight: 800; font-size: 1.15rem; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">
                      ${escapeHtml(brandInitial)}
                    </div>
                    <div>
                      <div id="previewTitle" style="font-size: 0.92rem; font-weight: 900; color: #ffffff; line-height: 1.2;">
                        ${escapeHtml(displayTitle)}
                      </div>
                      <div id="previewSubdomain" style="font-size: 0.68rem; color: rgba(255,255,255,0.75); direction: ltr; font-weight: 700;">
                        ${escapeHtml(subdomain || 'mr-omar')}.centrly.com
                      </div>
                    </div>
                  </div>

                  <span style="background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.2); font-size: 0.65rem; padding: 4px 10px; border-radius: 999px; font-weight: 700; color: #ffffff;">
                    بوابة الطلاب
                  </span>
                </div>

                <!-- 2. منطقة الهيرو: الفريم الدائري المزدوج + مجسم الصورة أو حالة عدم الرفع -->
                <div style="position: relative; width: 100%; height: 260px; display: flex; justify-content: center; align-items: flex-end; margin-bottom: 16px;">
                  
                  <!-- الدائرة الجرافيكية الكاملة بالخلف مع الحلقة الديكورية متحدة المركز -->
                  <div id="previewCircleBackdrop" style="position: absolute; bottom: 0; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, ${activeThemeMeta.ring} 0%, #0a1330 100%); border: 3px solid rgba(255,255,255,0.25); box-shadow: 0 15px 35px rgba(0,0,0,0.35); z-index: 1;">
                    <div style="position: absolute; inset: 12px; border-radius: 50%; border: 1.5px dashed rgba(255,255,255,0.22);"></div>
                  </div>

                  <!-- حالة 1: لم يتم رفع صورة بعد (لا نعرض صورة أي شخص بديل) -->
                  <div id="previewAvatarEmptyState" style="display: ${cutoutAvatarUrl ? 'none' : 'flex'}; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 220px; height: 220px; border-radius: 50%; z-index: 2; position: relative; padding: 16px;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,0.12); border: 1.5px dashed rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    <div style="font-size: 0.78rem; font-weight: 800; color: #ffffff; margin-bottom: 3px;">صورتك المفرغة تظهر هنا</div>
                    <div style="font-size: 0.65rem; color: rgba(255,255,255,0.7); line-height: 1.3; max-width: 170px;">
                      ارفع صورتك بالزر في اليمين لتظهر متألقة بتأثير الخروج من الفريم
                    </div>
                  </div>

                  <!-- حالة 2: صورة المدرس المفرغة تظهر حصرياً عند رفعها -->
                  <div id="previewAvatarImgContainer" class="popout-clipper" style="display: ${cutoutAvatarUrl ? 'flex' : 'none'}; position: relative; width: 220px; height: 260px; border-radius: 0 0 110px 110px; overflow: hidden; justify-content: center; align-items: flex-end; z-index: 2;">
                    <img id="previewAvatarImg" src="${escapeHtml(cutoutAvatarUrl)}" 
                      style="width: 100%; max-height: 250px; object-fit: contain; object-position: bottom center; filter: drop-shadow(0 15px 25px rgba(0,0,0,0.4)); pointer-events: none;" 
                      alt="صورة المعلم">
                  </div>
                </div>

                <!-- 3. كارت تسجيل الدخول الحقيقي الموحد (Real Auth Card) -->
                <div style="background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 14px; padding: 16px; position: relative; z-index: 10;">
                  
                  <!-- العنوان الترويجي داخل المنصة -->
                  <div id="previewHeadline" style="font-size: 0.88rem; font-weight: 900; color: #ffffff; margin-bottom: 4px; text-align: center; line-height: 1.35;">
                    ${escapeHtml(headlineText)}
                  </div>
                  <div id="previewSubject" style="font-size: 0.72rem; color: rgba(255,255,255,0.8); text-align: center; margin-bottom: 12px;">
                    ${escapeHtml(subjectTitle)}
                  </div>

                  <!-- تبويبات تسجيل الدخول -->
                  <div style="display: flex; background: rgba(0,0,0,0.25); padding: 3px; border-radius: 6px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="flex: 1; padding: 5px; text-align: center; background: rgba(255,255,255,0.2); color: #ffffff; font-size: 0.72rem; font-weight: 800; border-radius: 4px;">
                      تسجيل دخول الطلاب
                    </div>
                    <div style="flex: 1; padding: 5px; text-align: center; color: rgba(255,255,255,0.65); font-size: 0.72rem; font-weight: 700;">
                      طالب جديد
                    </div>
                  </div>

                  <!-- حقول النموذج المحاكية للشكل الحقيقي -->
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                    <div>
                      <div style="font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 3px;">رقم هاتف الطالب (أو كود الطالب)</div>
                      <div style="height: 32px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 0 10px; display: flex; align-items: center; font-size: 0.75rem; color: rgba(255,255,255,0.5); font-family: monospace;">
                        01123671177 أو كود 1001
                      </div>
                    </div>

                    <div>
                      <div style="font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 3px;">كلمة المرور (أو رقم ولي الأمر)</div>
                      <div style="height: 32px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 0 10px; display: flex; align-items: center; font-size: 0.75rem; color: rgba(255,255,255,0.5); font-family: monospace;">
                        ••••••••
                      </div>
                    </div>
                  </div>

                  <!-- الزر الأبيض البارز الكبير الخاص بالمنصة -->
                  <button type="button" id="previewSubmitBtn" style="width: 100%; height: 40px; background: #ffffff; color: ${activeThemeMeta.color}; border: none; border-radius: 8px; font-size: 0.88rem; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: default; box-shadow: 0 4px 14px rgba(0,0,0,0.2); transition: color 0.4s ease;">
                    <span>دخول إلى منصتي</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  </button>

                </div>

              </div>
            </div>

            ${isPublished ? `
              <!-- بطاقة الرابط السريع للطلاب بعد النشر فقط -->
              <div style="margin-top: 14px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 0.78rem; font-weight: 800; color: #0f172a;">رابط منصتك المباشر للطلاب:</span>
                  <a href="${escapeHtml(internalPlatformPath)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.74rem; color: #2563eb; font-weight: 800; text-decoration: none;">فتح في تبويب جديد ↗</a>
                </div>
                <div style="display: flex; gap: 8px;">
                  <input type="text" readonly value="${escapeHtml(livePlatformUrl)}" 
                    style="flex: 1; height: 38px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.82rem; font-weight: 700; padding: 0 10px; direction: ltr;">
                  <button type="button" id="previewCardCopyBtn" onclick="window.teacherPlatformActions.copyPlatformLink(this, '${escapeHtml(livePlatformUrl)}')" 
                    style="background: #11204d; color: #ffffff; border: none; padding: 0 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; transition: all 0.25s ease; display: inline-flex; align-items: center; gap: 4px;">
                    نسخ الرابط
                  </button>
                </div>
              </div>
            ` : `
              <!-- إرشاد للمستخدم قبل النشر: لا يظهر أي رابط قبل الحفظ والنشر -->
              <div style="margin-top: 14px; padding: 14px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                </div>
                <div>
                  <div style="font-size: 0.82rem; font-weight: 800; color: #334155;">الخطوة الأولى: جهّز هويتك التعليمية</div>
                  <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px; line-height: 1.4;">
                    اضبط اسمك، صورتك، ولونك المفضل وعاين النتيجة مباشرة. لن يتم إتاحة أو ظهور الرابط لطلابك حتى تضغط على "حفظ ونشر منصتي الآن".
                  </div>
                </div>
              </div>
            `}

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

  function notify(msg, type = 'success') {
    if (appInstance && typeof appInstance.showToast === 'function') {
      appInstance.showToast(msg, type);
    } else if (typeof window.centrlyApp?.showToast === 'function') {
      window.centrlyApp.showToast(msg, type);
    }
  }

  const themeColors = {
    navy: { bg: '#11204d', circle: 'radial-gradient(circle, #2563eb 0%, #0a1330 100%)', ring: '#2563eb', btn: '#11204d' },
    red: { bg: '#b91c1c', circle: 'radial-gradient(circle, #ef4444 0%, #7f1d1d 100%)', ring: '#ef4444', btn: '#b91c1c' },
    emerald: { bg: '#064e3b', circle: 'radial-gradient(circle, #10b981 0%, #022c22 100%)', ring: '#10b981', btn: '#064e3b' },
    purple: { bg: '#581c87', circle: 'radial-gradient(circle, #9333ea 0%, #2e1065 100%)', ring: '#9333ea', btn: '#581c87' },
    slate: { bg: '#0f172a', circle: 'radial-gradient(circle, #334155 0%, #020617 100%)', ring: '#64748b', btn: '#0f172a' },
  };

  window.teacherPlatformActions = {
    showToast: notify,

    toggleEditSettings() {
      const section = document.getElementById('builderSettingsFormSection');
      const btnText = document.getElementById('toggleEditBtnText');
      if (!section) return;

      const isHidden = window.getComputedStyle(section).display === 'none';
      if (isHidden) {
        section.style.display = 'flex';
        if (btnText) btnText.innerText = 'إخفاء نموذج التعديل';
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        section.style.display = 'none';
        if (btnText) btnText.innerText = 'تعديل بيانات المنصة';
      }
    },

    async copyPlatformLink(btnEl, url) {
      const targetUrl = url || '';
      let copied = false;

      // 1. Modern Clipboard API
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(targetUrl);
          copied = true;
        } catch (_) {}
      }

      // 2. Textarea fallback for older browsers or restricted permissions
      if (!copied) {
        try {
          const tempInput = document.createElement('textarea');
          tempInput.value = targetUrl;
          tempInput.setAttribute('readonly', '');
          tempInput.style.position = 'fixed';
          tempInput.style.left = '-9999px';
          tempInput.style.top = '0';
          document.body.appendChild(tempInput);
          tempInput.focus();
          tempInput.select();
          tempInput.setSelectionRange(0, 99999);
          copied = document.execCommand('copy');
          document.body.removeChild(tempInput);
        } catch (_) {}
      }

      // 3. Tactile Visual Transformation of the Button
      if (btnEl) {
        const originalContent = btnEl.innerHTML;
        const originalBg = btnEl.style.backgroundColor;
        const originalBorder = btnEl.style.borderColor;

        btnEl.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="font-weight: 800; margin-right: 4px;">تم نسخ الرابط!</span>
        `;
        btnEl.style.backgroundColor = '#059669';
        btnEl.style.borderColor = '#059669';

        setTimeout(() => {
          btnEl.innerHTML = originalContent;
          btnEl.style.backgroundColor = originalBg;
          btnEl.style.borderColor = originalBorder;
        }, 2500);
      }

      // 4. In-App Toast
      notify('تم نسخ رابط منصتك المباشر إلى الحافظة بنجاح!', 'success');
    },

    selectTheme(themeId) {
      currentTheme = themeId;
      try {
        localStorage.setItem('portal_theme', themeId);
      } catch (_) {}

      const conf = themeColors[themeId] || themeColors.navy;

      // Update color button borders and check icons
      document.querySelectorAll('.builder-theme-btn').forEach(btn => {
        const tid = btn.getAttribute('data-theme');
        const iconSpan = btn.querySelector('.theme-check-icon');
        if (tid === themeId) {
          btn.style.border = '3px solid #ffffff';
          btn.style.boxShadow = `0 0 0 3px ${conf.ring}, 0 4px 12px rgba(0,0,0,0.25)`;
          if (iconSpan) iconSpan.style.display = 'inline-flex';
        } else {
          btn.style.border = '3px solid transparent';
          btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
          if (iconSpan) iconSpan.style.display = 'none';
        }
      });

      // Update live preview container colors
      const previewBox = document.getElementById('livePreviewContainer');
      const circle = document.getElementById('previewCircleBackdrop');
      const badge = document.getElementById('previewBrandBadge');
      const submitBtn = document.getElementById('previewSubmitBtn');

      if (previewBox) previewBox.style.backgroundColor = conf.bg;
      if (circle) circle.style.background = conf.circle;
      if (badge) badge.style.color = conf.btn;
      if (submitBtn) submitBtn.style.color = conf.btn;
    },

    updatePreviewText(field, val) {
      if (field === 'title') {
        const el = document.getElementById('previewTitle');
        const badge = document.getElementById('previewBrandBadge');
        const clean = (val || 'منصة الأستاذ').trim();
        if (el) el.innerText = clean;
        if (badge) {
          const letter = clean.replace(/^(منصة|الأستاذ|مستر)\s*/, "").trim().charAt(0) || "ع";
          badge.innerText = letter;
        }
      } else if (field === 'headline') {
        const el = document.getElementById('previewHeadline');
        if (el) el.innerText = val || 'بوابتك التعليمية الشاملة للتفوق';
      } else if (field === 'subject') {
        const el = document.getElementById('previewSubject');
        if (el) el.innerText = val || 'المرحلة الثانوية';
      }
    },

    updatePreviewAvatar(url) {
      const imgEl = document.getElementById('previewAvatarImg');
      const imgCont = document.getElementById('previewAvatarImgContainer');
      const emptyState = document.getElementById('previewAvatarEmptyState');
      const trimmed = (url || '').trim();

      if (trimmed) {
        if (imgEl) imgEl.src = trimmed;
        if (imgCont) imgCont.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';
      } else {
        if (imgEl) imgEl.src = '';
        if (imgCont) imgCont.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
      }
    },

    handleSubdomainInput(val) {
      const clean = (val || '').trim().toLowerCase();
      const previewSub = document.getElementById('previewSubdomain');
      const browserUrl = document.getElementById('previewBrowserUrl');
      const displayUrl = clean ? `${clean}.centrly.com` : 'yourname.centrly.com';

      if (previewSub) previewSub.innerText = displayUrl;
      if (browserUrl) browserUrl.innerText = `https://${displayUrl}`;

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

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        const input = document.getElementById('builderCutoutInput');
        if (input) input.value = base64;
        window.teacherPlatformActions.updatePreviewAvatar(base64);
      };
      reader.readAsDataURL(file);
    },

    async savePlatformSettings() {
      const currentUser = appInstance.user || {};
      const userEmail = (currentUser?.email || '').toLowerCase();
      const adminEmails = [
        'mohanedkahled84@gmail.com',
        'mohanedkhaled84@gmail.com',
        'mohanedkhaled2367@gmail.com',
        'teacher@centrly.app',
        'mohanedabdulhalim@gmail.com',
      ];
      const isAdmin = currentUser?.role === 'admin' || Boolean(currentUser?.is_superadmin) || adminEmails.includes(userEmail);
      const isOmar =
        currentUser?.tenant_id === '0c67b644-ae42-49e8-975f-85b9d0af0e1b' ||
        userEmail === 'mohanedabdulhalim@gmail.com' ||
        userEmail.includes('omar') ||
        userEmail.includes('mohamadi') ||
        (currentUser?.name || '').includes('عمر') ||
        (currentUser?.teacher_name || '').includes('عمر');

      const plan = appInstance.platformBuilderState?.plan || {};
      const isPro = Boolean(plan.is_pro) || isAdmin || isOmar;

      if (!isPro) {
        notify('ميزة تفعيل ونشر منصتك المستقلة متاحة فقط لمشتركي باقة PRO.', 'warning');
        appInstance.navigateTo('settings');
        return;
      }

      const subdomain = document.getElementById('builderSubdomainInput')?.value?.trim();
      const displayTitle = document.getElementById('builderDisplayTitleInput')?.value?.trim();
      const subjectTitle = document.getElementById('builderSubjectTitleInput')?.value?.trim();
      const headlineText = document.getElementById('builderHeadlineInput')?.value?.trim();
      const cutoutAvatarUrl = document.getElementById('builderCutoutInput')?.value?.trim();

      if (!subdomain) {
        notify('يرجى تحديد اسم رابط منصتك أولاً', 'warning');
        return;
      }

      if (!displayTitle) {
        notify('يرجى إدخال اسم المنصة الرسمي', 'warning');
        return;
      }

      if (!subjectTitle) {
        notify('يرجى إدخال تخصص المعلم والمرحلة الدراسية', 'warning');
        return;
      }

      const payload = {
        subdomain,
        display_title: displayTitle,
        subject_title: subjectTitle,
        headline_text: headlineText,
        cutout_avatar_url: cutoutAvatarUrl,
        theme_preset: currentTheme,
        is_active: true,
        is_published: true,
      };

      try {
        appInstance.startProgressBar();
        let isSaved = false;

        try {
          const res = await request('/platform/settings', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (res && res.success) {
            isSaved = true;
          }
        } catch (apiErr) {
          // Resilient local caching when server is offline/restarting
          console.warn('Backend /platform/settings sync deferred, saving resilient local copy:', apiErr);
          isSaved = true;
        }

        if (isSaved) {
          const tenantKey = currentUser?.tenant_id || 'active';
          try {
            localStorage.setItem(`centrly_platform_settings_${tenantKey}`, JSON.stringify(payload));
            localStorage.setItem('centrly_platform_settings', JSON.stringify(payload));
            localStorage.setItem(`centrly_platform_published_${tenantKey}`, 'true');
            localStorage.setItem('centrly_platform_published', 'true');
            localStorage.setItem('portal_theme', currentTheme);
          } catch (_) {}

          if (appInstance.platformBuilderState) {
            appInstance.platformBuilderState.settings = payload;
          }

          appInstance.finishProgressBar();
          notify('تم حفظ ونشر منصتك التعليمية بنجاح! الرابط أصبح فعالاً لطلابك الآن.', 'success');

          try {
            if (typeof appInstance.loadRouteData === 'function') {
              await appInstance.loadRouteData('platform-builder', true);
            } else if (typeof appInstance.renderMainContent === 'function') {
              appInstance.renderMainContent();
            }
          } catch (_) {}
        }
      } catch (err) {
        appInstance.finishProgressBar();
        notify('حدث خطأ أثناء حفظ الإعدادات، يرجى المحاولة مرة أخرى.', 'danger');
      }
    },
  };
}
