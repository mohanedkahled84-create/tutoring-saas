/**
 * Centrly WhatsApp Settings & Templates Workspace (DEV-65)
 */

export function renderWhatsAppSettingsView(data = {}) {
  const isConnected = data.status === 'connected';
  const isAssistant = data.role === 'assistant' || data.role === 'assistant_to_teacher' || data.role === 'assistant_to_center';

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Connection & Anti-Ban Status -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.4rem;">💬</span>
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">إعدادات وتكامل واتساب (WhatsApp & Templates)</h2>
              <span class="badge ${isConnected ? 'badge-success' : 'badge-warning'}" id="settingsWaBadge">
                ${isConnected ? `🟢 الخادم متصل وجاهز ${data.phone_number ? `(${data.phone_number})` : ''}` : '🟡 بانتظار مسح رمز QR'}
              </span>
            </div>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              ربط مباشر ومحمي عبر Evolution API مع آليات حماية رقم المعلم من الحظر (Anti-Ban Pacing & Circuit Breaker).
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.reconnectWhatsApp()">
              🔄 فحص الاتصال
            </button>
            ${isConnected && !isAssistant ? `
              <button class="btn btn-danger btn-sm" onclick="window.centrlyApp.disconnectWhatsApp()">
                🔴 إلغاء ربط الحساب
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
                امسح رمز QR من هاتفك عبر <strong>الأجهزة المرتبطة > ربط جهاز</strong> في تطبيق واتساب لبدء إرسال الإشعارات تلقائياً.
              </p>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink); margin-bottom: 0.75rem;">
                كود الاقتران: <span id="settingsPairingCode" style="font-family: monospace; color: var(--centrly-blue-800);">${data.pairing_code || '---'}</span>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.refreshWhatsAppQR()">
                🔄 تحديث رمز QR
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Protection & Quota Badges -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
          <div style="background: #f8fafc; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--centrly-line);">
            <div style="font-size: 0.8rem; color: var(--centrly-text);">نظام التوزيع الآمن (Pacing)</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">مفعّل (4 - 9 ثوانٍ عشوائي)</div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.2rem;">يمنع النمط المتكرر لاكتشاف البوتات</div>
          </div>
          <div style="background: #f8fafc; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--centrly-line);">
            <div style="font-size: 0.8rem; color: var(--centrly-text);">قاطع الدائرة (Circuit Breaker)</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--centrly-blue-700); margin-top: 0.25rem;">حماية نشطة 24/7</div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.2rem;">إيقاف مؤقت فوري حال انقطاع الشبكة</div>
          </div>
          <div style="background: #f8fafc; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--centrly-line);">
            <div style="font-size: 0.8rem; color: var(--centrly-text);">سجل رسائل الحصص</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink); margin-top: 0.25rem;">إرسال بضغطة واحدة</div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.2rem;">بعد إنهاء الحصة التعليمية</div>
          </div>
        </div>
      </div>

      <!-- Quick Test Message Sender -->
      <div class="card" style="margin: 0;">
        <h3 class="card-title" style="font-size: 1.05rem; margin-bottom: 0.75rem;">
          📱 إرسال رسالة اختبارية إلى هاتفك للتأكد من وصول الإشعارات
        </h3>
        <p style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 1rem;">
          أدخل رقم هاتفك لتجربة استلام رسالة واتساب فورية من منظومة سنترلي للتأكد من جاهزية الخدمة.
        </p>

        <form id="whatsappTestForm" onsubmit="window.centrlyApp.sendTestWhatsAppMessage(event)" style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end;">
          <div class="form-group" style="flex: 1; min-width: 240px; margin: 0;">
            <label class="form-label" style="font-weight: 700;">رقم الهاتف (مع كود الدولة أو محلي)</label>
            <input type="tel" id="testPhoneInput" class="form-input" placeholder="01012345678" dir="ltr" required>
          </div>
          <div class="form-group" style="flex: 2; min-width: 280px; margin: 0;">
            <label class="form-label" style="font-weight: 700;">نص الرسالة الاختبارية</label>
            <input type="text" id="testMsgInput" class="form-input" value="مرحباً بك! رسالة اختبارية لتأكيد ربط منظومة سنترلي بحسابك بنجاح ✅">
          </div>
          <button type="submit" id="btnSendTestMsg" class="btn btn-primary" style="height: 42px; font-weight: 700; white-space: nowrap;">
            🚀 إرسال الآن
          </button>
        </form>
        <div id="testMsgFeedback" style="display: none; margin-top: 0.75rem; padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.85rem;"></div>
      </div>

      <!-- Ready Message Templates -->
      <div class="card" style="margin: 0;">
        <div class="card-header">
          <h3 class="card-title" style="font-size: 1.05rem;">
            📑 قوالب رسائل الواتساب المعتمدة (تُرسل تلقائياً)
          </h3>
          <span style="font-size: 0.8rem; color: var(--centrly-text);">
            يتم استبدال المتغيرات آلياً ببيانات كل طالب
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 1rem;">
          
          <!-- Template 1: Absence -->
          <div style="background: #fafbfc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #b91c1c;">1. إشعار الغياب عن الحصة</span>
              <span class="badge badge-danger">تلقائي</span>
            </div>
            <div style="background: #fff; border: 1px dashed var(--centrly-line); border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; line-height: 1.7; color: var(--centrly-ink);">
              عزيزي ولي أمر الطالب: <strong>{اسم_الطالب}</strong>،<br>
              نود إحاطتكم علماً بعدم حضوره حصة اليوم لمجموعة <strong>{اسم_المجموعة}</strong> بتاريخ {تاريخ_الحصة}.<br>
              يرجى المتابعة لتعويض الحصة وحرصاً على مصلحة الطالب.
            </div>
          </div>

          <!-- Template 2: Performance Report -->
          <div style="background: #fafbfc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 800; font-size: 0.95rem; color: var(--centrly-blue-800);">2. تقرير الحصة والواجب</span>
              <span class="badge badge-blue">تلقائي</span>
            </div>
            <div style="background: #fff; border: 1px dashed var(--centrly-line); border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; line-height: 1.7; color: var(--centrly-ink);">
              تقرير حضور حصة: <strong>{اسم_الطالب}</strong><br>
              • الواجب المنزلي: <strong>{حالة_الواجب}</strong><br>
              • درجة الكويز: <strong>{الدرجة}/{الدرجة_القصوى}</strong><br>
              • ملاحظة المعلم: <strong>{الملاحظة}</strong>
            </div>
          </div>

          <!-- Template 3: Extra Session -->
          <div style="background: #fafbfc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #7c3aed;">3. إشعار الحصة الإضافية</span>
              <span class="badge" style="background:#ede9fe; color:#7c3aed;">تلقائي</span>
            </div>
            <div style="background: #fff; border: 1px dashed var(--centrly-line); border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; line-height: 1.7; color: var(--centrly-ink);">
              تنبيه هام: تم جدولة حصة إضافية لمجموعة <strong>{اسم_المجموعة}</strong><br>
              • الموعد: <strong>{تاريخ_الحصة} - {الوقت}</strong><br>
              • موضوع الحصة: <strong>{الموضوع}</strong>
            </div>
          </div>

        </div>
      </div>

    </div>
  `;
}
