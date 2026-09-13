import { escapeHtml } from '../utils/escapeHtml.js';
import { getIcon } from '../utils/icons.js';

/**
 * Centrly WhatsApp Settings & Templates Workspace (DEV-65)
 */

export function renderWhatsAppSettingsView(data = {}) {
  const isConnected = data.status === 'connected';
  const isAssistant = data.role === 'assistant' || data.role === 'assistant_to_teacher' || data.role === 'assistant_to_center';

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Connection & Strategy Status Card -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('whatsapp', 24, 'var(--centrly-blue-700)')}</span>
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">إعدادات وتكامل واتساب (WhatsApp & Anti-Ban Architecture)</h2>
              <span class="badge ${isConnected ? 'badge-success' : 'badge-warning'}" id="settingsWaBadge">
                ${isConnected ? `${getIcon('dotSuccess', 8)} الخادم متصل وجاهز ${data.phone_number ? `(${data.phone_number})` : ''}` : `${getIcon('dotWarning', 8)} بانتظار مسح رمز QR`}
              </span>
            </div>
            <p style="font-size: 0.85rem; color: #475569; margin-top: 0.35rem; line-height: 1.6;">
              ربط مباشر ومحمي عبر <strong>Evolution API</strong> يعتمد استراتيجية <strong>"بوابات الويب التفاعلية"</strong> لنقل المتابعة للويب وتخفيض رسائل الواتساب بنسبة <strong>90%</strong> لمنع الحظر نهائياً.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.reconnectWhatsApp()" style="display: inline-flex; align-items: center; gap: 0.35rem;">
              ${getIcon('refresh', 14)}
              <span>فحص الاتصال</span>
            </button>
            ${isConnected && !isAssistant ? `
              <button class="btn btn-danger btn-sm" onclick="window.centrlyApp.disconnectWhatsApp()" style="display: inline-flex; align-items: center; gap: 0.35rem;">
                ${getIcon('close', 14)}
                <span>إلغاء ربط الحساب</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Dynamic QR Connect Area (shown when not connected) -->
        ${!isConnected ? `
          <div style="background: #fff; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 1.25rem; margin-top: 1.25rem; display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
            <div style="width: 180px; height: 180px; background: #f8fafc; border: 2px dashed var(--centrly-blue-700); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              <img id="settingsQrImage" src="${data.qr_base64 || ''}" alt="WhatsApp QR Code" style="width: 100%; height: 100%; object-fit: contain; ${data.qr_base64 ? '' : 'display: none;'}">
              <div id="settingsQrLoading" style="font-size: 0.8rem; color: var(--centrly-text); padding: 1rem; text-align: center; ${data.qr_base64 ? 'display: none;' : ''}">
                ⏳ جارٍ إنشاء رمز QR...
              </div>
            </div>
            <div style="flex: 1; min-width: 250px;">
              <h4 style="margin: 0 0 0.5rem; font-size: 1rem; color: var(--centrly-ink);">ربط رقم واتساب بالمنظومة</h4>
              <p style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 0.75rem;">
                امسح رمز QR من هاتفك عبر <strong>الأجهزة المرتبطة > ربط جهاز</strong> في تطبيق واتساب لبدء إرسال روابط البوابات والإنذارات الحرجة.
              </p>
              ${(data.pairing_code && data.pairing_code.length <= 15) ? `
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink); margin-bottom: 0.75rem;">
                  كود الاقتران: <span id="settingsPairingCode" style="font-family: monospace; color: var(--centrly-blue-800); background: #f1f5f9; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid var(--centrly-line); font-size: 1.05rem; letter-spacing: 2px; font-weight: 800;">${escapeHtml(data.pairing_code)}</span>
                </div>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.refreshWhatsAppQR()" style="display: inline-flex; align-items: center; gap: 0.35rem;">
                ${getIcon('refresh', 14)}
                <span>تحديث رمز QR</span>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- 4 Key Protection Pillars -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
          <div style="background: #f0fdf4; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #bbf7d0;">
            <div style="font-size: 0.78rem; font-weight: 700; color: #166534;">بوابات الويب (Zero-Ban Architecture)</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #15803d; margin-top: 0.25rem;">تخفيض 90% من الرسائل</div>
            <div style="font-size: 0.75rem; color: #166534; margin-top: 0.25rem; line-height: 1.4;">نقل المتابعة اليومية للويب لمنع استنزاف الرقم نهائياً</div>
          </div>

          <div style="background: #eff6ff; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #bfdbfe;">
            <div style="font-size: 0.78rem; font-weight: 700; color: #1e40af;">التوزيع الذكي (Ultra Pacing)</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #1d4ed8; margin-top: 0.25rem;">20 - 40 ثانية عشوائي</div>
            <div style="font-size: 0.75rem; color: #1e40af; margin-top: 0.25rem; line-height: 1.4;">فواصل زمنية ومحاكاة بشرية تمنع رصد خوارزميات Meta للبوتات</div>
          </div>

          <div style="background: #faf5ff; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #e9d5ff;">
            <div style="font-size: 0.78rem; font-weight: 700; color: #6b21a8;">تنبيه حفظ الرقم (Contact Guard)</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #7e22ce; margin-top: 0.25rem;">مدمج في كل رابط</div>
            <div style="font-size: 0.75rem; color: #6b21a8; margin-top: 0.25rem; line-height: 1.4;">حث صريح لولي الأمر بحفظ الرقم لتفعيل الروابط ومنع الـ Spam</div>
          </div>

          <div style="background: #f8fafc; padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid #cbd5e1;">
            <div style="font-size: 0.78rem; font-weight: 700; color: #334155;">قاطع الدائرة وتدرج الإحماء (Circuit Breaker)</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem;">حماية نشطة 24/7</div>
            <div style="font-size: 0.75rem; color: #475569; margin-top: 0.25rem; line-height: 1.4;">إيقاف مؤقت وقائي 30 دقيقة عند الأخطاء وسقف يومي تصاعدي</div>
          </div>
        </div>
      </div>

      <!-- Anti-Ban Critical Warnings & Guidelines Card -->
      <div class="card" style="margin: 0; background: #fffbeb; border: 2px solid #f59e0b; box-shadow: 0 4px 15px rgba(245,158,11,0.12);">
        <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem;">
          <span>${getIcon('risk', 24, '#d97706')}</span>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #92400e;">
            تحذيرات وإرشادات أمنية هامة لحماية رقمك من الحظر (WhatsApp Anti-Ban 2.0 Rules)
          </h3>
        </div>
        <p style="font-size: 0.85rem; color: #78350f; margin-bottom: 1rem; line-height: 1.6;">
          واتساب يطبق خوارزميات صارمة لمكافحة الرسائل المجمعة (Spam). بعد إطلاق <strong>بوابات المتابعة التفاعلية للطالب وولي الأمر</strong>، تم تحديث استراتيجية حماية الرقم للالتزام بالقواعد المحدثة التالية:
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          
          <div style="background: #ffffff; padding: 0.9rem 1rem; border-radius: 8px; border-right: 4px solid #ef4444; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-weight: 800; color: #b91c1c; font-size: 0.9rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>🚫</span> 1. التحول للبوابات الذكية بدلاً من الإرسال المتكرر
            </div>
            <div style="font-size: 0.82rem; color: #475569; line-height: 1.6;">
              توقفنا تماماً عن إرسال رسائل متكررة مع كل حصة أو كويز أو واجب لتجنب خطر الحظر. المنظومة تنقل 90% من المتابعة إلى بوابة الطالب وبوابة ولي الأمر التي تُحدّث تلقائياً بالدرجات والحضور والمذكرات على الويب.
            </div>
          </div>

          <div style="background: #ffffff; padding: 0.9rem 1rem; border-radius: 8px; border-right: 4px solid #3b82f6; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-weight: 800; color: #1d4ed8; font-size: 0.9rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>👥</span> 2. إرسال رابط البوابة لمرة واحدة والتأكيد على حفظ الرقم
            </div>
            <div style="font-size: 0.82rem; color: #475569; line-height: 1.6;">
              يُرسل رابط البوابة المباشر لكل طالب/ولي أمر لمرة واحدة فقط، وتتضمن الرسالة تنبيهاً صريحاً بضرورة تسجيل الرقم باسم المنظومة على هواتفهم. حفظ الرقم يجعل الروابط قابلة للنقر فوراً ويمنع حظر الرقم كـ Spam نهائياً.
            </div>
          </div>

          <div style="background: #ffffff; padding: 0.9rem 1rem; border-radius: 8px; border-right: 4px solid #f59e0b; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-weight: 800; color: #b45309; font-size: 0.9rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>📈</span> 3. التدرج في إرسال الروابط للطلاب الجدد (Warm-Up & Pacing)
            </div>
            <div style="font-size: 0.82rem; color: #475569; line-height: 1.6;">
              إذا كان رقمك جديداً، ابدأ بإرسال 20 إلى 40 رابط يومياً في الأسبوع الأول. يطبق النظام تلقائياً فواصل زمنية عشوائية (20 إلى 40 ثانية) بين كل رسالة لمحاكاة السلوك البشري الطبيعي؛ لا تحاول تسريع هذا الإرسال.
            </div>
          </div>

          <div style="background: #ffffff; padding: 0.9rem 1rem; border-radius: 8px; border-right: 4px solid #10b981; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-weight: 800; color: #047857; font-size: 0.9rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>⚡</span> 4. قصر الواتساب على الروابط والإنذارات الحرجة فقط
            </div>
            <div style="font-size: 0.82rem; color: #475569; line-height: 1.6;">
              تم إلغاء أزرار الإرسال الجماعي العشوائي نهائياً لحماية رقمك. يقتصر الواتساب على: (1) تسليم روابط البوابات، (2) إنذارات الغياب الفوري، (3) إشعارات الطوارئ، مع حظر كامل لأي حملات إعلانية أو ترويجية.
            </div>
          </div>

        </div>
      </div>

      <!-- Quick Test Message Sender -->
      <div class="card" style="margin: 0;">
        <h3 class="card-title" style="font-size: 1.05rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          ${getIcon('send', 18, 'var(--centrly-blue-700)')}
          <span>إرسال رسالة اختبارية إلى هاتفك للتأكد من وصول الإشعارات</span>
        </h3>
        <p style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 0.75rem;">
          أدخل رقم هاتفك لتجربة استلام رسالة واتساب فورية والتأكد من جاهزية الخدمة وتنسيق الروابط:
        </p>

        <!-- Quick Fill Buttons -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.85rem;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="
            document.getElementById('testMsgInput').value = 'مرحباً بك! رسالة اختبارية لتأكيد ربط منظومة سنترلي بحسابك بنجاح.';
          " style="font-size: 0.78rem;">
            نموذج: رسالة ترحيبية عادية
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="
            document.getElementById('testMsgInput').value = 'السلام عليكم ولي أمر الطالب (محمد أحمد).\\nحرصاً على متابعة المستوى الدراسي، رابط بوابة المتابعة المباشرة:\\nhttps://centerly-platform.vercel.app/parent-portal?token=test_demo\\n\\n📌 يرجى حفظ هذا الرقم في جهات اتصالكم لتفعيل الروابط ولضمان وصول التقارير باستمرار.';
          " style="font-size: 0.78rem; background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;">
            نموذج: تجربة رسالة رابط بوابة ولي الأمر (مع تنبيه حفظ الرقم)
          </button>
        </div>

        <form id="whatsappTestForm" onsubmit="window.centrlyApp.sendTestWhatsAppMessage(event)" style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end;">
          <div class="form-group" style="flex: 1; min-width: 240px; margin: 0;">
            <label class="form-label" style="font-weight: 700;">رقم الهاتف (مع كود الدولة أو محلي)</label>
            <input type="tel" id="testPhoneInput" class="form-input" placeholder="01012345678" dir="ltr" required>
          </div>
          <div class="form-group" style="flex: 2; min-width: 280px; margin: 0;">
            <label class="form-label" style="font-weight: 700;">نص الرسالة الاختبارية</label>
            <input type="text" id="testMsgInput" class="form-input" value="مرحباً بك! رسالة اختبارية لتأكيد ربط منظومة سنترلي بحسابك بنجاح.">
          </div>
          <button type="submit" id="btnSendTestMsg" class="btn btn-primary" style="height: 42px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.4rem;">
            ${getIcon('send', 16, '#ffffff')}
            <span>إرسال الآن</span>
          </button>
        </form>
        <div id="testMsgFeedback" style="display: none; margin-top: 0.75rem; padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.85rem;"></div>
      </div>

      <!-- Ready Message Templates (Modernized for Portals) -->
      <div class="card" style="margin: 0;">
        <div class="card-header">
          <div>
            <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
              ${getIcon('note', 18, 'var(--centrly-blue-700)')}
              <span>قوالب رسائل الواتساب المعتمدة وفق منظومة البوابات الذكية</span>
            </h3>
            <p style="font-size: 0.8rem; color: var(--centrly-text); margin: 0.25rem 0 0;">
              يتم استبدال المتغيرات وتنويع صياغة المقدمات والخواتيم آلياً (Spintax Engine) لضمان خصوصية كل رسالة ومنع الفلترة
            </p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
          
          <!-- Template 1: Parent Portal Invite (Most Important) -->
          <div style="background: #fafbfc; border: 2px solid #bfdbfe; border-radius: 8px; padding: 1rem; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #1d4ed8;">1. رسالة تفعيل بوابة ولي الأمر</span>
              <span class="badge badge-blue">الأساسي (روابط المتابعة)</span>
            </div>
            <div style="background: #fff; border: 1px dashed #93c5fd; border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; line-height: 1.7; color: var(--centrly-ink);">
              السلام عليكم ورحمة الله وبركاته، ولي أمر الطالب ({اسم_الطالب}).<br>
              حرصاً على متابعة مستواه أولاً بأول، يسعدنا تزويدكم برابط بوابة المتابعة المباشرة:<br>
              🔗 <strong>{رابط_بوابة_ولي_الأمر}</strong><br>
              💡 <em>من خلال الرابط يمكنكم في أي وقت وبدون تسجيل دخول: متابعة الحضور، درجات الكويزات، وحالة الواجبات لحظياً.</em><br>
              📌 <strong>تنبيه هام:</strong> يرجى تسجيل وحفظ هذا الرقم في جهات اتصالكم لتفعيل الروابط ولضمان وصول التقارير باستمرار دون انقطاع.
            </div>
          </div>

          <!-- Template 2: Student Portal & Homework Submission -->
          <div style="background: #fafbfc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #0284c7;">2. رسالة تفعيل بوابة الطالب</span>
              <span class="badge" style="background: #e0f2fe; color: #0369a1;">بوابة الطالب</span>
            </div>
            <div style="background: #fff; border: 1px dashed var(--centrly-line); border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; line-height: 1.7; color: var(--centrly-ink);">
              مرحباً بك يا بطل ({اسم_الطالب})! 🎓<br>
              تم تفعيل رابط بوابتك التعليمية الخاصة للمذكرات والواجبات:<br>
              🔗 <strong>{رابط_بوابة_الطالب}</strong><br>
              📚 يمكنك الآن تحميل مذكرات الحصص وتسليم الواجبات بصيغة PDF ومتابعة نتائج كويزاتك أولاً بأول.<br>
              بالتوفيق والتميز دائماً! ✨
            </div>
          </div>

          <!-- Template 3: Emergency Absence Alert -->
          <div style="background: #fafbfc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #b91c1c;">3. إنذار الغياب الفوري عن الحصة</span>
              <span class="badge badge-danger">حالات طارئة فقط</span>
            </div>
            <div style="background: #fff; border: 1px dashed var(--centrly-line); border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; line-height: 1.7; color: var(--centrly-ink);">
              تنبيه غياب هام: ولي أمر الطالب <strong>{اسم_الطالب}</strong>،<br>
              نود إحاطتكم علماً بعدم حضوره حصة اليوم لمجموعة <strong>{اسم_المجموعة}</strong> بتاريخ {تاريخ_الحصة}.<br>
              يرجى مراجعة بوابة المتابعة للاطلاع على مذكرة الحصة وتنسيق موعد التعويض:<br>
              🔗 <strong>{رابط_بوابة_ولي_الأمر}</strong>
            </div>
          </div>

          <!-- Template 4: Monthly Report Card -->
          <div style="background: #fafbfc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #059669;">4. إشعار التقرير الشهري ولوحة الشرف</span>
              <span class="badge badge-success">تقارير دورية</span>
            </div>
            <div style="background: #fff; border: 1px dashed var(--centrly-line); border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; line-height: 1.7; color: var(--centrly-ink);">
              السلام عليكم ولي أمر الطالب <strong>{اسم_الطالب}</strong>،<br>
              تم رصد وتحديث تقرير التقييم الشامل ودرجات الكويزات لهذا الشهر.<br>
              يمكنكم الاطلاع على التقرير وملاحظات المعلم عبر بوابة المتابعة المباشرة:<br>
              🔗 <strong>{رابط_بوابة_ولي_الأمر}</strong><br>
              مع خالص تمنياتنا له بدوام التميز والتفوق.
            </div>
          </div>

        </div>
      </div>

    </div>
  `;
}
