import { escapeHtml } from '../utils/escapeHtml.js';
import { getIcon } from '../utils/icons.js';

/**
 * WhatsApp Center, Delivery Logs & Platform Profit Economics View
 * Combines WhatsApp Live Inbox & Messaging Tracker with Detailed Delivery Logs
 * and Centrly's Exact Teacher Subscription Profit Calculator.
 */
export function renderWhatsAppCenterView(data = {}, activeTab = 'inbox') {
  const stats = data.stats || {
    total_sent: 0,
    total_replied: 0,
    pending_reply: 0,
    reply_rate: 0,
  };

  const conversations = data.conversations || [];
  const currentStudentsCount = data.total_students || conversations.length || 105;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Header & Navigation Banner -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); color: #ffffff; border-radius: 16px; padding: 1.75rem 1.5rem; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(6, 78, 59, 0.2);">
        <div style="position: absolute; left: -20px; top: -20px; width: 140px; height: 140px; background: rgba(255, 255, 255, 0.05); border-radius: 50%; pointer-events: none;"></div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem; position: relative; z-index: 1;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: rgba(255, 255, 255, 0.15); border-radius: 10px; color: #34d399;">
                ${getIcon('whatsapp', 22, '#34d399')}
              </span>
              <h1 style="font-family: 'Changa', sans-serif; font-size: 1.45rem; font-weight: 800; margin: 0; color: #ffffff;">
                مركز محادثات الواتساب وحاسبة أرباح المنصة
              </h1>
            </div>
            <p style="font-size: 0.88rem; color: #d1fae5; margin: 0; line-height: 1.6; max-width: 650px;">
              متابعة مباشرة لمن رد ومن لم يرد من الطلاب وأولياء الأمور، مع سجل تفصيلي للرسائل، وحاسبة أرباح اشتراك المدرس وتكلفة الواتساب لمرة واحدة للشهرية القادمة.
            </p>
          </div>

          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
            <button class="btn" onclick="window.centrlyApp.loadWhatsAppInboxData()" style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.3); font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.15rem; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              ${getIcon('refresh', 16, '#ffffff')}
              <span>تحديث المحادثات</span>
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 1rem; flex-wrap: wrap;">
          <button type="button" id="tabBtnInbox" onclick="window.centrlyApp.switchWhatsAppTab('inbox')" style="padding: 0.55rem 1.25rem; border-radius: 8px; font-weight: 800; font-size: 0.9rem; border: none; cursor: pointer; transition: all 0.2s; ${activeTab === 'inbox' ? 'background: #ffffff; color: #065f46; box-shadow: 0 4px 10px rgba(0,0,0,0.1);' : 'background: rgba(255,255,255,0.1); color: #ffffff;'}">
            محادثات الطلاب وتتبع الردود (${stats.total_sent})
          </button>
          <button type="button" id="tabBtnLogs" onclick="window.centrlyApp.switchWhatsAppTab('logs')" style="padding: 0.55rem 1.25rem; border-radius: 8px; font-weight: 800; font-size: 0.9rem; border: none; cursor: pointer; transition: all 0.2s; ${activeTab === 'logs' ? 'background: #ffffff; color: #065f46; box-shadow: 0 4px 10px rgba(0,0,0,0.1);' : 'background: rgba(255,255,255,0.1); color: #ffffff;'}">
            سجل الرسائل وحالة التسليم (${stats.total_sent})
          </button>
          <button type="button" id="tabBtnCalc" onclick="window.centrlyApp.switchWhatsAppTab('calculator')" style="padding: 0.55rem 1.25rem; border-radius: 8px; font-weight: 800; font-size: 0.9rem; border: none; cursor: pointer; transition: all 0.2s; ${activeTab === 'calculator' ? 'background: #ffffff; color: #065f46; box-shadow: 0 4px 10px rgba(0,0,0,0.1);' : 'background: rgba(255,255,255,0.1); color: #ffffff;'}">
            حاسبة أرباحي من اشتراك المدرس والواتساب
          </button>
        </div>
      </div>

      <!-- TAB 1: INBOX & CHAT TRACKER -->
      <div id="sectionWhatsAppInbox" style="${activeTab === 'inbox' ? 'display: flex; flex-direction: column; gap: 1.5rem;' : 'display: none;'}">
        
        <!-- Quick Statistics Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
          <div class="card" style="margin: 0; padding: 1.25rem; border-radius: 12px; background: #ffffff; border: 1px solid var(--centrly-line); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الرسائل المرسلة</div>
              <div style="font-size: 1.75rem; font-weight: 900; color: #0f172a; margin-top: 0.2rem; font-family: monospace;">${stats.total_sent}</div>
            </div>
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: #2563eb;">
              ${getIcon('send', 22, '#2563eb')}
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 1.25rem; border-radius: 12px; background: #f0fdf4; border: 1.5px solid #bbf7d0; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.8rem; color: #166534; font-weight: 800;">وصل رد من ولي الأمر / الطالب</div>
              <div style="font-size: 1.75rem; font-weight: 900; color: #15803d; margin-top: 0.2rem; font-family: monospace;">${stats.total_replied}</div>
            </div>
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #dcfce7; display: flex; align-items: center; justify-content: center; color: #15803d;">
              ${getIcon('check', 22, '#15803d')}
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 1.25rem; border-radius: 12px; background: #ffffff; border: 1px solid var(--centrly-line); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">في انتظار الرد</div>
              <div style="font-size: 1.75rem; font-weight: 900; color: #64748b; margin-top: 0.2rem; font-family: monospace;">${stats.pending_reply}</div>
            </div>
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #f8fafc; display: flex; align-items: center; justify-content: center; color: #64748b;">
              ${getIcon('clock', 22, '#64748b')}
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 1.25rem; border-radius: 12px; background: #ffffff; border: 1px solid var(--centrly-line); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">معدل التفاعل والاستجابة</div>
              <div style="font-size: 1.75rem; font-weight: 900; color: #0284c7; margin-top: 0.2rem; font-family: monospace;">${stats.reply_rate}%</div>
            </div>
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #f0f9ff; display: flex; align-items: center; justify-content: center; color: #0284c7;">
              ${getIcon('chart', 22, '#0284c7')}
            </div>
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="card" style="margin: 0; padding: 1rem 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <button class="btn btn-sm" id="btnFilterAll" onclick="window.centrlyApp.filterWhatsAppInbox('ALL')" style="font-weight: 800; border-radius: 8px; background: #0f172a; color: #ffffff;">
                الكل (${stats.total_sent})
              </button>
              <button class="btn btn-sm" id="btnFilterReplied" onclick="window.centrlyApp.filterWhatsAppInbox('REPLIED')" style="font-weight: 800; border-radius: 8px; background: #f1f5f9; color: #334155;">
                وصل رد (${stats.total_replied})
              </button>
              <button class="btn btn-sm" id="btnFilterPending" onclick="window.centrlyApp.filterWhatsAppInbox('PENDING')" style="font-weight: 800; border-radius: 8px; background: #f1f5f9; color: #334155;">
                بانتظار الرد (${stats.pending_reply})
              </button>
            </div>

            <div style="flex: 1; max-width: 320px; position: relative;">
              <input type="text" id="inboxSearchInput" class="form-input" placeholder="بحث باسم الطالب أو رقم الهاتف..." oninput="window.centrlyApp.searchWhatsAppInbox(this.value)" style="padding-right: 2.2rem; font-size: 0.85rem; border-radius: 8px;">
              <span style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); color: #94a3b8; display: flex;">
                ${getIcon('search', 16, '#94a3b8')}
              </span>
            </div>

          </div>
        </div>

        <!-- Conversation Cards List -->
        <div id="inboxConversationsList" style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${renderConversationCards(conversations)}
        </div>

      </div>

      <!-- TAB 2: DETAILED DELIVERY LOGS TABLE -->
      <div id="sectionWhatsAppLogs" style="${activeTab === 'logs' ? 'display: flex; flex-direction: column; gap: 1.5rem;' : 'display: none;'}">
        <div class="card" style="margin: 0; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.15rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.85rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">
                سجل الرسائل وحالة التسليم التفصيلي
              </h3>
              <p style="margin: 0.25rem 0 0; font-size: 0.825rem; color: #64748b;">
                جدول كامل بجميع الرسائل الصادرة وحالة استلام ورد أولياء الأمور وتاريخ الإرسال بدقة.
              </p>
            </div>
            <div>
              <span class="badge" style="background: #eff6ff; color: #1e40af; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                إجمالي السجلات: ${conversations.length}
              </span>
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: right;">
                  <th style="padding: 0.75rem 0.85rem; font-weight: 800; color: #334155;">اسم الطالب</th>
                  <th style="padding: 0.75rem 0.85rem; font-weight: 800; color: #334155;">رقم الهاتف</th>
                  <th style="padding: 0.75rem 0.85rem; font-weight: 800; color: #334155;">نص الرسالة المرسلة</th>
                  <th style="padding: 0.75rem 0.85rem; font-weight: 800; color: #334155;">حالة الرد</th>
                  <th style="padding: 0.75rem 0.85rem; font-weight: 800; color: #334155;">تاريخ ووقت الإرسال</th>
                  <th style="padding: 0.75rem 0.85rem; font-weight: 800; color: #334155; text-align: center;">إجراء</th>
                </tr>
              </thead>
              <tbody>
                ${renderLogsTableRows(conversations)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB 3: PLATFORM PROFIT CALCULATOR FROM TEACHER SUBSCRIPTION -->
      <div id="sectionWhatsAppCalculator" style="${activeTab === 'calculator' ? 'display: flex; flex-direction: column; gap: 1.5rem;' : 'display: none;'}">
        
        <!-- Explanation Banner -->
        <div class="card" style="margin: 0; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 1.25rem 1.5rem;">
          <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
            <div style="color: #16a34a; margin-top: 0.15rem;">${getIcon('info', 22, '#16a34a')}</div>
            <div>
              <div style="font-weight: 900; font-size: 1.05rem; color: #166534; margin-bottom: 0.4rem;">
                حاسبة أرباحي الصافية من اشتراك المدرس وتكلفة الواتساب
              </div>
              <div style="font-size: 0.88rem; color: #15803d; line-height: 1.8;">
                • <strong>اشتراك المدرس في سنترلي (الربح الخاص بي كمنصة):</strong> المدرس يشترك في المنصة باشتراك شهري (مثال: <strong>600 ج.م شهرياً</strong>).<br>
                • <strong>رسائل تفعيل الطلاب تُرسل لمرة واحدة فقط:</strong> المدرس يسجل طلابه (مثال: <strong>105 طالب</strong>)، ويتم إرسال روابط المنصة لهم <strong>مرة واحدة فقط في الشهر الأول</strong>.<br>
                • <strong>مكسبي في الشهر الأول (Month 1):</strong> يدفع المدرس 600 ج.م، ونحاسب تكلفة رسائل الواتساب لطلابه الـ 105 (تُدفع لمرة واحدة فقط أو تكون 0 ج.م إذا كانت ضمن شريحة Meta المجانية).<br>
                • <strong>مكسبي في الشهور القادمة (الشهرية القادمة Month 2 وما بعدها):</strong> يدفع المدرس اشتراكه الشهري (600 ج.م)، بينما تكلفة رسائل الواتساب لطلابه = <strong>0.00 ج.م</strong> لأن الروابط أُرسلت مسبقاً ولا تُعاد، فيصبح <strong>مكسبي الصافي 600 ج.م كاملة (100% صافي ربح مستمر)!</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- Interactive Calculator Inputs -->
        <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px;">
          <h3 style="margin: 0 0 1.25rem 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.5rem;">
            <span>${getIcon('chart', 20, 'var(--centrly-blue-700)')}</span>
            <span>مدخلات حسبة اشتراك المدرس والطلاب (مثال 600 ج.م و 105 طالب)</span>
          </h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
            
            <!-- 1. Subscription Fee Per Teacher -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 800; font-size: 0.85rem; color: #334155;">
                اشتراك المدرس الشهري في سنترلي (ج.م)
              </label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="number" id="calcTeacherFee" class="form-input" min="50" max="10000" value="600" oninput="window.centrlyApp.recalculateWhatsAppEconomics()" style="font-weight: 800; font-size: 1.15rem; padding: 0.65rem 0.85rem; padding-left: 3rem;">
                <span style="position: absolute; left: 0.75rem; font-weight: 800; color: #64748b; font-size: 0.85rem;">ج.م</span>
              </div>
              <div style="display: flex; gap: 0.35rem; margin-top: 0.4rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcTeacherFee(200)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #f1f5f9;">200 ج.م</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcTeacherFee(499)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #f1f5f9;">499 ج.م</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcTeacherFee(600)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #dcfce7; color: #166534; font-weight: 800;">600 ج.م</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcTeacherFee(899)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #f1f5f9;">899 ج.م</button>
              </div>
            </div>

            <!-- 2. Students Count for this Teacher -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 800; font-size: 0.85rem; color: #334155;">
                عدد طلاب هذا المدرس (المراد تفعيلهم بالواتساب)
              </label>
              <input type="number" id="calcTeacherStudents" class="form-input" min="1" max="5000" value="105" oninput="window.centrlyApp.recalculateWhatsAppEconomics()" style="font-weight: 800; font-size: 1.15rem; padding: 0.65rem 0.85rem;">
              <div style="display: flex; gap: 0.35rem; margin-top: 0.4rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(50)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #f1f5f9;">50 طالب</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(70)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #f1f5f9;">70 طالب</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(105)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #dcfce7; color: #166534; font-weight: 800;">105 طالب</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(150)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #f1f5f9;">150 طالب</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(200)" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #f1f5f9;">200 طالب</button>
              </div>
            </div>

            <!-- 3. Cost Per WhatsApp Message -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 800; font-size: 0.85rem; color: #334155;">
                سعر رسالة الواتساب عند المحاسبة (ج.م)
              </label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="number" id="calcMsgUnitCost" class="form-input" min="0" max="10" step="0.05" value="0.80" oninput="window.centrlyApp.recalculateWhatsAppEconomics()" style="font-weight: 800; font-size: 1.15rem; padding: 0.65rem 0.85rem; padding-left: 3rem;">
                <span style="position: absolute; left: 0.75rem; font-weight: 800; color: #64748b; font-size: 0.85rem;">ج.م</span>
              </div>
              <div style="font-size: 0.75rem; color: #16a34a; font-weight: 700; margin-top: 0.4rem;">
                أول 1,000 رسالة شهرياً مجانية من Meta
              </div>
            </div>

          </div>
        </div>

        <!-- Live Results Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 1.25rem;">
          
          <!-- Month 1: Setup & Onboarding -->
          <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px; background: #ffffff; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
              <span class="badge" style="background: #e2e8f0; color: #1e293b; font-weight: 800; font-size: 0.8rem; padding: 0.3rem 0.6rem;">الشهر الأول (تفعيل المدرس وطلابه)</span>
              <span style="font-size: 0.75rem; color: #64748b;">تُدفع لمرة واحدة فقط</span>
            </div>

            <div style="font-size: 0.85rem; color: #64748b;">قيمة اشتراك المدرس المدفوعة:</div>
            <div id="calcMonth1Revenue" style="font-size: 1.85rem; font-weight: 900; color: #0f172a; font-family: monospace; margin-top: 0.15rem;">
              600 ج.م
            </div>

            <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.825rem;">
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>رسائل تفعيل الطلاب:</span>
                <strong id="calcMonth1Msgs" style="font-family: monospace; color: #0f172a;">105 رسالة</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>تكلفة رسائل الواتساب:</span>
                <strong id="calcMonth1Cost" style="font-family: monospace; color: #ea580c;">84 ج.م</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #16a34a; font-weight: 700;">
                <span>في حال شريحة Meta المجانية:</span>
                <span>0.00 ج.م (ضمن الـ 1,000)</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #0f172a; font-weight: 900; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed #e2e8f0;">
                <span>مكسبي الصافي في الشهر الأول:</span>
                <span id="calcMonth1Net" style="color: #047857; font-size: 1.2rem; font-family: monospace;">516 ج.م</span>
              </div>
            </div>
          </div>

          <!-- Month 2+: Recurring Months -->
          <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; box-shadow: 0 6px 20px rgba(22, 163, 74, 0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
              <span class="badge" style="background: #16a34a; color: #ffffff; font-weight: 800; font-size: 0.8rem; padding: 0.3rem 0.6rem;">الشهرية القادمة (أرباح مستمرة شهرياً)</span>
              <span style="font-size: 0.75rem; color: #15803d; font-weight: 700;">تتكرر شهرياً</span>
            </div>

            <div style="font-size: 0.85rem; color: #166534;">مكسبي الصافي المستمر شهرياً:</div>
            <div id="calcMonth2Net" style="font-size: 2.1rem; font-weight: 900; color: #15803d; font-family: monospace; margin-top: 0.15rem;">
              600 ج.م
            </div>

            <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid rgba(22, 163, 74, 0.2); display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.825rem;">
              <div style="display: flex; justify-content: space-between; color: #166534;">
                <span>تكلفة رسائل الواتساب لطلابه:</span>
                <strong style="color: #15803d; font-size: 0.95rem;">0.00 ج.م (صفر تكلفة)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #15803d;">
                <span>السبب:</span>
                <span>الروابط أرسلت مرة واحدة فقط في أول شهر ولا تُعاد</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #14532d; font-weight: 900; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed rgba(22, 163, 74, 0.3);">
                <span>نسبة مكسبي الصافي من الاشتراك:</span>
                <span style="font-size: 1.15rem; color: #15803d; font-weight: 900;">100% ربح صافي كامل</span>
              </div>
            </div>
          </div>

          <!-- Annual Summary Card -->
          <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px; background: #ffffff; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
              <span class="badge" style="background: #0284c7; color: #ffffff; font-weight: 800; font-size: 0.8rem; padding: 0.3rem 0.6rem;">إجمالي السنة الأولى من المدرس</span>
              <span style="font-size: 0.75rem; color: #64748b;">12 شهر اشتراك</span>
            </div>

            <div style="font-size: 0.85rem; color: #64748b;">صافي ربحي السنوي من هذا المدرس:</div>
            <div id="calcYearNet" style="font-size: 1.85rem; font-weight: 900; color: #0284c7; font-family: monospace; margin-top: 0.15rem;">
              7,116 ج.م
            </div>

            <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.825rem;">
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>إجمالي الاشتراكات المحصلة (12 شهر):</span>
                <strong id="calcYearRevenue" style="font-family: monospace; color: #0f172a;">7,200 ج.م</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>إجمالي تكلفة رسائل الواتساب:</span>
                <strong id="calcYearCost" style="font-family: monospace; color: #ea580c;">84 ج.م (مرة واحدة فقط)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #0284c7; font-weight: 900; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed #e2e8f0;">
                <span>هامش الربح السنوي الصافي:</span>
                <span id="calcYearMargin" style="color: #0284c7; font-size: 1.15rem; font-family: monospace;">98.8%</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Scale Card: Multiple Teachers at the same plan -->
        <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px;">
          <h4 style="margin: 0 0 1rem 0; font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink);">
            رادار التوسع: أرباحي الشهرية المستمرة عند اشتراك عدة مدرسين بنفس الباقة (<span id="calcRadarFeeLabel">600</span> ج.م/مدرس)
          </h4>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.8rem; color: #64748b; font-weight: 700;">عند اشتراك 10 مدرسين</div>
              <div id="radar10" style="font-size: 1.4rem; font-weight: 900; color: #0f172a; margin: 0.35rem 0; font-family: monospace;">6,000 ج.م</div>
              <div style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">شهرياً بدون مصاريف رسائل</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.8rem; color: #64748b; font-weight: 700;">عند اشتراك 25 مدرس</div>
              <div id="radar25" style="font-size: 1.4rem; font-weight: 900; color: #0284c7; margin: 0.35rem 0; font-family: monospace;">15,000 ج.م</div>
              <div style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">شهرياً بدون مصاريف رسائل</div>
            </div>

            <div style="background: #f8fafc; border: 1.5px solid #bbf7d0; background: #f0fdf4; border-radius: 10px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.8rem; color: #166534; font-weight: 700;">عند اشتراك 50 مدرس</div>
              <div id="radar50" style="font-size: 1.4rem; font-weight: 900; color: #15803d; margin: 0.35rem 0; font-family: monospace;">30,000 ج.م</div>
              <div style="font-size: 0.75rem; color: #15803d; font-weight: 800;">شهرياً بدون مصاريف رسائل</div>
            </div>

            <div style="background: #f8fafc; border: 1.5px solid #fed7aa; background: #fff7ed; border-radius: 10px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.8rem; color: #9a3412; font-weight: 700;">عند اشتراك 100 مدرس</div>
              <div id="radar100" style="font-size: 1.4rem; font-weight: 900; color: #ea580c; margin: 0.35rem 0; font-family: monospace;">60,000 ج.م</div>
              <div style="font-size: 0.75rem; color: #c2410c; font-weight: 800;">شهرياً بدون مصاريف رسائل</div>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;
}

function renderConversationCards(conversations = []) {
  if (!conversations || conversations.length === 0) {
    return `
      <div class="card" style="margin: 0; padding: 3rem 1.5rem; text-align: center; border-radius: 12px;">
        <div style="color: #94a3b8; margin-bottom: 0.75rem; display: flex; justify-content: center;">
          ${getIcon('inbox', 42, '#94a3b8')}
        </div>
        <h4 style="margin: 0 0 0.4rem 0; font-size: 1.1rem; color: #334155; font-weight: 800;">
          لا توجد رسائل واتساب مسجلة بعد
        </h4>
        <p style="font-size: 0.85rem; color: #64748b; margin: 0;">
          عند إرسال روابط المنصة للطلاب أو عند استلام ردودهم، ستظهر جميع المحادثات وتفاصيلها هنا فوراً.
        </p>
      </div>
    `;
  }

  return conversations.map((conv) => {
    const isReplied = Boolean(conv.has_replied);
    const cleanPhone = String(conv.phone || '').replace(/\D/g, '');
    const displayPhone = cleanPhone.startsWith('20') ? '0' + cleanPhone.slice(2) : cleanPhone;
    const studentName = conv.student_name || 'طالب';
    const lastMsgBody = conv.last_message?.body || 'تم إرسال رابط المنصة وبوابة المتابعة';
    const msgTime = conv.last_message?.time ? new Date(conv.last_message.time).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'اليوم';

    return `
      <div class="card conversation-item" data-replied="${isReplied}" data-name="${escapeHtml(studentName.toLowerCase())}" data-phone="${escapeHtml(cleanPhone)}" style="margin: 0; padding: 1.15rem 1.25rem; border-radius: 12px; background: ${isReplied ? '#ffffff' : '#fafafa'}; border: ${isReplied ? '1.5px solid #86efac' : '1px solid var(--centrly-line)'}; transition: all 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          
          <!-- Student & Phone Info -->
          <div style="display: flex; align-items: center; gap: 0.85rem; min-width: 240px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: ${isReplied ? '#dcfce7' : '#f1f5f9'}; color: ${isReplied ? '#15803d' : '#64748b'}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.05rem; flex-shrink: 0;">
              ${escapeHtml(studentName.charAt(0) || 'ط')}
            </div>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                <span>${escapeHtml(studentName)}</span>
                <span class="badge" style="font-size: 0.7rem; padding: 0.1rem 0.45rem; ${isReplied ? 'background: #dcfce7; color: #166534;' : 'background: #f1f5f9; color: #475569;'}">
                  ${isReplied ? 'وصل رد 💬' : 'تم الإرسال ⏳'}
                </span>
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.15rem; font-family: monospace; display: flex; align-items: center; gap: 0.35rem;" dir="ltr">
                <span>${escapeHtml(displayPhone)}</span>
              </div>
            </div>
          </div>

          <!-- Message Status & Content -->
          <div style="flex: 1; min-width: 250px; background: ${isReplied ? '#f0fdf4' : '#f8fafc'}; border: 1px solid ${isReplied ? '#bbf7d0' : '#e2e8f0'}; border-radius: 8px; padding: 0.65rem 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <span style="font-size: 0.75rem; font-weight: 800; color: ${isReplied ? '#15803d' : '#475569'};">
                ${isReplied ? 'آخر رد من الطالب / ولي الأمر:' : 'حالة الإرسال:'}
              </span>
              <span style="font-size: 0.72rem; color: #94a3b8;">${escapeHtml(msgTime)}</span>
            </div>
            <div style="font-size: 0.825rem; color: ${isReplied ? '#14532d' : '#334155'}; font-weight: ${isReplied ? '700' : '500'}; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(lastMsgBody)}
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button class="btn btn-sm" onclick="window.centrlyApp.openWhatsAppChatWindow('${escapeHtml(cleanPhone)}', '${escapeHtml(studentName)}')" style="background: #25D366; color: #ffffff; border: none; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.25);">
              ${getIcon('whatsapp', 15, '#ffffff')}
              <span>فتح الشات</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.showWhatsAppMessageHistory('${escapeHtml(conv.id || cleanPhone)}')" style="font-weight: 700; font-size: 0.8rem; padding: 0.45rem 0.75rem; border-radius: 8px;">
              تفاصيل المحادثة
            </button>
          </div>

        </div>
      </div>
    `;
  }).join('');
}

function renderLogsTableRows(conversations = []) {
  if (!conversations || conversations.length === 0) {
    return `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
          لا توجد سجلات رسائل مسجلة بعد.
        </td>
      </tr>
    `;
  }

  return conversations.map((c) => {
    const isReplied = Boolean(c.has_replied);
    const cleanPhone = String(c.phone || '').replace(/\D/g, '');
    const displayPhone = cleanPhone.startsWith('20') ? '0' + cleanPhone.slice(2) : cleanPhone;
    const studentName = c.student_name || 'طالب';
    const body = c.last_message?.body || 'تم إرسال رابط المنصة وبوابة المتابعة';
    const time = c.last_message?.time ? new Date(c.last_message.time).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 0.75rem 0.85rem; font-weight: 700; color: #0f172a;">${escapeHtml(studentName)}</td>
        <td style="padding: 0.75rem 0.85rem; font-family: monospace; color: #475569;" dir="ltr">${escapeHtml(displayPhone)}</td>
        <td style="padding: 0.75rem 0.85rem; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #334155;" title="${escapeHtml(body)}">${escapeHtml(body)}</td>
        <td style="padding: 0.75rem 0.85rem;">
          <span class="badge" style="font-size: 0.72rem; padding: 0.2rem 0.5rem; ${isReplied ? 'background: #dcfce7; color: #166534;' : 'background: #f1f5f9; color: #475569;'}">
            ${isReplied ? 'وصل رد 💬' : 'في انتظار الرد ⏳'}
          </span>
        </td>
        <td style="padding: 0.75rem 0.85rem; font-size: 0.78rem; color: #64748b;">${escapeHtml(time)}</td>
        <td style="padding: 0.75rem 0.85rem; text-align: center;">
          <button class="btn btn-sm" onclick="window.centrlyApp.openWhatsAppChatWindow('${escapeHtml(cleanPhone)}', '${escapeHtml(studentName)}')" style="background: #25D366; color: #fff; font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: 6px; border: none; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
            ${getIcon('whatsapp', 13, '#ffffff')}
            <span>فتح الشات</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}
