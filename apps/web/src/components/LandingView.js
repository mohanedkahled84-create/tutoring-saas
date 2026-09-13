/**
 * Centrly SaaS Official Landing Page Component
 * Strictly adhering to official Brand Identity:
 * - Colors: --navy (#172D70), --blue (#2949BA), --gold (#E7A330), --cream (#F8F7F1), --ink (#182349), --line (#E5E9F2), --green (#25845A)
 * - Brand Wordmark: سنتر (blue) + لي (gold) with gold bottom bar
 * - Fixed Top Navigation Bar with persistent login/signup buttons
 * - Features Grid: Mobile horizontal scroll slider (التمرير بالجنب في الموبايل)
 * - Clean Pricing Cards (100 / 250 / 500 students) with unified feature note
 * - Legal policies presented as 4 side-by-side cards opening rich Popup Modals (صفحات منبثقة)
 * - STRICTLY ZERO EMOJIS across the entire page (clean vector SVGs only)
 */

import { CENTRLY_LOGO_BASE64 } from '../utils/logoBase64.js';

export function renderLandingView() {
  return `
    <div class="landing-page" style="font-family: 'Cairo', sans-serif; direction: rtl; color: var(--brand-ink, #182349); background: var(--brand-cream, #F8F7F1); min-height: 100vh; overflow-x: hidden; padding-top: 74px;">
      
      <style>
        :root {
          --brand-navy: #172D70;
          --brand-navy-light: #203B91;
          --brand-blue: #2949BA;
          --brand-blue-light: #4665D3;
          --brand-pale: #E8EDFF;
          --brand-gold: #E7A330;
          --brand-gold-light: #FFF2D9;
          --brand-cream: #F8F7F1;
          --brand-ink: #182349;
          --brand-text: #46516E;
          --brand-muted: #7E8B9F;
          --brand-line: #E5E9F2;
          --brand-green: #25845A;
          --brand-green-light: #EAF8F0;
          --brand-surface: #FFFFFF;
        }

        .brand-logo-text {
          font-family: 'Changa', 'Cairo', sans-serif;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1.1;
          position: relative;
          display: inline-block;
          white-space: nowrap;
        }
        .brand-logo-text .logo-blue { color: var(--brand-blue); }
        .brand-logo-text .logo-gold { color: var(--brand-gold); }
        .brand-logo-text::after {
          content: "";
          position: absolute;
          right: 0;
          left: 0;
          height: 3px;
          border-radius: 6px;
          background: var(--brand-gold);
          bottom: -4px;
        }

        .feature-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(23, 45, 112, 0.08);
        }

        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 30px rgba(23, 45, 112, 0.1);
        }

        /* Responsive Mobile Horizontal Scroll for Features */
        @media (max-width: 768px) {
          .features-container {
            display: flex !important;
            overflow-x: auto !important;
            scroll-snap-type: x mandatory !important;
            -webkit-overflow-scrolling: touch;
            padding: 0.5rem 1rem 1.5rem !important;
            gap: 1rem !important;
            scrollbar-width: thin;
          }
          .features-container::-webkit-scrollbar {
            height: 4px;
          }
          .features-container::-webkit-scrollbar-thumb {
            background: var(--brand-line);
            border-radius: 4px;
          }
          .features-container .feature-card {
            flex: 0 0 82% !important;
            max-width: 82% !important;
            scroll-snap-align: center !important;
          }
          .mobile-scroll-hint {
            display: flex !important;
          }
        }
      </style>

      <!-- ================================================================= -->
      <!-- 1. FIXED TOP NAVIGATION BAR (LOCKED ON SCROLL)                    -->
      <!-- ================================================================= -->
      <header id="landingNav" style="position: fixed; top: 0; left: 0; right: 0; height: 74px; z-index: 1000; background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--brand-line); box-shadow: 0 2px 10px rgba(23, 45, 112, 0.04); display: flex; align-items: center;">
        <div style="width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
          
          <!-- Official Brand Wordmark & Icon -->
          <div style="display: inline-flex; align-items: center; gap: 10px; cursor: pointer;" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
            <img src="${CENTRLY_LOGO_BASE64}" alt="شعار سنترلي" style="width: 36px; height: 36px; border-radius: 10px; object-fit: cover; box-shadow: 0 2px 8px rgba(23, 45, 112, 0.12);">
            <div class="brand-logo-text">
              <span class="logo-blue">سنتر</span><span class="logo-gold">لي</span>
            </div>
            <span style="font-size: 11px; background: var(--brand-pale); color: var(--brand-blue); padding: 3px 9px; border-radius: 20px; font-weight: 700; white-space: nowrap;">إصدار 2026</span>
          </div>

          <!-- Nav Links -->
          <nav style="display: flex; align-items: center; gap: 1.5rem; font-size: 0.9rem; font-weight: 700;">
            <button onclick="document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })" style="background: none; border: none; font-family: 'Cairo', sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--brand-text); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--brand-blue)'" onmouseout="this.style.color='var(--brand-text)'">المميزات</button>
            <button onclick="document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })" style="background: none; border: none; font-family: 'Cairo', sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--brand-text); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--brand-blue)'" onmouseout="this.style.color='var(--brand-text)'">الأسعار والباقات</button>
            <button onclick="document.querySelector('footer')?.scrollIntoView({ behavior: 'smooth' })" style="background: none; border: none; font-family: 'Cairo', sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--brand-text); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--brand-blue)'" onmouseout="this.style.color='var(--brand-text)'">الشروط والسياسات</button>
          </nav>

          <!-- Persistent Action Buttons -->
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <button onclick="window.centrlyApp.renderAuth('login')" 
              style="background: transparent; border: 1.5px solid var(--brand-navy); color: var(--brand-navy); font-family: 'Cairo', sans-serif; font-size: 0.875rem; font-weight: 700; padding: 0.45rem 1.1rem; border-radius: 10px; cursor: pointer; transition: all 0.2s;"
              onmouseover="this.style.backgroundColor='var(--brand-pale)';"
              onmouseout="this.style.backgroundColor='transparent';">
              تسجيل الدخول
            </button>

            <button onclick="window.centrlyApp.renderAuth('signup')" 
              style="background: var(--brand-gold); color: var(--brand-navy); font-family: 'Cairo', sans-serif; font-size: 0.875rem; font-weight: 800; padding: 0.5rem 1.25rem; border-radius: 10px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(231, 163, 48, 0.25); transition: all 0.2s;"
              onmouseover="this.style.backgroundColor='#dba024'; this.style.transform='translateY(-1px)';"
              onmouseout="this.style.backgroundColor='var(--brand-gold)'; this.style.transform='none';">
              ابدأ مجاناً (7 أيام)
            </button>
          </div>

        </div>
      </header>

      <!-- ================================================================= -->
      <!-- 2. HERO SECTION (NO MOCKUP SIMULATION BOX)                        -->
      <!-- ================================================================= -->
      <section style="padding: 4.5rem 1.25rem 3.5rem; text-align: center; background: radial-gradient(circle at 50% 0%, #FFFFFF 0%, var(--brand-cream) 80%);">
        <div style="max-width: 950px; margin: 0 auto;">
          
          <!-- Official Tag -->
          <div style="display: inline-flex; align-items: center; gap: 8px; background: var(--brand-green-light); border: 1px solid #C9EBD8; color: var(--brand-green); font-size: 13px; font-weight: 700; padding: 6px 16px; border-radius: 9999px; margin-bottom: 1.5rem;">
            <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="var(--brand-green)"/></svg>
            <span>المنظومة السحابية المعتمدة لإدارة المعلمين والمراكز التعليمية في مصر</span>
          </div>

          <!-- Main Catchy Headline -->
          <h1 style="font-size: clamp(2rem, 4.5vw, 3.4rem); font-weight: 900; line-height: 1.25; color: var(--brand-navy); margin: 0 auto 1.25rem; letter-spacing: -0.02em;">
            المنظومة الأذكى لإدارة حصصك، كروتك، وطلابك
          </h1>

          <!-- Subtitle -->
          <p style="font-size: clamp(1rem, 2vw, 1.2rem); color: var(--brand-text); max-width: 820px; margin: 0 auto 2.25rem; line-height: 1.75; font-weight: 600;">
            تسجيل حضور بالباركود السريع في ثوانٍ، كروت ذكية وطباعة فورية، رسائل واتساب آلية لأولياء الأمور بدرجات الكويزات بدون حظر، وبوابة متابعة تفاعلية لكل طالب بدون الحاجة لتحميل أي تطبيقات.
          </p>

          <!-- Dual Hero CTAs -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.5rem;">
            <button onclick="window.centrlyApp.renderAuth('signup')" 
              style="background: var(--brand-navy); border: none; color: #ffffff; font-family: 'Cairo', sans-serif; font-size: 1.05rem; font-weight: 800; padding: 0.85rem 2.25rem; border-radius: 12px; cursor: pointer; box-shadow: 0 8px 20px rgba(23, 45, 112, 0.18); transition: all 0.2s ease;"
              onmouseover="this.style.backgroundColor='var(--brand-blue)'; this.style.transform='translateY(-2px)';"
              onmouseout="this.style.backgroundColor='var(--brand-navy)'; this.style.transform='none';">
              ابدأ تجربتك المجانية فوراً (7 أيام)
            </button>

            <button onclick="window.centrlyApp.renderAuth('login')" 
              style="background: var(--brand-surface); border: 1.5px solid var(--brand-navy); color: var(--brand-navy); font-family: 'Cairo', sans-serif; font-size: 1.05rem; font-weight: 800; padding: 0.8rem 1.85rem; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;"
              onmouseover="this.style.backgroundColor='var(--brand-pale)';"
              onmouseout="this.style.backgroundColor='var(--brand-surface)';">
              تسجيل الدخول لحسابك
            </button>
          </div>

          <!-- Trust Badges Row (Zero Emojis - Vector Checks) -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 2rem; flex-wrap: wrap; color: var(--brand-text); font-size: 0.875rem; font-weight: 700;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>بدون بطاقة ائتمانية للتجربة</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>مسح باركود مستمر وفوري</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>دعم فني مصري على مدار الساعة</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>متوافق مع الهواتف والحواسيب</span>
            </div>
          </div>

        </div>
      </section>

      <!-- ================================================================= -->
      <!-- 3. UNIFIED FEATURES (WITH MOBILE HORIZONTAL SIDE-SCROLL)          -->
      <!-- ================================================================= -->
      <section id="features" style="padding: 4.5rem 1.25rem 5rem; background: var(--brand-surface); border-top: 1px solid var(--brand-line); border-bottom: 1px solid var(--brand-line);">
        <div style="max-width: 1180px; margin: 0 auto;">
          
          <div style="text-align: center; max-width: 750px; margin: 0 auto 2.5rem;">
            <span style="color: var(--brand-blue); font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">منظومة شاملة ومتكاملة</span>
            <h2 style="font-size: clamp(1.6rem, 3vw, 2.3rem); font-weight: 900; color: var(--brand-navy); margin: 0.5rem 0 0.75rem;">
              جميع ميزات سنترلي متوفرة بالكامل لكل مشترك
            </h2>
            <p style="font-size: 1rem; color: var(--brand-text); margin: 0; line-height: 1.7;">
              نظام شامل لإدارة شؤون الحصص والمجموعات بدون الحاجة لأي برامج إضافية أو تعقيدات.
            </p>

            <!-- Mobile Scroll Hint -->
            <div class="mobile-scroll-hint" style="display: none; align-items: center; justify-content: center; gap: 8px; margin-top: 1.25rem; font-size: 0.85rem; color: var(--brand-blue); font-weight: 700;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              <span>مرر أفقياً لعرض باقي المميزات</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </div>
          </div>

          <!-- Feature Cards Container (Grid on desktop, smooth horizontal snap on mobile) -->
          <div class="features-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem;">
            
            <!-- Feature 1 -->
            <div class="feature-card" style="background: var(--brand-cream); border: 1px solid var(--brand-line); border-radius: 16px; padding: 1.75rem; transition: all 0.2s;">
              <div style="width: 44px; height: 44px; background: var(--brand-pale); color: var(--brand-blue); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--brand-navy); margin: 0 0 0.5rem;">مسح الباركود السريع المستمر</h3>
              <p style="font-size: 0.875rem; color: var(--brand-text); line-height: 1.7; margin: 0;">
                ماسح ضوئي ذكي بتركيز تلقائي دائم لتسجيل حضور الطلاب وموقف الواجب في ثانية واحدة بدون لمس الفأرة.
              </p>
            </div>

            <!-- Feature 2 -->
            <div class="feature-card" style="background: var(--brand-cream); border: 1px solid var(--brand-line); border-radius: 16px; padding: 1.75rem; transition: all 0.2s;">
              <div style="width: 44px; height: 44px; background: var(--brand-green-light); color: var(--brand-green); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--brand-navy); margin: 0 0 0.5rem;">رسائل واتساب فائقة الحماية من الحظر</h3>
              <p style="font-size: 0.875rem; color: var(--brand-text); line-height: 1.7; margin: 0;">
                تنويع تلقائي لصياغة الرسائل وفواصل زمنية عشوائية ذكية مع محاكاة الكتابة الحية لضمان إرسال التقارير بأمان تام لخطك.
              </p>
              <div style="font-size: 0.75rem; color: var(--brand-muted); margin-top: 0.6rem; line-height: 1.5; border-top: 1px dashed var(--brand-line); padding-top: 0.5rem;">
                * تنبيه وإخلاء مسؤولية: الضغط المتواصل أو إرسال رسائل مكثفة قد يُعرّض الرقم للإغلاق من شركة واتساب، والمنصة تخلي مسؤوليتها عن أي حظر للرقم.
              </div>
            </div>

            <!-- Feature 3 -->
            <div class="feature-card" style="background: var(--brand-cream); border: 1px solid var(--brand-line); border-radius: 16px; padding: 1.75rem; transition: all 0.2s;">
              <div style="width: 44px; height: 44px; background: var(--brand-gold-light); color: var(--brand-gold); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--brand-navy); margin: 0 0 0.5rem;">كروت الطلاب وتصدير بيانات التصميم</h3>
              <p style="font-size: 0.875rem; color: var(--brand-text); line-height: 1.7; margin: 0;">
                طباعة كروت فورية بصيغة PDF أو تصدير ملفات Excel و CSV متوافقة مع برامج Canva و Photoshop لطباعة كروت بلاستيكية مخصصة.
              </p>
            </div>

            <!-- Feature 4 -->
            <div class="feature-card" style="background: var(--brand-cream); border: 1px solid var(--brand-line); border-radius: 16px; padding: 1.75rem; transition: all 0.2s;">
              <div style="width: 44px; height: 44px; background: var(--brand-pale); color: var(--brand-navy); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--brand-navy); margin: 0 0 0.5rem;">رصد وتوزيع درجات الكويزات</h3>
              <p style="font-size: 0.875rem; color: var(--brand-text); line-height: 1.7; margin: 0;">
                تسجيل نتائج الاختبارات وتعديل الدرجة القصوى وتوزيع النتائج بنقرة زر إلى أرقام أولياء الأمور والطلاب مباشرة.
              </p>
            </div>

            <!-- Feature 5 -->
            <div class="feature-card" style="background: var(--brand-cream); border: 1px solid var(--brand-line); border-radius: 16px; padding: 1.75rem; transition: all 0.2s;">
              <div style="width: 44px; height: 44px; background: var(--brand-green-light); color: var(--brand-green); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--brand-navy); margin: 0 0 0.5rem;">بوابة متابعة ولي الأمر التفاعلية</h3>
              <p style="font-size: 0.875rem; color: var(--brand-text); line-height: 1.7; margin: 0;">
                رابط مباشر ومشفّر لكل طالب، يفتحه ولي الأمر من أي متصفح هاتف لمتابعة الحضور والغياب والدرجات بدون أي كلمات سر أو تطبيقات.
              </p>
            </div>

            <!-- Feature 6 -->
            <div class="feature-card" style="background: var(--brand-cream); border: 1px solid var(--brand-line); border-radius: 16px; padding: 1.75rem; transition: all 0.2s;">
              <div style="width: 44px; height: 44px; background: var(--brand-pale); color: var(--brand-blue); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 10h2"/><path d="M9 14h2"/><path d="M9 18h2"/><path d="M15 10h2"/><path d="M15 14h2"/><path d="M15 18h2"/></svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--brand-navy); margin: 0 0 0.5rem;">إدارة السناتر والمساعدين والقاعات</h3>
              <p style="font-size: 0.875rem; color: var(--brand-text); line-height: 1.7; margin: 0;">
                تنظيم جدول الحصص الأسبوعي، منع تضارب القاعات، حساب نسب المدرسين والتسويات المالية الشهرية، وإدارة صلاحيات المساعدين.
              </p>
            </div>

          </div>

        </div>
      </section>

      <!-- ================================================================= -->
      <!-- 4. CLEAN PRICING TIERS                                            -->
      <!-- ================================================================= -->
      <section id="pricing" style="padding: 5rem 1.25rem; background: var(--brand-cream);">
        <div style="max-width: 1100px; margin: 0 auto;">
          
          <div style="text-align: center; max-width: 700px; margin: 0 auto 3rem;">
            <span style="color: var(--brand-green); font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">تسعير عادل وشفاف</span>
            <h2 style="font-size: clamp(1.6rem, 3vw, 2.3rem); font-weight: 900; color: var(--brand-navy); margin: 0.5rem 0 0.75rem;">
              اختر الباقة المناسبة لسعة طلابك
            </h2>
            <p style="font-size: 1rem; color: var(--brand-text); margin: 0; line-height: 1.7;">
              جميع الميزات المذكورة أعلاه متوفرة بالكامل في كل الباقات. الاختلاف الوحيد هو عدد الطلاب وسعر الاشتراك.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 1.75rem; align-items: stretch;">
            
            <!-- Plan 1: 100 Students -->
            <div class="pricing-card" style="background: var(--brand-surface); border: 1.5px solid var(--brand-line); border-radius: 18px; padding: 2.25rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s;">
              <div>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--brand-navy);">باقة 100 طالب</div>
                <div style="font-size: 0.85rem; color: var(--brand-muted); margin-top: 0.25rem;">للبدايات والمجموعات الفردية</div>
                
                <div style="margin: 1.5rem 0; display: flex; align-items: baseline; gap: 0.35rem;">
                  <span style="font-size: 2.75rem; font-weight: 900; color: var(--brand-navy);">599</span>
                  <span style="font-size: 0.95rem; font-weight: 700; color: var(--brand-muted);">جنيه / شهرياً</span>
                </div>

                <div style="background: var(--brand-pale); color: var(--brand-blue); font-size: 0.875rem; font-weight: 800; padding: 0.5rem 0.75rem; border-radius: 8px; text-align: center; margin-bottom: 1.5rem;">
                  سعة حتى 100 طالب مسجل
                </div>

                <div style="border-top: 1px solid var(--brand-line); padding-top: 1.25rem; font-size: 0.875rem; color: var(--brand-text); line-height: 1.8;">
                  <div style="display: flex; align-items: center; gap: 6px; color: var(--brand-green); font-weight: 700; margin-bottom: 0.5rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>تشمل جميع ميزات المنظومة بالكامل</span>
                  </div>
                  <div style="color: var(--brand-muted); font-size: 0.8rem;">
                    تتضمن مسح الباركود، إشعارات الواتساب، الكروت، الكويزات، وبوابة المتابعة مع دعم فني مستمر.
                  </div>
                </div>
              </div>

              <div style="margin-top: 2rem;">
                <button onclick="window.centrlyApp.renderAuth('signup')" 
                  style="width: 100%; background: var(--brand-cream); border: 1.5px solid var(--brand-line); color: var(--brand-navy); font-family: 'Cairo', sans-serif; font-size: 0.95rem; font-weight: 800; padding: 0.75rem; border-radius: 10px; cursor: pointer; transition: all 0.2s;"
                  onmouseover="this.style.backgroundColor='var(--brand-navy)'; this.style.borderColor='var(--brand-navy)'; this.style.color='#ffffff';"
                  onmouseout="this.style.backgroundColor='var(--brand-cream)'; this.style.borderColor='var(--brand-line)'; this.style.color='var(--brand-navy)';">
                  ابدأ باقة الـ 100 طالب (تجربة 7 أيام)
                </button>
              </div>
            </div>

            <!-- Plan 2: 250 Students (Prominent) -->
            <div class="pricing-card" style="background: var(--brand-surface); border: 2px solid var(--brand-blue); border-radius: 18px; padding: 2.25rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; box-shadow: 0 8px 24px rgba(41, 73, 186, 0.08); transition: all 0.2s;">
              <div style="position: absolute; top: -13px; left: 50%; transform: translateX(-50%); background: var(--brand-blue); color: #ffffff; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.85rem; border-radius: 9999px;">
                الأكثر طلباً للمعلمين
              </div>

              <div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--brand-blue);">باقة 250 طالب</div>
                <div style="font-size: 0.85rem; color: var(--brand-muted); margin-top: 0.25rem;">للمجموعات الكبيرة وأصحاب الفرق</div>
                
                <div style="margin: 1.5rem 0; display: flex; align-items: baseline; gap: 0.35rem;">
                  <span style="font-size: 2.75rem; font-weight: 900; color: var(--brand-blue);">899</span>
                  <span style="font-size: 0.95rem; font-weight: 700; color: var(--brand-muted);">جنيه / شهرياً</span>
                </div>

                <div style="background: var(--brand-green-light); color: var(--brand-green); font-size: 0.875rem; font-weight: 800; padding: 0.5rem 0.75rem; border-radius: 8px; text-align: center; margin-bottom: 1.5rem;">
                  سعة حتى 250 طالب مسجل
                </div>

                <div style="border-top: 1px solid var(--brand-line); padding-top: 1.25rem; font-size: 0.875rem; color: var(--brand-text); line-height: 1.8;">
                  <div style="display: flex; align-items: center; gap: 6px; color: var(--brand-green); font-weight: 700; margin-bottom: 0.5rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>تشمل جميع ميزات المنظومة بالكامل</span>
                  </div>
                  <div style="color: var(--brand-muted); font-size: 0.8rem;">
                    تتضمن مسح الباركود، إشعارات الواتساب، الكروت، الكويزات، وبوابة المتابعة مع دعم فني مستمر.
                  </div>
                </div>
              </div>

              <div style="margin-top: 2rem;">
                <button onclick="window.centrlyApp.renderAuth('signup')" 
                  style="width: 100%; background: var(--brand-blue); border: none; color: #ffffff; font-family: 'Cairo', sans-serif; font-size: 0.95rem; font-weight: 800; padding: 0.8rem; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(41, 73, 186, 0.25); transition: all 0.2s;"
                  onmouseover="this.style.backgroundColor='var(--brand-navy)';"
                  onmouseout="this.style.backgroundColor='var(--brand-blue)';">
                  ابدأ باقة الـ 250 طالب (تجربة 7 أيام)
                </button>
              </div>
            </div>

            <!-- Plan 3: 500 Students -->
            <div class="pricing-card" style="background: var(--brand-surface); border: 1.5px solid var(--brand-line); border-radius: 18px; padding: 2.25rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s;">
              <div>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--brand-navy);">باقة 500 طالب</div>
                <div style="font-size: 0.85rem; color: var(--brand-muted); margin-top: 0.25rem;">للسناتر والمراكز التعليمية</div>
                
                <div style="margin: 1.5rem 0; display: flex; align-items: baseline; gap: 0.35rem;">
                  <span style="font-size: 2.75rem; font-weight: 900; color: var(--brand-navy);">1,499</span>
                  <span style="font-size: 0.95rem; font-weight: 700; color: var(--brand-muted);">جنيه / شهرياً</span>
                </div>

                <div style="background: var(--brand-pale); color: var(--brand-navy); font-size: 0.875rem; font-weight: 800; padding: 0.5rem 0.75rem; border-radius: 8px; text-align: center; margin-bottom: 1.5rem;">
                  سعة حتى 500 طالب مسجل
                </div>

                <div style="border-top: 1px solid var(--brand-line); padding-top: 1.25rem; font-size: 0.875rem; color: var(--brand-text); line-height: 1.8;">
                  <div style="display: flex; align-items: center; gap: 6px; color: var(--brand-green); font-weight: 700; margin-bottom: 0.5rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>تشمل جميع ميزات المنظومة بالكامل</span>
                  </div>
                  <div style="color: var(--brand-muted); font-size: 0.8rem;">
                    تتضمن مسح الباركود، إشعارات الواتساب، الكروت، الكويزات، وبوابة المتابعة مع دعم فني مستمر.
                  </div>
                </div>
              </div>

              <div style="margin-top: 2rem;">
                <button onclick="window.centrlyApp.renderAuth('signup')" 
                  style="width: 100%; background: var(--brand-cream); border: 1.5px solid var(--brand-line); color: var(--brand-navy); font-family: 'Cairo', sans-serif; font-size: 0.95rem; font-weight: 800; padding: 0.75rem; border-radius: 10px; cursor: pointer; transition: all 0.2s;"
                  onmouseover="this.style.backgroundColor='var(--brand-navy)'; this.style.borderColor='var(--brand-navy)'; this.style.color='#ffffff';"
                  onmouseout="this.style.backgroundColor='var(--brand-cream)'; this.style.borderColor='var(--brand-line)'; this.style.color='var(--brand-navy)';">
                  ابدأ باقة الـ 500 طالب (تجربة 7 أيام)
                </button>
              </div>
            </div>

          </div>

          <!-- Enterprise Callout -->
          <div style="margin-top: 2rem; background: var(--brand-surface); border: 1.5px dashed var(--brand-line); border-radius: 14px; padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--brand-navy);">لديك أكثر من 500 طالب أو عدة فروع لسنترك؟</div>
              <div style="font-size: 0.8rem; color: var(--brand-text); margin-top: 0.2rem;">نوفر باقات مخصصة للأعداد الكبرى بسيرفرات خاصة مع دعم مباشر.</div>
            </div>
            <a href="https://wa.me/201123671177?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D8%A8%D8%A7%D9%82%D8%A9%20%D9%85%D8%AE%D8%B5%D8%B5%D8%A9%20%D9%84%D8%A3%D9%83%D8%AB%D8%B1%20%D9%85%D9%86%20500%20%D8%B7%D8%A7%D9%84%D8%A8%20%D9%81%D9%8A%20%D8%B3%D9%86%D8%AA%D8%B1%D9%84%D9%8A" target="_blank" rel="noopener noreferrer" style="background: var(--brand-navy); color: #ffffff; text-decoration: none; font-family: 'Cairo', sans-serif; font-size: 0.85rem; font-weight: 700; padding: 0.55rem 1.25rem; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='var(--brand-navy-light)';" onmouseout="this.style.backgroundColor='var(--brand-navy)';">
              <span>تواصل معنا لتسعير مخصص</span>
            </a>
          </div>

        </div>
      </section>

      <!-- ================================================================= -->
      <!-- 5. FOOTER                                                         -->
      <!-- ================================================================= -->
      <footer style="background: var(--brand-navy); color: #ffffff; padding: 3.5rem 1.25rem 2rem; border-top: 1px solid rgba(255,255,255,0.1);">
        <div style="max-width: 1200px; margin: 0 auto;">
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 2.5rem; margin-bottom: 3rem;">
            
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 1rem;">
                <img src="${CENTRLY_LOGO_BASE64}" alt="سنترلي" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover;">
                <div style="font-family: 'Changa', 'Cairo', sans-serif; font-size: 1.3rem; font-weight: 800; color: #ffffff;">
                  سنترلي | Centrly
                </div>
              </div>
              <p style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.7; margin: 0;">
                المنظومة السحابية الذكية لإدارة المعلمين والمراكز التعليمية، تتبع الحضور بالباركود، كروت الطلاب، وأتمتة الواتساب.
              </p>
            </div>

            <div>
              <h4 style="font-size: 0.95rem; font-weight: 800; color: #ffffff; margin: 0 0 1rem;">روابط سريعة</h4>
              <div style="font-size: 0.85rem; line-height: 2.2; color: #cbd5e1; display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start;">
                <button type="button" onclick="window.centrlyApp.openPolicyModal('terms')" style="background: none; border: none; padding: 0; color: #cbd5e1; font-family: 'Cairo', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#cbd5e1'">شروط وأحكام الاستخدام</button>
                <button type="button" onclick="window.centrlyApp.openPolicyModal('privacy')" style="background: none; border: none; padding: 0; color: #cbd5e1; font-family: 'Cairo', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#cbd5e1'">سياسة الخصوصية</button>
                <button type="button" onclick="window.centrlyApp.openPolicyModal('refund')" style="background: none; border: none; padding: 0; color: #cbd5e1; font-family: 'Cairo', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#cbd5e1'">سياسة الاسترجاع واسترداد الأموال</button>
                <button type="button" onclick="window.centrlyApp.openPolicyModal('contact')" style="background: none; border: none; padding: 0; color: #cbd5e1; font-family: 'Cairo', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#ffffff'" onmouseout="this.style.color='#cbd5e1'">بيانات التواصل الرسمي والدعم</button>
              </div>
            </div>

            <div>
              <h4 style="font-size: 0.95rem; font-weight: 800; color: #ffffff; margin: 0 0 1rem;">وسائل الدفع المعتمدة في مصر</h4>
              <p style="font-size: 0.8rem; color: #94a3b8; margin: 0 0 1rem; line-height: 1.5;">
                دفع آمن ومشفر بالجنيه المصري (EGP) عبر بوابات الدفع الإلكترونية المرخصة في مصر.
              </p>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <span style="background: #ffffff; color: #e11d48; font-weight: 800; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px;">فودافون كاش</span>
                <span style="background: #ffffff; color: #0284c7; font-weight: 800; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px;">ميزة Meeza</span>
                <span style="background: #ffffff; color: #1e3a8a; font-weight: 800; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px;">Visa / MasterCard</span>
                <span style="background: #ffffff; color: #ea580c; font-weight: 800; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px;">محافظ المحمول</span>
              </div>
            </div>

          </div>

          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; font-size: 0.8rem; color: #94a3b8;">
            <div>جميع الحقوق محفوظة © ${new Date().getFullYear()} لمنصة سنترلي (Centrly SaaS)</div>
            <div style="display: flex; gap: 1rem;">
              <button onclick="window.centrlyApp.renderAuth('login')" style="background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 0.8rem; font-family: 'Cairo', sans-serif;">تسجيل الدخول</button>
              <span>•</span>
              <button onclick="window.centrlyApp.renderAuth('signup')" style="background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 0.8rem; font-family: 'Cairo', sans-serif;">إنشاء حساب جديد</button>
            </div>
          </div>

        </div>
      </footer>

      <!-- ================================================================= -->
      <!-- 7. COMPLETE LEGAL POLICY POPUP MODAL (CLEAN, ELEGANT)             -->
      <!-- ================================================================= -->
      <div id="policyModalOverlay" style="display: none; position: fixed; inset: 0; background: rgba(23, 45, 112, 0.7); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index: 2000; align-items: center; justify-content: center; padding: 1.25rem;">
        <div style="background: #ffffff; width: 100%; max-width: 680px; max-height: 85vh; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--brand-line);">
          
          <!-- Modal Header -->
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--brand-line); display: flex; align-items: center; justify-content: space-between; background: var(--brand-cream);">
            <h3 id="policyModalTitle" style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--brand-navy);">المستند القانوني</h3>
            <button onclick="window.centrlyApp.closePolicyModal()" style="background: transparent; border: none; cursor: pointer; font-size: 1.5rem; color: var(--brand-muted); padding: 0.25rem; line-height: 1;">&times;</button>
          </div>

          <!-- Modal Body Content (Comprehensive Text Injected Dynamically) -->
          <div id="policyModalBody" style="padding: 1.75rem; overflow-y: auto; font-size: 0.9rem; color: var(--brand-ink); line-height: 1.9;">
          </div>

          <!-- Modal Footer -->
          <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--brand-line); background: var(--brand-cream); text-align: left;">
            <button onclick="window.centrlyApp.closePolicyModal()" style="background: var(--brand-navy); color: #ffffff; border: none; font-family: 'Cairo', sans-serif; font-size: 0.85rem; font-weight: 700; padding: 0.5rem 1.5rem; border-radius: 8px; cursor: pointer;">
              إغلاق
            </button>
          </div>

        </div>
      </div>

    </div>
  `;
}
