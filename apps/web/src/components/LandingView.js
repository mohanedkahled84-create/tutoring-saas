import { getIcon } from '../utils/icons.js';

/**
 * Centrly SaaS Official Landing Page Component
 * Arabic-First, RTL, Egyptian EdTech Focus
 * Features:
 * - Persistent Sticky Top Navigation Bar with Login & Signup Action Buttons
 * - High-converting Hero Section with Scanner & WhatsApp Previews
 * - 6 Core Value-Driving Features
 * - Egyptian Pricing Plans (599 EGP Starter Tier, 899 EGP Pro, 1499 EGP Center)
 * - Complete Kashier Payment Gateway Compliance (Terms, Privacy, Refund Guarantee, Contact Info, EGP Currency, Local Wallets)
 */
export function renderLandingView() {
  return `
    <div class="landing-page" style="font-family: 'Cairo', sans-serif; direction: rtl; color: #0f172a; background: #ffffff; min-height: 100vh; overflow-x: hidden;">
      
      <!-- ================================================================= -->
      <!-- 1. STICKY TOP NAVIGATION BAR                                      -->
      <!-- ================================================================= -->
      <header id="landingNav" style="position: sticky; top: 0; z-index: 1000; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); background: rgba(255, 255, 255, 0.95); border-bottom: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04); transition: all 0.2s ease;">
        <div style="max-width: 1200px; margin: 0 auto; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
          
          <!-- Brand Logo & Identity -->
          <div style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
            <div style="width: 42px; height: 42px; background: linear-gradient(135deg, #1e3a8a, #2563eb); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
              <span style="font-family: 'Changa', sans-serif; color: #f59e0b; font-weight: 800; font-size: 1.4rem; line-height: 1;">سـ</span>
            </div>
            <div>
              <div style="font-family: 'Changa', sans-serif; font-size: 1.35rem; font-weight: 800; line-height: 1.1; color: #0f172a;">
                <span style="color: #1e3a8a;">سنتر</span><span style="color: #f59e0b;">لي</span>
                <span style="font-size: 0.85rem; font-weight: 700; color: #64748b; margin-right: 0.25rem;">| Centrly</span>
              </div>
              <div style="font-size: 0.7rem; color: #64748b; font-weight: 600;">المنظومة الذكية للمعلم والسنتر</div>
            </div>
          </div>

          <!-- Desktop Quick Links (Hidden on small mobile) -->
          <nav class="desktop-nav-links" style="display: flex; align-items: center; gap: 1.5rem; font-size: 0.9rem; font-weight: 700;">
            <a href="#features" style="color: #334155; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#334155'">المميزات</a>
            <a href="#scanner" style="color: #334155; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#334155'">مسح الباركود</a>
            <a href="#whatsapp" style="color: #334155; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#334155'">الواتساب ضد الحظر</a>
            <a href="#pricing" style="color: #334155; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#334155'">الأسعار والباقات</a>
            <a href="#parent-portal" style="color: #334155; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#334155'">بوابة ولي الأمر</a>
            <a href="#compliance" style="color: #334155; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color='#334155'">الشروط والسياسات</a>
          </nav>

          <!-- Action Buttons (Persistent Top CTAs) -->
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <button onclick="window.centrlyApp.renderAuth('login')" 
              style="background: transparent; border: 1.5px solid #cbd5e1; color: #1e3a8a; font-family: 'Cairo', sans-serif; font-size: 0.875rem; font-weight: 700; padding: 0.5rem 1.1rem; border-radius: 9px; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.35rem;"
              onmouseover="this.style.borderColor='#1e3a8a'; this.style.backgroundColor='#f8fafc';"
              onmouseout="this.style.borderColor='#cbd5e1'; this.style.backgroundColor='transparent';">
              <span>تسجيل الدخول</span>
            </button>

            <button onclick="window.centrlyApp.renderAuth('signup')" 
              style="background: linear-gradient(135deg, #10b981, #059669); border: none; color: #ffffff; font-family: 'Cairo', sans-serif; font-size: 0.875rem; font-weight: 800; padding: 0.52rem 1.25rem; border-radius: 9px; cursor: pointer; box-shadow: 0 3px 10px rgba(16,185,129,0.3); transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.4rem;"
              onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 5px 15px rgba(16,185,129,0.4)';"
              onmouseout="this.style.transform='none'; this.style.boxShadow='0 3px 10px rgba(16,185,129,0.3)';">
              <span>ابدأ مجاناً</span>
              <span style="font-size: 0.75rem; background: rgba(0,0,0,0.15); padding: 0.15rem 0.45rem; border-radius: 9999px;">7 أيام</span>
            </button>
          </div>

        </div>
      </header>

      <!-- ================================================================= -->
      <!-- 2. HERO SECTION                                                   -->
      <!-- ================================================================= -->
      <section style="padding: 4rem 1.25rem 3.5rem; background: radial-gradient(circle at 50% 10%, #eff6ff 0%, #ffffff 75%); position: relative;">
        <div style="max-width: 1100px; margin: 0 auto; text-align: center;">
          
          <!-- Top Badge -->
          <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 0.4rem 1rem; border-radius: 9999px; margin-bottom: 1.5rem;">
            <span style="display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
            <span style="font-size: 0.85rem; font-weight: 700; color: #065f46;">المنظومة الأولى في مصر بحماية Ultra Anti-Ban للواتساب ضد الحظر 🛡️</span>
          </div>

          <!-- Main Catchy Headline -->
          <h1 style="font-size: clamp(1.9rem, 4.5vw, 3.2rem); font-weight: 900; line-height: 1.3; color: #0f172a; margin: 0 auto 1.25rem; max-width: 950px; letter-spacing: -0.02em;">
            المنظومة السحابية الأذكى لإدارة <span style="color: #1e3a8a; text-decoration: underline decoration-color: #f59e0b; text-underline-offset: 8px;">حصصك، كروتك، وطلابك</span> في مصر
          </h1>

          <!-- Subtitle -->
          <p style="font-size: clamp(0.95rem, 2vw, 1.2rem); color: #475569; max-width: 820px; margin: 0 auto 2.25rem; line-height: 1.7; font-weight: 600;">
            تسجيل حضور بالباركود السريع في ثوانٍ، كروت ذكية وطباعة فورية، رسائل واتساب آلية لأولياء الأمور بدرجات الكويزات بدون خطر الحظر، وبوابة متابعة تفاعلية لكل طالب بدون الحاجة لتحميل أي تطبيقات.
          </p>

          <!-- Dual Hero CTAs -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.5rem;">
            <button onclick="window.centrlyApp.renderAuth('signup')" 
              style="background: linear-gradient(135deg, #10b981, #059669); border: none; color: #ffffff; font-family: 'Cairo', sans-serif; font-size: 1.1rem; font-weight: 800; padding: 0.85rem 2.25rem; border-radius: 12px; cursor: pointer; box-shadow: 0 6px 20px rgba(16,185,129,0.35); transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.6rem;">
              <span>ابدأ تجربتك المجانية فوراً (7 أيام)</span>
              <span style="font-size: 1.25rem;">←</span>
            </button>

            <button onclick="window.centrlyApp.renderAuth('login')" 
              style="background: #ffffff; border: 2px solid #1e3a8a; color: #1e3a8a; font-family: 'Cairo', sans-serif; font-size: 1.05rem; font-weight: 800; padding: 0.8rem 1.85rem; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.5rem;"
              onmouseover="this.style.backgroundColor='#f1f5f9';"
              onmouseout="this.style.backgroundColor='#ffffff';">
              <span>تسجيل الدخول لحسابك</span>
            </button>
          </div>

          <!-- Trust Badges Row -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 1.75rem; flex-wrap: wrap; color: #64748b; font-size: 0.875rem; font-weight: 700;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="color: #10b981;">✔</span>
              <span>بدون بطاقة ائتمانية للتجربة</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="color: #10b981;">✔</span>
              <span>مسح باركود مستمر وفوري</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="color: #10b981;">✔</span>
              <span>دعم فني مصري على مدار الساعة</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="color: #10b981;">✔</span>
              <span>متوافق 100% مع الموبايل والكمبيوتر</span>
            </div>
          </div>

          <!-- Hero UI Mockup Showcase -->
          <div style="margin-top: 3.5rem; background: #ffffff; border-radius: 20px; box-shadow: 0 20px 50px -10px rgba(15, 23, 42, 0.12), 0 0 0 1px #e2e8f0; padding: 1.25rem; max-width: 960px; margin-left: auto; margin-right: auto; text-align: right;">
            
            <!-- Window Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.85rem; margin-bottom: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="width: 12px; height: 12px; background: #ef4444; border-radius: 50%;"></span>
                <span style="width: 12px; height: 12px; background: #f59e0b; border-radius: 50%;"></span>
                <span style="width: 12px; height: 12px; background: #10b981; border-radius: 50%;"></span>
                <span style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-right: 0.75rem;">لوحة تسجيل الحضور الذكي والواتساب الفوري | سنترلي</span>
              </div>
              <span style="background: #ecfdf5; color: #065f46; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 9999px;">
                🟢 الماسح متصل وجاهز
              </span>
            </div>

            <!-- Mockup Columns (Scanner + Live WhatsApp Alert) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
              
              <!-- Card 1: Attendance Scan simulation -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem;">
                <div style="font-size: 0.85rem; font-weight: 800; color: #1e3a8a; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
                  <span>⚡ تم مسح كارت الطالب بالباركود:</span>
                </div>
                <div style="background: #ffffff; border: 1.5px solid #10b981; border-radius: 10px; padding: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <div style="font-weight: 800; font-size: 1rem; color: #0f172a;">مروان أحمد إبراهيم</div>
                    <div style="font-size: 0.75rem; color: #64748b;">كود: #1042 • مجموعة 3 ثانوي (السبت 4 م)</div>
                  </div>
                  <span style="background: #10b981; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px;">حاضر (واجب متميز ✅)</span>
                </div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.6rem;">
                  💡 مسح مستمر بدون لمس الماوس، الحضور والواجب يتسجلان في جزء من الثانية.
                </div>
              </div>

              <!-- Card 2: Live WhatsApp Dispatch Simulation -->
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 1.25rem;">
                <div style="font-size: 0.85rem; font-weight: 800; color: #166534; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                  <span>💬 رسالة واتساب مرسلة لولي الأمر تلقائياً:</span>
                  <span style="font-size: 0.7rem; background: #dcfce7; color: #15803d; padding: 0.2rem 0.5rem; border-radius: 9999px;">تم الإرسال الآن ✓✓</span>
                </div>
                <div style="background: #ffffff; border-radius: 10px; padding: 0.85rem; font-size: 0.825rem; line-height: 1.6; color: #1e293b; border-right: 4px solid #10b981;">
                  السلام عليكم يا فندم، نود إبلاغكم بحضور الطالب <b>مروان أحمد</b> حصة اليوم في موعده، ودرجة كويز الجبر: <b>10/10 🌟</b><br>
                  لمتابعة سجل درجاته وحضوره خطوة بخطوة:<br>
                  <span style="color: #2563eb; text-decoration: underline;">https://centrly.app/p?token=a8f...</span>
                </div>
                <div style="font-size: 0.75rem; color: #15803d; margin-top: 0.6rem; font-weight: 600;">
                  🛡️ مع نظام Ultra Anti-Ban: فواصل عشوائية (Jitter) ودوران قوالب الرسائل لصفر حظر.
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      <!-- ================================================================= -->
      <!-- 3. CORE FEATURES GRID                                             -->
      <!-- ================================================================= -->
      <section id="features" style="padding: 5rem 1.25rem; background: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
        <div style="max-width: 1180px; margin: 0 auto;">
          
          <div style="text-align: center; max-width: 750px; margin: 0 auto 3.5rem;">
            <span style="color: #2563eb; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em;">كل ما تحتاجه لإدارة منظومتك</span>
            <h2 style="font-size: clamp(1.6rem, 3vw, 2.3rem); font-weight: 900; color: #0f172a; margin: 0.5rem 0 1rem;">
              صُممت خصيصاً لتلائم طبيعة التعليم والسناتر في مصر
            </h2>
            <p style="font-size: 1rem; color: #64748b; margin: 0; line-height: 1.6;">
              انسَ شيتات الإكسيل اليدوية وضياع الأوراق ومشاكل حظر أرقام الواتساب.. سنترلي تمنحك منظومة متكاملة تدير كل تفصيلة في دقائق.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem;">
            
            <!-- Feature 1 -->
            <div id="scanner" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.07)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
              <div style="width: 50px; height: 50px; background: #eff6ff; color: #2563eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; font-size: 1.5rem;">
                ⚡
              </div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem;">تسجيل الحضور بالباركود السريع المستمر</h3>
              <p style="font-size: 0.9rem; color: #64748b; line-height: 1.7; margin: 0;">
                ماسح ضوئي ذكي بتركيز تلقائي مستمر. فقط وجه الباركود وسجل حضور 100 طالب في أقل من دقيقتين بدون الحاجة للمس الفأرة أو النوافذ المزعجة.
              </p>
            </div>

            <!-- Feature 2 -->
            <div id="whatsapp" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.07)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
              <div style="width: 50px; height: 50px; background: #ecfdf5; color: #10b981; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; font-size: 1.5rem;">
                💬
              </div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem;">رسائل واتساب فائقة الحماية (Ultra Anti-Ban)</h3>
              <p style="font-size: 0.9rem; color: #64748b; line-height: 1.7; margin: 0;">
                تقنية Spintax لتنويع صياغة الرسائل تلقائياً، فواصل زمنية عشوائية ذكية (Jitter)، ومحاكاة الكتابة الحية لضمان إرسال مئات الرسائل لأولياء الأمور بأمان تام لخطك.
              </p>
            </div>

            <!-- Feature 3 -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.07)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
              <div style="width: 50px; height: 50px; background: #fef3c7; color: #d97706; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; font-size: 1.5rem;">
                🪪
              </div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem;">كروت الطلاب وتصدير التصميمات (Canva & Photoshop)</h3>
              <p style="font-size: 0.9rem; color: #64748b; line-height: 1.7; margin: 0;">
                طباعة كروت سريعة PDF جاهزة، أو تصدير ملف بيانات متكامل (Excel / CSV) متوافق مع برامج التصميم لدمج بيانات الطلاب على تصميم كارتك الخاص وطباعته بلاستيكياً.
              </p>
            </div>

            <!-- Feature 4 -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.07)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
              <div style="width: 50px; height: 50px; background: #fdf2f8; color: #db2777; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; font-size: 1.5rem;">
                📊
              </div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem;">رصد وتوزيع درجات الكويزات بنقرة زر</h3>
              <p style="font-size: 0.9rem; color: #64748b; line-height: 1.7; margin: 0;">
                تسجيل درجات الاختبارات الدورية، وتعديل العنوان والدرجة القصوى، مع إمكانية إرسال النتيجة بضغطة زر واحدة إلى أرقام أولياء الأمور والطلاب معاً فورياً.
              </p>
            </div>

            <!-- Feature 5 -->
            <div id="parent-portal" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.07)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
              <div style="width: 50px; height: 50px; background: #f5f3ff; color: #7c3aed; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; font-size: 1.5rem;">
                👨‍👩‍👧
              </div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem;">بوابة متابعة ولي الأمر التفاعلية (بدون تطبيق)</h3>
              <p style="font-size: 0.9rem; color: #64748b; line-height: 1.7; margin: 0;">
                رابط متابعة ذكي ومشفّر لكل طالب، يفتحه ولي الأمر من أي متصفح هاتف لمتابعة الحضور والغياب ودرجات الكويزات لحظة بلحظة بدون تسجيل دخول أو تحميل أي تطبيق.
              </p>
            </div>

            <!-- Feature 6 -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.07)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)'">
              <div style="width: 50px; height: 50px; background: #fff7ed; color: #ea580c; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; font-size: 1.5rem;">
                🏫
              </div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.6rem;">إدارة السناتر وتعدد المدرسين والقاعات</h3>
              <p style="font-size: 0.9rem; color: #64748b; line-height: 1.7; margin: 0;">
                تنظيم جدول الحصص الأسبوعي، منع تضارب القاعات، حساب نسب المدرسين والماليات والتسويات الشهرية، مع إدارة صلاحيات المساعدين بدقة وأمان.
              </p>
            </div>

          </div>

        </div>
      </section>

      <!-- ================================================================= -->
      <!-- 4. TRANSPARENT PRICING SECTION (EGP ONLY)                         -->
      <!-- ================================================================= -->
      <section id="pricing" style="padding: 5.5rem 1.25rem; background: #ffffff;">
        <div style="max-width: 1140px; margin: 0 auto;">
          
          <div style="text-align: center; max-width: 800px; margin: 0 auto 3rem;">
            <span style="color: #10b981; font-weight: 800; font-size: 0.9rem; text-transform: uppercase;">تسعير عادل وشفاف 100%</span>
            <h2 style="font-size: clamp(1.7rem, 3vw, 2.4rem); font-weight: 900; color: #0f172a; margin: 0.5rem 0 0.8rem;">
              كل ميزات المنصة متاحة بالكامل في كل الباقات
            </h2>
            <p style="font-size: 1.05rem; color: #475569; margin: 0 0 1.25rem; font-weight: 600;">
              لا نحجب عنك أي ميزة! الاختلاف الوحيد بين الباقات هو <b>عدد الطلاب المسجلين</b> فقط.
            </p>
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: #eff6ff; border: 1.5px solid #bfdbfe; color: #1e3a8a; padding: 0.5rem 1.25rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 800;">
              <span>✨ جميع الميزات: باركود + واتساب ضد الحظر + كروت وتصميم + كويزات + بوابة ولي أمر + قاعات ومساعدين</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; align-items: stretch;">
            
            <!-- Plan 1: 100 Students (599 EGP) -->
            <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 18px; padding: 2.25rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 30px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-size: 1.2rem; font-weight: 800; color: #0f172a;">باقة 100 طالب</div>
                  <span style="background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px;">للبدايات والمجموعات</span>
                </div>
                
                <div style="margin: 1.5rem 0 1.25rem; display: flex; align-items: baseline; gap: 0.35rem;">
                  <span style="font-size: 2.75rem; font-weight: 900; color: #0f172a;">599</span>
                  <span style="font-size: 1rem; font-weight: 700; color: #64748b;">ج.م / شهرياً</span>
                </div>

                <div style="font-size: 0.9rem; font-weight: 800; color: #1e3a8a; background: #eff6ff; padding: 0.5rem 0.85rem; border-radius: 8px; display: block; text-align: center; margin-bottom: 1.5rem; border: 1px solid #dbeafe;">
                  👥 سعة الطلاب: حتى 100 طالب
                </div>

                <div style="font-size: 0.8rem; font-weight: 800; color: #10b981; margin-bottom: 0.6rem;">
                  🎁 تشمل جميع ميزات المنظومة بالكامل:
                </div>

                <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: #334155; line-height: 2.1;">
                  <li>✔ تسجيل الحضور بالباركود السريع المستمر</li>
                  <li>✔ رسائل الواتساب الفورية ضد الحظر (Ultra Anti-Ban)</li>
                  <li>✔ كروت الطلاب (طباعة PDF + تصدير كانفا وفوتوشوب)</li>
                  <li>✔ رصد الكويزات وتوزيع درجات الاختبارات بنقرة زر</li>
                  <li>✔ بوابة متابعة ولي الأمر التفاعلية بدون تطبيق</li>
                  <li>✔ دعم المساعدين وإدارة القاعات والسنتر</li>
                  <li>✔ تقارير إحصائية ومالية كاملة</li>
                  <li>✔ دعم فني مصري مباشر على مدار الساعة</li>
                </ul>
              </div>

              <div style="margin-top: 2rem;">
                <button onclick="window.centrlyApp.renderAuth('signup')" 
                  style="width: 100%; background: #f1f5f9; border: 1.5px solid #cbd5e1; color: #0f172a; font-family: 'Cairo', sans-serif; font-size: 0.95rem; font-weight: 800; padding: 0.8rem; border-radius: 10px; cursor: pointer; transition: all 0.2s ease;"
                  onmouseover="this.style.backgroundColor='#1e3a8a'; this.style.borderColor='#1e3a8a'; this.style.color='#ffffff';"
                  onmouseout="this.style.backgroundColor='#f1f5f9'; this.style.borderColor='#cbd5e1'; this.style.color='#0f172a';">
                  ابدأ باقة الـ 100 طالب (تجربة 7 أيام)
                </button>
              </div>
            </div>

            <!-- Plan 2: 250 Students (899 EGP - Popular) -->
            <div style="background: #ffffff; border: 2.5px solid #2563eb; border-radius: 18px; padding: 2.25rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; box-shadow: 0 12px 30px rgba(37,99,235,0.12); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
              <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; font-size: 0.775rem; font-weight: 800; padding: 0.25rem 1rem; border-radius: 9999px; box-shadow: 0 2px 8px rgba(37,99,235,0.3);">
                ⭐ الأكثر طلباً للمعلمين
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-size: 1.25rem; font-weight: 800; color: #1e3a8a;">باقة 250 طالب</div>
                  <span style="background: #dbeafe; color: #1e40af; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px;">للمجموعات الكبيرة</span>
                </div>
                
                <div style="margin: 1.5rem 0 1.25rem; display: flex; align-items: baseline; gap: 0.35rem;">
                  <span style="font-size: 2.75rem; font-weight: 900; color: #1e3a8a;">899</span>
                  <span style="font-size: 1rem; font-weight: 700; color: #64748b;">ج.م / شهرياً</span>
                </div>

                <div style="font-size: 0.9rem; font-weight: 800; color: #15803d; background: #ecfdf5; padding: 0.5rem 0.85rem; border-radius: 8px; display: block; text-align: center; margin-bottom: 1.5rem; border: 1px solid #bbf7d0;">
                  👥 سعة الطلاب: حتى 250 طالب
                </div>

                <div style="font-size: 0.8rem; font-weight: 800; color: #10b981; margin-bottom: 0.6rem;">
                  🎁 تشمل جميع ميزات المنظومة بالكامل:
                </div>

                <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: #334155; line-height: 2.1;">
                  <li>✔ تسجيل الحضور بالباركود السريع المستمر</li>
                  <li>✔ رسائل الواتساب الفورية ضد الحظر (Ultra Anti-Ban)</li>
                  <li>✔ كروت الطلاب (طباعة PDF + تصدير كانفا وفوتوشوب)</li>
                  <li>✔ رصد الكويزات وتوزيع درجات الاختبارات بنقرة زر</li>
                  <li>✔ بوابة متابعة ولي الأمر التفاعلية بدون تطبيق</li>
                  <li>✔ دعم المساعدين وإدارة القاعات والسنتر</li>
                  <li>✔ تقارير إحصائية ومالية كاملة</li>
                  <li>✔ دعم فني مصري مباشر على مدار الساعة</li>
                </ul>
              </div>

              <div style="margin-top: 2rem;">
                <button onclick="window.centrlyApp.renderAuth('signup')" 
                  style="width: 100%; background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; color: #ffffff; font-family: 'Cairo', sans-serif; font-size: 1rem; font-weight: 800; padding: 0.8rem; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 15px rgba(37,99,235,0.3); transition: all 0.2s ease;"
                  onmouseover="this.style.opacity='0.92';"
                  onmouseout="this.style.opacity='1';">
                  ابدأ باقة الـ 250 طالب (تجربة 7 أيام)
                </button>
              </div>
            </div>

            <!-- Plan 3: 500 Students (1,499 EGP) -->
            <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 18px; padding: 2.25rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 30px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-size: 1.2rem; font-weight: 800; color: #0f172a;">باقة 500 طالب</div>
                  <span style="background: #f3e8ff; color: #6b21a8; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px;">للسناتر وكبار المدرسين</span>
                </div>
                
                <div style="margin: 1.5rem 0 1.25rem; display: flex; align-items: baseline; gap: 0.35rem;">
                  <span style="font-size: 2.75rem; font-weight: 900; color: #0f172a;">1,499</span>
                  <span style="font-size: 1rem; font-weight: 700; color: #64748b;">ج.م / شهرياً</span>
                </div>

                <div style="font-size: 0.9rem; font-weight: 800; color: #7c3aed; background: #f5f3ff; padding: 0.5rem 0.85rem; border-radius: 8px; display: block; text-align: center; margin-bottom: 1.5rem; border: 1px solid #e9d5ff;">
                  👥 سعة الطلاب: حتى 500 طالب
                </div>

                <div style="font-size: 0.8rem; font-weight: 800; color: #10b981; margin-bottom: 0.6rem;">
                  🎁 تشمل جميع ميزات المنظومة بالكامل:
                </div>

                <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: #334155; line-height: 2.1;">
                  <li>✔ تسجيل الحضور بالباركود السريع المستمر</li>
                  <li>✔ رسائل الواتساب الفورية ضد الحظر (Ultra Anti-Ban)</li>
                  <li>✔ كروت الطلاب (طباعة PDF + تصدير كانفا وفوتوشوب)</li>
                  <li>✔ رصد الكويزات وتوزيع درجات الاختبارات بنقرة زر</li>
                  <li>✔ بوابة متابعة ولي الأمر التفاعلية بدون تطبيق</li>
                  <li>✔ دعم المساعدين وإدارة القاعات والسنتر</li>
                  <li>✔ تقارير إحصائية ومالية كاملة</li>
                  <li>✔ دعم فني مصري مباشر على مدار الساعة</li>
                </ul>
              </div>

              <div style="margin-top: 2rem;">
                <button onclick="window.centrlyApp.renderAuth('signup')" 
                  style="width: 100%; background: #f1f5f9; border: 1.5px solid #cbd5e1; color: #0f172a; font-family: 'Cairo', sans-serif; font-size: 0.95rem; font-weight: 800; padding: 0.8rem; border-radius: 10px; cursor: pointer; transition: all 0.2s ease;"
                  onmouseover="this.style.backgroundColor='#1e3a8a'; this.style.borderColor='#1e3a8a'; this.style.color='#ffffff';"
                  onmouseout="this.style.backgroundColor='#f1f5f9'; this.style.borderColor='#cbd5e1'; this.style.color='#0f172a';">
                  ابدأ باقة الـ 500 طالب (تجربة 7 أيام)
                </button>
              </div>
            </div>

          </div>

          <!-- Enterprise Custom Callout -->
          <div style="margin-top: 2.5rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-size: 1rem; font-weight: 800; color: #0f172a;">لديك أكثر من 500 طالب أو عدة فروع لسنترك؟</div>
              <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">نوفر باقات مخصصة للأعداد الضخمة والسناتر الكبرى بخصومات خاصة على الاشتراكات السنوية.</div>
            </div>
            <button onclick="window.centrlyApp.openPolicyModal('contact')" style="background: #0f172a; color: #ffffff; border: none; font-family: 'Cairo', sans-serif; font-size: 0.875rem; font-weight: 700; padding: 0.6rem 1.25rem; border-radius: 8px; cursor: pointer;">
              تواصل معنا لتسعير مخصص 💬
            </button>
          </div>

          </div>

        </div>
      </section>

      <!-- ================================================================= -->
      <!-- 5. KASHIER COMPLIANCE & LEGAL FOOTER                              -->
      <!-- ================================================================= -->
      <footer id="compliance" style="background: #0f172a; color: #f8fafc; padding: 4rem 1.25rem 2rem; border-top: 1px solid #1e293b;">
        <div style="max-width: 1200px; margin: 0 auto;">
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 2.5rem; margin-bottom: 3.5rem;">
            
            <!-- Column 1: Brand & Registration info -->
            <div>
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                <div style="width: 38px; height: 38px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Changa', sans-serif; font-weight: 800; font-size: 1.25rem;">
                  سـ
                </div>
                <div style="font-family: 'Changa', sans-serif; font-size: 1.25rem; font-weight: 800; color: #ffffff;">
                  منصة سنترلي | Centrly
                </div>
              </div>
              <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.7; margin: 0 0 1rem;">
                منظومة سحابية مصرية متخصصة في حلول إدارة المعلمين والمراكز التعليمية، تتبع الحضور بالباركود، كروت الطلاب الذكية، وأتمتة إشعارات أولياء الأمور.
              </p>
              <div style="font-size: 0.8rem; color: #cbd5e1; line-height: 1.6;">
                🏢 <b>الاسم التجاري:</b> سنترلي للحلول التعليمية والبرمجيات (Centrly)<br>
                📍 <b>المقر الرئيسي:</b> جمهورية مصر العربية — القاهرة
              </div>
            </div>

            <!-- Column 2: Kashier Compliance Legal Links -->
            <div>
              <h4 style="font-size: 1rem; font-weight: 800; color: #ffffff; margin: 0 0 1.25rem; border-right: 3px solid #2563eb; padding-right: 0.5rem;">
                السياسات والشروط القانونية
              </h4>
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; line-height: 2.2;">
                <li>
                  <a href="javascript:void(0)" onclick="window.centrlyApp.openPolicyModal('terms')" style="color: #94a3b8; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#60a5fa'" onmouseout="this.style.color='#94a3b8'">
                    📄 شروط وأحكام الاستخدام (Terms of Service)
                  </a>
                </li>
                <li>
                  <a href="javascript:void(0)" onclick="window.centrlyApp.openPolicyModal('privacy')" style="color: #94a3b8; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#60a5fa'" onmouseout="this.style.color='#94a3b8'">
                    🔒 سياسة الخصوصية وحماية البيانات (Privacy Policy)
                  </a>
                </li>
                <li>
                  <a href="javascript:void(0)" onclick="window.centrlyApp.openPolicyModal('refund')" style="color: #94a3b8; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#60a5fa'" onmouseout="this.style.color='#94a3b8'">
                    💰 سياسة الاسترجاع والإلغاء (Refund Policy)
                  </a>
                </li>
                <li>
                  <a href="javascript:void(0)" onclick="window.centrlyApp.openPolicyModal('contact')" style="color: #94a3b8; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#60a5fa'" onmouseout="this.style.color='#94a3b8'">
                    📞 بيانات التواصل وخدمة العملاء
                  </a>
                </li>
              </ul>
            </div>

            <!-- Column 3: Contact & Support (Official Egyptian Info) -->
            <div id="contact">
              <h4 style="font-size: 1rem; font-weight: 800; color: #ffffff; margin: 0 0 1.25rem; border-right: 3px solid #10b981; padding-right: 0.5rem;">
                تواصل معنا وخدمة العملاء
              </h4>
              <div style="font-size: 0.85rem; color: #94a3b8; line-height: 2;">
                <div>✉️ <b>البريد الإلكتروني:</b> <a href="mailto:support@centrly.app" style="color: #60a5fa; text-decoration: none;">support@centrly.app</a></div>
                <div>📱 <b>هاتف / واتساب الدعم الفني:</b> <span dir="ltr" style="color: #f1f5f9; font-weight: 700;">+20 100 000 0000</span></div>
                <div>⏰ <b>أوقات العمل:</b> طوال أيام الأسبوع من 9:00 ص حتى 10:00 م بتوقيت القاهرة</div>
                <div>🇪🇬 <b>العملة المعتمدة:</b> جميع التعاملات تصدر بالجنيه المصري (EGP)</div>
              </div>
            </div>

            <!-- Column 4: Accepted Payment Methods Badges -->
            <div>
              <h4 style="font-size: 1rem; font-weight: 800; color: #ffffff; margin: 0 0 1.25rem; border-right: 3px solid #f59e0b; padding-right: 0.5rem;">
                وسائل الدفع المعتمدة في مصر
              </h4>
              <p style="font-size: 0.8rem; color: #94a3b8; margin: 0 0 1rem; line-height: 1.5;">
                دفع آمن ومشفر 100% عبر بوابات الدفع الإلكترونية المرخصة من البنك المركزي المصري.
              </p>
              
              <!-- Payment Logos Placeholders -->
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="background: #ffffff; color: #e11d48; font-weight: 900; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px; border: 1px solid #334155;">فودافون كاش</span>
                <span style="background: #ffffff; color: #0284c7; font-weight: 900; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px; border: 1px solid #334155;">ميزة Meeza</span>
                <span style="background: #ffffff; color: #1e3a8a; font-weight: 900; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px; border: 1px solid #334155;">Visa / MasterCard</span>
                <span style="background: #ffffff; color: #ea580c; font-weight: 900; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px; border: 1px solid #334155;">محافظ المحمول (أورنج/اتصالات/وي)</span>
              </div>
            </div>

          </div>

          <!-- Bottom Copyright -->
          <div style="border-top: 1px solid #1e293b; padding-top: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; font-size: 0.8rem; color: #64748b;">
            <div>
              جميع الحقوق محفوظة © ${new Date().getFullYear()} لمنصة <b>سنترلي (Centrly SaaS)</b>. صنع بكل فخر للمعلمين في مصر 🇪🇬
            </div>
            <div style="display: flex; gap: 1rem;">
              <button onclick="window.centrlyApp.renderAuth('login')" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.8rem; font-family: 'Cairo', sans-serif;">تسجيل الدخول</button>
              <span>•</span>
              <button onclick="window.centrlyApp.renderAuth('signup')" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.8rem; font-family: 'Cairo', sans-serif;">إنشاء حساب جديد</button>
            </div>
          </div>

        </div>
      </footer>

      <!-- ================================================================= -->
      <!-- 6. KASHIER LEGAL POLICY MODAL (TERMS / PRIVACY / REFUND)          -->
      <!-- ================================================================= -->
      <div id="policyModalOverlay" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 2000; align-items: center; justify-content: center; padding: 1.25rem;">
        <div style="background: #ffffff; width: 100%; max-width: 680px; max-height: 85vh; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e2e8f0;">
          
          <!-- Modal Header -->
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; background: #f8fafc;">
            <h3 id="policyModalTitle" style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a;">سياسة المنصة</h3>
            <button onclick="window.centrlyApp.closePolicyModal()" style="background: transparent; border: none; cursor: pointer; font-size: 1.5rem; color: #64748b; padding: 0.25rem; line-height: 1;">&times;</button>
          </div>

          <!-- Modal Body Content -->
          <div id="policyModalBody" style="padding: 1.5rem; overflow-y: auto; font-size: 0.9rem; color: #334155; line-height: 1.8;">
            <!-- Injected dynamically via openPolicyModal -->
          </div>

          <!-- Modal Footer -->
          <div style="padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; background: #f8fafc; text-align: left;">
            <button onclick="window.centrlyApp.closePolicyModal()" style="background: #1e3a8a; color: #ffffff; border: none; font-family: 'Cairo', sans-serif; font-size: 0.85rem; font-weight: 700; padding: 0.5rem 1.5rem; border-radius: 8px; cursor: pointer;">
              إغلاق
            </button>
          </div>

        </div>
      </div>

    </div>
  `;
}
