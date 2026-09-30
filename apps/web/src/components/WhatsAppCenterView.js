import { escapeHtml } from '../utils/escapeHtml.js';
import { getIcon } from '../utils/icons.js';

/**
 * WhatsApp Center, Delivery Logs & Platform Profit Economics View
 * Combines WhatsApp Live Inbox & Messaging Tracker with Detailed Delivery Logs,
 * Meta Cloud API Free Tier Usage Tracker, and Centrly's Exact Official Plans
 * (300 @ 499 EGP, 750 @ 899 EGP, 1500 @ 1,399 EGP) with 20% Annual Discount.
 */
export function renderWhatsAppCenterView(data = {}, activeTab = 'inbox') {
  const stats = data.stats || {
    total_sent: 0,
    total_replied: 0,
    pending_reply: 0,
    reply_rate: 0,
  };

  const conversations = data.conversations || [];
  const totalSent = stats.total_sent || conversations.length || 0;
  const currentActualStudents = data.total_students || window.centrlyApp?.students?.length || 68;
  const metaFreeRemaining = Math.max(0, 1000 - totalSent);
  const metaUsedPercent = Math.min(100, Math.round((totalSent / 1000) * 100));

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
            <p style="font-size: 0.88rem; color: #d1fae5; margin: 0; line-height: 1.6; max-width: 680px;">
              متابعة مباشرة لمن رد ومن لم يرد من الطلاب وأولياء الأمور، مع سجل تفصيلي للرسائل، وحاسبة أرباح اشتراك المدرس بالأسعار الرسمية وباقة Meta المجانية (1,000 رسالة).
            </p>
          </div>

          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
            <button class="btn" onclick="window.centrlyApp.loadWhatsAppInboxData()" style="background: rgba(255, 255, 255, 0.18); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.3); font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.15rem; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              ${getIcon('refresh', 16, '#ffffff')}
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 1rem; flex-wrap: wrap;">
          <button type="button" id="tabBtnInbox" onclick="window.centrlyApp.switchWhatsAppTab('inbox')" style="padding: 0.55rem 1.25rem; border-radius: 8px; font-weight: 800; font-size: 0.9rem; border: none; cursor: pointer; transition: all 0.2s; ${activeTab === 'inbox' ? 'background: #ffffff; color: #065f46; box-shadow: 0 4px 10px rgba(0,0,0,0.1);' : 'background: rgba(255,255,255,0.1); color: #ffffff;'}">
            محادثات الطلاب وتتبع الردود (${totalSent})
          </button>
          <button type="button" id="tabBtnLogs" onclick="window.centrlyApp.switchWhatsAppTab('logs')" style="padding: 0.55rem 1.25rem; border-radius: 8px; font-weight: 800; font-size: 0.9rem; border: none; cursor: pointer; transition: all 0.2s; ${activeTab === 'logs' ? 'background: #ffffff; color: #065f46; box-shadow: 0 4px 10px rgba(0,0,0,0.1);' : 'background: rgba(255,255,255,0.1); color: #ffffff;'}">
            سجل الرسائل وحالة التسليم (${totalSent})
          </button>
          <button type="button" id="tabBtnCalc" onclick="window.centrlyApp.switchWhatsAppTab('calculator')" style="padding: 0.55rem 1.25rem; border-radius: 8px; font-weight: 800; font-size: 0.9rem; border: none; cursor: pointer; transition: all 0.2s; ${activeTab === 'calculator' ? 'background: #ffffff; color: #065f46; box-shadow: 0 4px 10px rgba(0,0,0,0.1);' : 'background: rgba(255,255,255,0.1); color: #ffffff;'}">
            حاسبة أرباحي من باقات المدرسين و Meta
          </button>
        </div>
      </div>

      <!-- Live Meta Cloud API Pulse & Free Tier Meter -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1.5px solid #bbf7d0; border-radius: 14px; padding: 1.25rem 1.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #ecfdf5; display: flex; align-items: center; justify-content: center; color: #16a34a;">
              ${getIcon('whatsapp', 24, '#16a34a')}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">
                  ربط Meta الرسمي ورصيد الواتساب المجاني (Meta Cloud API)
                </h3>
                <span class="badge" style="background: #dcfce7; color: #166534; font-weight: 800; font-size: 0.75rem;">
                  متصل ومفعل 🟢
                </span>
              </div>
              <p style="margin: 0.25rem 0 0; font-size: 0.825rem; color: #64748b;">
                تمنح شركة Meta كل حساب <strong>1,000 محادثة مجانية شهرياً</strong> — التكلفة الفعلية تبدأ فقط بعد استهلاك الـ 1,000 رسالة.
              </p>
            </div>
          </div>

          <div style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
            <div style="text-align: center;">
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">المستهلك هذا الشهر</div>
              <div style="font-size: 1.3rem; font-weight: 900; color: #0f172a; font-family: monospace;">${totalSent} <span style="font-size: 0.8rem; font-family: 'Cairo';">رسالة</span></div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.75rem; color: #16a34a; font-weight: 800;">المتبقي المجاني من Meta</div>
              <div style="font-size: 1.3rem; font-weight: 900; color: #16a34a; font-family: monospace;">${metaFreeRemaining} <span style="font-size: 0.8rem; font-family: 'Cairo';">رسالة مجانية</span></div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.75rem; color: #0284c7; font-weight: 700;">تكلفة Meta الحالية</div>
              <div style="font-size: 1.3rem; font-weight: 900; color: #0284c7; font-family: monospace;">0.00 ج.م</div>
            </div>
          </div>
        </div>

        <!-- Meta Progress Bar -->
        <div style="margin-top: 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; margin-bottom: 0.35rem; font-weight: 700;">
            <span>استهلاك باقة الـ 1,000 رسالة المجانية من Meta لشهر ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</span>
            <span>${metaUsedPercent}% مستهلك (${totalSent} / 1,000)</span>
          </div>
          <div style="height: 8px; width: 100%; background: #e2e8f0; border-radius: 9999px; overflow: hidden;">
            <div style="height: 100%; width: ${metaUsedPercent}%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 9999px;"></div>
          </div>
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
                حاسبة أرباحي الصافية كصاحب منصة (من باقات المدرسين الرسمية وباقة Meta المجانية)
              </div>
              <div style="font-size: 0.88rem; color: #15803d; line-height: 1.8;">
                • <strong>باقات سنترلي الرسمية:</strong> باقة 300 طالب (<strong>499 ج.م</strong>) — باقة 750 طالب (<strong>899 ج.م</strong>) — باقة 1500 طالب (<strong>1,399 ج.م</strong>).<br>
                • <strong>الخصم السنوي:</strong> الاشتراك السنوي يتمتع بـ <strong>خصم 20%</strong>، مما يضمن لك كاش فوري مقدماً عن سنة كاملة.<br>
                • <strong>حسبة Meta الذكية (1,000 رسالة فري شهرياً):</strong> تمنح شركة Meta كل حساب 1,000 محادثة مجاناً كل شهر. رسائل تفعيل الطلاب تُرسل <strong>لمرة واحدة فقط</strong> عند انضمام الطالب، وتكون مغطاة بالكامل <strong>(0.00 ج.م)</strong> طالما لم تتجاوز الـ 1,000 رسالة!<br>
                • <strong>الشهور القادمة (Recurring Months):</strong> يدفع المدرس اشتراكه، بينما تكلفة رسائل الواتساب = <strong>0.00 ج.م دائماً</strong> لأن الروابط أُرسلت ولا تُعاد، فيكون <strong>ربحك الصافي 100%</strong>!
              </div>
            </div>
          </div>
        </div>

        <!-- Official Plans Selection Cards -->
        <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.5rem;">
                <span>${getIcon('billing', 20, 'var(--centrly-blue-700)')}</span>
                <span>اختر باقة المدرس الرسمية في سنترلي للحساب والمقارنة</span>
              </h3>
              <p style="margin: 0.25rem 0 0; font-size: 0.825rem; color: #64748b;">
                اضغط على أي باقة لاختيارها وتطبيق بياناتها فوراً في الحسبة الذكية
              </p>
            </div>

            <!-- Billing Cycle Switch (Monthly vs Yearly 20% OFF) -->
            <div style="display: inline-flex; background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1px solid #e2e8f0;">
              <button type="button" id="btnCycleMonthly" onclick="window.centrlyApp.setWhatsAppBillingCycle('monthly')" style="border: none; padding: 0.45rem 1rem; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; background: #0f172a; color: #ffffff; transition: all 0.2s;">
                اشتراك شهري
              </button>
              <button type="button" id="btnCycleYearly" onclick="window.centrlyApp.setWhatsAppBillingCycle('yearly')" style="border: none; padding: 0.45rem 1rem; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; background: transparent; color: #475569; display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.2s;">
                <span>اشتراك سنوي</span>
                <span style="background: #10b981; color: #ffffff; font-size: 0.7rem; padding: 1px 6px; border-radius: 9999px; font-weight: 900;">خصم 20%</span>
              </button>
            </div>
          </div>

          <!-- 3 Official Plans Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
            
            <!-- Plan 1: 300 Students (Starter) -->
            <div id="planCard300" onclick="window.centrlyApp.selectWhatsAppPlan('plan_300')" class="plan-card" style="border: 2px solid #3b82f6; background: #eff6ff; border-radius: 12px; padding: 1.25rem; cursor: pointer; position: relative; transition: all 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h4 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #1e3a8a;">باقة 300 طالب</h4>
                  <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">للبدايات والمجموعات التأسيسية</div>
                </div>
                <span class="badge" style="background: #dbeafe; color: #1d4ed8; font-size: 0.72rem; font-weight: 800;">سعة 300 طالب</span>
              </div>
              <div style="margin: 1rem 0 0.5rem;">
                <div id="planPrice300" style="font-size: 1.75rem; font-weight: 900; color: #1e40af; font-family: monospace;">499 <span style="font-size: 0.85rem; font-family: 'Cairo';">ج.م / شهرياً</span></div>
                <div id="planSubtext300" style="font-size: 0.75rem; color: #64748b;">أو 4,790 ج.م سنوياً (وفر 1,198 ج.م)</div>
              </div>
              <div style="font-size: 0.75rem; color: #16a34a; font-weight: 700; border-top: 1px dashed #bfdbfe; padding-top: 0.6rem; margin-top: 0.6rem;">
                ✓ رسائل تفعيل الـ 300 طالب مجانية 100% من Meta
              </div>
            </div>

            <!-- Plan 2: 750 Students (Growth - Most Popular) -->
            <div id="planCard750" onclick="window.centrlyApp.selectWhatsAppPlan('plan_750')" class="plan-card" style="border: 1.5px solid #cbd5e1; background: #ffffff; border-radius: 12px; padding: 1.25rem; cursor: pointer; position: relative; transition: all 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <h4 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #0f172a;">باقة 750 طالب</h4>
                    <span class="badge" style="background: #fef08a; color: #854d0e; font-size: 0.65rem; font-weight: 900;">الأكثر طلباً ⭐</span>
                  </div>
                  <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">مثالية للمعلم النشط والمجموعات الكبيرة</div>
                </div>
                <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.72rem; font-weight: 800;">سعة 750 طالب</span>
              </div>
              <div style="margin: 1rem 0 0.5rem;">
                <div id="planPrice750" style="font-size: 1.75rem; font-weight: 900; color: #0f172a; font-family: monospace;">899 <span style="font-size: 0.85rem; font-family: 'Cairo';">ج.م / شهرياً</span></div>
                <div id="planSubtext750" style="font-size: 0.75rem; color: #64748b;">أو 8,630 ج.م سنوياً (وفر 2,158 ج.م)</div>
              </div>
              <div style="font-size: 0.75rem; color: #16a34a; font-weight: 700; border-top: 1px dashed #e2e8f0; padding-top: 0.6rem; margin-top: 0.6rem;">
                ✓ رسائل تفعيل الـ 750 طالب مجانية 100% من Meta
              </div>
            </div>

            <!-- Plan 3: 1500 Students (Pro) -->
            <div id="planCard1500" onclick="window.centrlyApp.selectWhatsAppPlan('plan_1500')" class="plan-card" style="border: 1.5px solid #cbd5e1; background: #ffffff; border-radius: 12px; padding: 1.25rem; cursor: pointer; position: relative; transition: all 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h4 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #0f172a;">باقة 1500 طالب</h4>
                  <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">للسناتر وكبار المدرسين والمجاميع الضخمة</div>
                </div>
                <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.72rem; font-weight: 800;">سعة 1500 طالب</span>
              </div>
              <div style="margin: 1rem 0 0.5rem;">
                <div id="planPrice1500" style="font-size: 1.75rem; font-weight: 900; color: #0f172a; font-family: monospace;">1,399 <span style="font-size: 0.85rem; font-family: 'Cairo';">ج.م / شهرياً</span></div>
                <div id="planSubtext1500" style="font-size: 0.75rem; color: #64748b;">أو 13,430 ج.م سنوياً (وفر 3,358 ج.م)</div>
              </div>
              <div style="font-size: 0.75rem; color: #0284c7; font-weight: 700; border-top: 1px dashed #e2e8f0; padding-top: 0.6rem; margin-top: 0.6rem;">
                ✓ أول 1,000 طالب مجاناً، والـ 500 الباقين بـ 400 ج.م فقط
              </div>
            </div>

          </div>
        </div>

        <!-- Interactive Calculator Inputs -->
        <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px;">
          <h3 style="margin: 0 0 1.25rem 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.5rem;">
            <span>${getIcon('chart', 20, 'var(--centrly-blue-700)')}</span>
            <span>مدخلات حسبة اشتراك المدرس والواتساب (قابلة للتعديل)</span>
          </h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
            
            <!-- 1. Subscription Fee Input -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 800; font-size: 0.85rem; color: #334155;" id="lblTeacherFee">
                قيمة اشتراك المدرس المحصلة (ج.م)
              </label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="number" id="calcTeacherFee" class="form-input" min="50" max="50000" value="499" oninput="window.centrlyApp.recalculateWhatsAppEconomics()" style="font-weight: 800; font-size: 1.15rem; padding: 0.65rem 0.85rem; padding-left: 3rem;">
                <span style="position: absolute; left: 0.75rem; font-weight: 800; color: #64748b; font-size: 0.85rem;">ج.م</span>
              </div>
              <div style="display: flex; gap: 0.35rem; margin-top: 0.4rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.selectWhatsAppPlan('plan_300')" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; background: #dbeafe; color: #1e40af; font-weight: 800;">باقة 300 (499 ج.م)</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.selectWhatsAppPlan('plan_750')" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; background: #f1f5f9;">باقة 750 (899 ج.م)</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.selectWhatsAppPlan('plan_1500')" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; background: #f1f5f9;">باقة 1500 (1,399 ج.م)</button>
              </div>
            </div>

            <!-- 2. Students Count Input -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 800; font-size: 0.85rem; color: #334155;">
                عدد طلاب هذا المدرس (المراد تفعيلهم بروابط المنصة)
              </label>
              <input type="number" id="calcTeacherStudents" class="form-input" min="1" max="10000" value="300" oninput="window.centrlyApp.recalculateWhatsAppEconomics()" style="font-weight: 800; font-size: 1.15rem; padding: 0.65rem 0.85rem;">
              <div style="display: flex; gap: 0.35rem; margin-top: 0.4rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(${currentActualStudents})" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; background: #fef08a; color: #854d0e; font-weight: 900;" title="عدد الطلاب الفعليين المسجلين في حسابك الحالي">
                  الطلاب الفعليين (${currentActualStudents} طالب)
                </button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(300)" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; background: #f1f5f9;">300 طالب</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(750)" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; background: #f1f5f9;">750 طالب</button>
                <button type="button" class="btn btn-sm" onclick="window.centrlyApp.setCalcStudents(1500)" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; background: #f1f5f9;">1500 طالب</button>
              </div>
            </div>

            <!-- 3. Meta Free Tier & Unit Cost -->
            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-weight: 800; font-size: 0.85rem; color: #334155;">
                حسبة Meta لرسائل الواتساب
              </label>
              
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.55rem 0.75rem; margin-bottom: 0.4rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.825rem; font-weight: 800; color: #166534; cursor: pointer; margin: 0;">
                  <input type="checkbox" id="calcMetaFreeTier" checked onchange="window.centrlyApp.toggleMetaFreeTier(this.checked)" style="width: 17px; height: 17px; accent-color: #16a34a;">
                  <span>تطبيق شريحة Meta المجانية (أول 1,000 رسالة شهرياً مجاناً)</span>
                </label>
              </div>

              <div style="position: relative; display: flex; align-items: center;">
                <input type="number" id="calcMsgUnitCost" class="form-input" min="0" max="10" step="0.05" value="0.80" oninput="window.centrlyApp.recalculateWhatsAppEconomics()" style="font-weight: 800; font-size: 0.95rem; padding: 0.5rem 0.85rem; padding-left: 3rem;">
                <span style="position: absolute; left: 0.75rem; font-weight: 800; color: #64748b; font-size: 0.75rem;">ج.م / رسالة زائدة</span>
              </div>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.25rem;">
                تُحسب هذه التكلفة فقط على الرسائل التي تتعدى الـ 1,000 رسالة المجانية من Meta
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

            <div style="font-size: 0.85rem; color: #64748b;">إيراد اشتراك المدرس المحصل:</div>
            <div id="calcMonth1Revenue" style="font-size: 1.85rem; font-weight: 900; color: #0f172a; font-family: monospace; margin-top: 0.15rem;">
              499 ج.م
            </div>

            <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.825rem;">
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>رسائل تفعيل الطلاب:</span>
                <strong id="calcMonth1Msgs" style="font-family: monospace; color: #0f172a;">300 رسالة</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #16a34a; font-weight: 700;">
                <span>تغطية باقة Meta المجانية:</span>
                <strong id="calcMonth1FreeCoverage" style="color: #16a34a;">300 رسالة مجانية (100%)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>تكلفة Meta الفعلية المستحقة:</span>
                <strong id="calcMonth1Cost" style="font-family: monospace; color: #16a34a;">0.00 ج.م</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #0f172a; font-weight: 900; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed #e2e8f0;">
                <span>صافي ربحك في الشهر الأول:</span>
                <span id="calcMonth1Net" style="color: #047857; font-size: 1.25rem; font-family: monospace;">499 ج.م (100%)</span>
              </div>
            </div>
          </div>

          <!-- Month 2+: Recurring Months -->
          <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; box-shadow: 0 6px 20px rgba(22, 163, 74, 0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
              <span class="badge" style="background: #16a34a; color: #ffffff; font-weight: 800; font-size: 0.8rem; padding: 0.3rem 0.6rem;">الشهور القادمة (أرباح مستمرة متكررة)</span>
              <span style="font-size: 0.75rem; color: #15803d; font-weight: 700;">تتكرر شهرياً</span>
            </div>

            <div style="font-size: 0.85rem; color: #166534;" id="lblMonth2Title">صافي ربحك الشهري المستمر:</div>
            <div id="calcMonth2Net" style="font-size: 2.1rem; font-weight: 900; color: #15803d; font-family: monospace; margin-top: 0.15rem;">
              499 ج.م
            </div>

            <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid rgba(22, 163, 74, 0.2); display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.825rem;">
              <div style="display: flex; justify-content: space-between; color: #166534;">
                <span>تكلفة رسائل الواتساب لطلابه:</span>
                <strong style="color: #15803d; font-size: 0.95rem;">0.00 ج.م (صفر تكلفة)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #15803d;">
                <span>السبب:</span>
                <span>الروابط أُرسلت مرة واحدة في أول شهر ولن تُعاد</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #14532d; font-weight: 900; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed rgba(22, 163, 74, 0.3);">
                <span>نسبة الربح الصافي:</span>
                <span style="font-size: 1.15rem; color: #15803d; font-weight: 900;">100% ربح صافي كامل</span>
              </div>
            </div>
          </div>

          <!-- Annual Summary Card -->
          <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px; background: #ffffff; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
              <span class="badge" style="background: #0284c7; color: #ffffff; font-weight: 800; font-size: 0.8rem; padding: 0.3rem 0.6rem;">إجمالي السنة الأولى من المدرس</span>
              <span style="font-size: 0.75rem; color: #64748b;" id="lblYearBasis">12 شهر اشتراك</span>
            </div>

            <div style="font-size: 0.85rem; color: #64748b;">صافي ربحي السنوي من هذا المدرس:</div>
            <div id="calcYearNet" style="font-size: 1.85rem; font-weight: 900; color: #0284c7; font-family: monospace; margin-top: 0.15rem;">
              5,988 ج.م
            </div>

            <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.825rem;">
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>إجمالي الاشتراكات المحصلة:</span>
                <strong id="calcYearRevenue" style="font-family: monospace; color: #0f172a;">5,988 ج.م</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>إجمالي تكلفة Meta للرسائل طوال العام:</span>
                <strong id="calcYearCost" style="font-family: monospace; color: #16a34a;">0.00 ج.م (تُدفع لمرة واحدة)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #0284c7; font-weight: 900; margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed #e2e8f0;">
                <span>هامش الربح السنوي الصافي:</span>
                <span id="calcYearMargin" style="color: #0284c7; font-size: 1.15rem; font-family: monospace;">100.0%</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Scale Radar Card -->
        <div class="card" style="margin: 0; padding: 1.5rem; border-radius: 14px;">
          <h4 style="margin: 0 0 1rem 0; font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink);">
            رادار التوسع: أرباحي المتوقعة عند اشتراك عدة مدرسين بنفس الباقة (<span id="calcRadarFeeLabel">499</span> ج.م/مدرس)
          </h4>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.8rem; color: #64748b; font-weight: 700;">عند اشتراك 10 مدرسين</div>
              <div id="radar10" style="font-size: 1.4rem; font-weight: 900; color: #0f172a; margin: 0.35rem 0; font-family: monospace;">4,990 ج.م</div>
              <div id="radar10Sub" style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">شهرياً بدون مصاريف رسائل</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.8rem; color: #64748b; font-weight: 700;">عند اشتراك 25 مدرس</div>
              <div id="radar25" style="font-size: 1.4rem; font-weight: 900; color: #0284c7; margin: 0.35rem 0; font-family: monospace;">12,475 ج.م</div>
              <div id="radar25Sub" style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">شهرياً بدون مصاريف رسائل</div>
            </div>

            <div style="background: #f8fafc; border: 1.5px solid #bbf7d0; background: #f0fdf4; border-radius: 10px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.8rem; color: #166534; font-weight: 700;">عند اشتراك 50 مدرس</div>
              <div id="radar50" style="font-size: 1.4rem; font-weight: 900; color: #15803d; margin: 0.35rem 0; font-family: monospace;">24,950 ج.م</div>
              <div id="radar50Sub" style="font-size: 0.75rem; color: #15803d; font-weight: 800;">شهرياً بدون مصاريف رسائل</div>
            </div>

            <div style="background: #f8fafc; border: 1.5px solid #fed7aa; background: #fff7ed; border-radius: 10px; padding: 1rem; text-align: center;">
              <div style="font-size: 0.8rem; color: #9a3412; font-weight: 700;">عند اشتراك 100 مدرس</div>
              <div id="radar100" style="font-size: 1.4rem; font-weight: 900; color: #ea580c; margin: 0.35rem 0; font-family: monospace;">49,900 ج.م</div>
              <div id="radar100Sub" style="font-size: 0.75rem; color: #c2410c; font-weight: 800;">شهرياً بدون مصاريف رسائل</div>
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
          
          <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 240px;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: ${isReplied ? '#dcfce7' : '#f1f5f9'}; display: flex; align-items: center; justify-content: center; color: ${isReplied ? '#15803d' : '#64748b'}; flex-shrink: 0;">
              ${getIcon('whatsapp', 22, isReplied ? '#15803d' : '#64748b')}
            </div>

            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #0f172a;">
                  ${escapeHtml(studentName)}
                </h4>
                <span class="badge" style="font-size: 0.72rem; padding: 0.15rem 0.5rem; ${isReplied ? 'background: #dcfce7; color: #166534;' : 'background: #f1f5f9; color: #475569;'}">
                  ${isReplied ? 'وصل رد 💬' : 'في انتظار الرد ⏳'}
                </span>
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; font-family: monospace;" dir="ltr">
                ${escapeHtml(displayPhone)}
              </div>
            </div>
          </div>

          <div style="flex: 2; min-width: 260px; max-width: 480px;">
            <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.2rem;">
              آخر رسالة / رد (${escapeHtml(msgTime)}):
            </div>
            <div style="font-size: 0.85rem; color: #334155; line-height: 1.5; background: #f8fafc; padding: 0.45rem 0.75rem; border-radius: 8px; border: 1px solid #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(lastMsgBody)}
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-sm" onclick="window.centrlyApp.openWhatsAppChatWindow('${escapeHtml(cleanPhone)}', '${escapeHtml(studentName)}')" style="background: #25D366; color: #ffffff; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.45rem 0.85rem; border-radius: 8px; border: none; font-size: 0.8rem; box-shadow: 0 2px 6px rgba(37, 211, 102, 0.2);">
              ${getIcon('whatsapp', 14, '#ffffff')}
              <span>شات واتساب</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.showWhatsAppMessageHistory('${escapeHtml(cleanPhone)}')" style="padding: 0.45rem 0.75rem; font-size: 0.8rem; font-weight: 700; border-radius: 8px;">
              التفاصيل
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
