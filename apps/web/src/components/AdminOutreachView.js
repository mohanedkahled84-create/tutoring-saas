import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Centrly Superadmin - Outreach & Cold WhatsApp Campaign HQ
 * Provides full funnel metrics, A/B testing insights, and direct WhatsApp lead conversion.
 */

export function renderAdminOutreachView(data = {}, currentFilter = 'all', searchQuery = '') {
  const leads = data.leads || [];
  const metrics = data.metrics || {
    total: 606,
    ready: 606,
    sent: 0,
    replied: 0,
    interested: 0,
    converted: 0,
    not_interested: 0
  };

  const filter = currentFilter || 'all';
  const query = (searchQuery || '').toLowerCase().trim();

  // Filter leads based on selected tab and search query
  const filteredLeads = leads.filter(lead => {
    const status = lead['حالة التواصل'] || 'جاهز للإرسال';
    if (filter === 'interested' && status !== 'عميل محتمل (مهتم)') return false;
    if (filter === 'replied' && status !== 'تم الرد') return false;
    if (filter === 'sent' && status !== 'تم الإرسال') return false;
    if (filter === 'converted' && status !== 'أصبح عميل (مشترك)') return false;
    if (filter === 'ready' && status !== 'جاهز للإرسال') return false;

    if (query) {
      const name = String(lead['الاسم'] || '').toLowerCase();
      const phone = String(lead['رقم الهاتف'] || lead['الرقم الدولي (واتساب)'] || '').toLowerCase();
      const note = String(lead['ملاحظات المحادثة'] || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || note.includes(query);
    }
    return true;
  });

  const responseRate = metrics.sent > 0 ? Math.round((metrics.replied / metrics.sent) * 100) : 0;
  const interestRate = metrics.replied > 0 ? Math.round((metrics.interested / metrics.replied) * 100) : 0;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      
      <!-- Top Action Bar -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #0f172a, #164e63); color: #fff; border: 1px solid #1e293b; border-radius: 16px; padding: 1.5rem; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.4);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
              <span style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px; background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.4);">
                ${getIcon('whatsapp', 24, '#22c55e')}
              </span>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 900; color: #fff; letter-spacing: -0.02em;">
                رادار حملات التواصل واستقطاب المدرسين (Outreach Engine)
              </h2>
              <span class="badge" style="background: #22c55e; color: #064e3b; font-weight: 800; padding: 0.3rem 0.75rem; border-radius: 9999px; font-size: 0.75rem;">
                واتساب لايف: متصل
              </span>
            </div>
            <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 0.45rem; line-height: 1.6; max-width: 850px;">
              متابعة مباشرة لنتائج الأوتوميشن، رصد المدرسين المهتمين، معدل الاستجابة وتحويل العملاء، مع إمكانية التحدث بنقرة زر واحدة.
            </p>
          </div>

          <div style="display: flex; gap: 0.65rem; flex-wrap: wrap; align-items: center;">
            <a href="https://mohaned1.rooyai.com/workflow/aCfRQrMyMDDhqxU3" target="_blank" class="btn btn-secondary btn-sm" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('gear', 14)}
              لوحة تحكم n8n
            </a>
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.refreshOutreachData()" style="background: #22c55e; border-color: #22c55e; color: #052e16; display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800;">
              ${getIcon('refresh', 14, '#052e16')}
              تحديث البيانات الحية
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Funnel Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
        
        <!-- Total Target Leads -->
        <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">إجمالي المستهدفين</span>
            <span style="color: #64748b;">${getIcon('students', 18)}</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 900; color: #0f172a;">${metrics.total}</div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">مدرس فيزياء معتمد</div>
        </div>

        <!-- Sent Outreach -->
        <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #2563eb;">الرسائل المرسلة</span>
            <span style="color: #2563eb;">${getIcon('send', 18)}</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 900; color: #1e40af;">${metrics.sent}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">بفاصل 10 دقائق مع كتابة</div>
        </div>

        <!-- Replied -->
        <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: #0891b2;">تم الرد</span>
            <span style="color: #0891b2;">${getIcon('reports', 18)}</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 900; color: #0e7490;">${metrics.replied}</div>
          <div style="font-size: 0.75rem; color: #0891b2; font-weight: 700; margin-top: 0.25rem;">نسبة الرد: ${responseRate}%</div>
        </div>

        <!-- Hot Interested Leads -->
        <div class="card" style="margin: 0; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.85rem; font-weight: 800; color: #166534;">عملاء مهتمين</span>
            <span style="color: #16a34a;">${getIcon('check', 18)}</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 900; color: #15803d;">${metrics.interested}</div>
          <div style="font-size: 0.75rem; color: #166534; font-weight: 700; margin-top: 0.25rem;">طلبوا التفاصيل والفيديو</div>
        </div>

        <!-- Converted / Subscribed -->
        <div class="card" style="margin: 0; background: #faf5ff; border: 1.5px solid #d8b4fe; border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.85rem; font-weight: 800; color: #6b21a8;">أصبحوا عملاء (مشتركين)</span>
            <span style="color: #9333ea;">${getIcon('billing', 18)}</span>
          </div>
          <div style="font-size: 1.75rem; font-weight: 900; color: #7e22ce;">${metrics.converted}</div>
          <div style="font-size: 0.75rem; color: #7e22ce; font-weight: 700; margin-top: 0.25rem;">تم إغلاق البيع بنجاح</div>
        </div>

      </div>

      <!-- Quick Action Tabs & Search Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: #ffffff; padding: 1rem; border-radius: 12px; border: 1px solid #e2e8f0;">
        
        <!-- Status Tabs -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="window.centrlyApp.setOutreachFilter('all')" class="btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}" style="font-weight: 700;">
            الكل (${leads.length || metrics.total})
          </button>
          <button onclick="window.centrlyApp.setOutreachFilter('interested')" class="btn btn-sm ${filter === 'interested' ? 'btn-primary' : 'btn-secondary'}" style="background: ${filter === 'interested' ? '#16a34a' : ''}; font-weight: 800;">
            عملاء مهتمين (${metrics.interested})
          </button>
          <button onclick="window.centrlyApp.setOutreachFilter('replied')" class="btn btn-sm ${filter === 'replied' ? 'btn-primary' : 'btn-secondary'}" style="font-weight: 700;">
            تم الرد (${metrics.replied})
          </button>
          <button onclick="window.centrlyApp.setOutreachFilter('sent')" class="btn btn-sm ${filter === 'sent' ? 'btn-primary' : 'btn-secondary'}" style="font-weight: 700;">
            تم الإرسال (${metrics.sent})
          </button>
          <button onclick="window.centrlyApp.setOutreachFilter('converted')" class="btn btn-sm ${filter === 'converted' ? 'btn-primary' : 'btn-secondary'}" style="font-weight: 700;">
            مشتركين (${metrics.converted})
          </button>
          <button onclick="window.centrlyApp.setOutreachFilter('ready')" class="btn btn-sm ${filter === 'ready' ? 'btn-primary' : 'btn-secondary'}" style="font-weight: 700;">
            في الانتظار (${metrics.ready})
          </button>
        </div>

        <!-- Search Input -->
        <div style="position: relative; min-width: 260px;">
          <input 
            type="text" 
            placeholder="بحث بالاسم أو الهاتف أو الرد..." 
            value="${escapeHtml(query)}"
            oninput="window.centrlyApp.handleOutreachSearch(this.value)"
            class="form-control"
            style="padding-right: 2rem; border-radius: 8px; font-size: 0.85rem;"
          />
          <span style="position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); color: #94a3b8;">
            ${getIcon('search', 16)}
          </span>
        </div>

      </div>

      <!-- Actionable Leads Table -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; padding: 0;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">
            قائمة المدرسين والمحادثات الحية (${filteredLeads.length})
          </h3>
          <span style="font-size: 0.8rem; color: #64748b;">
            يتم التحديث تلقائياً من سيناريو n8n
          </span>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.9rem;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 800;">
                <th style="padding: 0.85rem 1.25rem;">#</th>
                <th style="padding: 0.85rem 1.25rem;">اسم المدرس</th>
                <th style="padding: 0.85rem 1.25rem;">رقم الهاتف</th>
                <th style="padding: 0.85rem 1.25rem;">الحالة الحالية</th>
                <th style="padding: 0.85rem 1.25rem;">القالب (A/B)</th>
                <th style="padding: 0.85rem 1.25rem;">آخر ملاحظة / رد</th>
                <th style="padding: 0.85rem 1.25rem; text-align: center;">إجراء سريع</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLeads.length === 0 ? `
                <tr>
                  <td colspan="7" style="padding: 3rem; text-align: center; color: #94a3b8;">
                    ${getIcon('search', 32, '#cbd5e1')}
                    <div style="margin-top: 0.5rem; font-size: 1rem; font-weight: 700;">لا توجد سجلات مطابقة لهذا الفلتر</div>
                  </td>
                </tr>
              ` : filteredLeads.slice(0, 50).map((item, idx) => {
                const name = item['الاسم'] || 'بدون اسم (يا مستر)';
                const phone = item['الرقم الدولي (واتساب)'] || item['رقم الهاتف'] || '';
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                const status = item['حالة التواصل'] || 'جاهز للإرسال';
                const template = item['القالب المرسل (A/B Test)'] || 'Template A';
                const note = item['ملاحظات المحادثة'] || '-';

                let statusBadgeStyle = 'background: #f1f5f9; color: #475569;';
                if (status === 'عميل محتمل (مهتم)') statusBadgeStyle = 'background: #dcfce7; color: #166534; font-weight: 800; border: 1px solid #86efac;';
                else if (status === 'تم الرد') statusBadgeStyle = 'background: #e0f2fe; color: #075985; font-weight: 700;';
                else if (status === 'تم الإرسال') statusBadgeStyle = 'background: #eff6ff; color: #1e40af;';
                else if (status === 'أصبح عميل (مشترك)') statusBadgeStyle = 'background: #f3e8ff; color: #6b21a8; font-weight: 900;';
                else if (status === 'غير مهتم') statusBadgeStyle = 'background: #fee2e2; color: #991b1b;';

                return `
                  <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 1rem 1.25rem; color: #94a3b8; font-size: 0.8rem;">${idx + 1}</td>
                    <td style="padding: 1rem 1.25rem; font-weight: 800; color: #0f172a;">
                      ${escapeHtml(name)}
                    </td>
                    <td style="padding: 1rem 1.25rem; font-family: monospace; direction: ltr; text-align: right; color: #334155;">
                      +${escapeHtml(cleanPhone)}
                    </td>
                    <td style="padding: 1rem 1.25rem;">
                      <span class="badge" style="padding: 0.35rem 0.65rem; border-radius: 6px; font-size: 0.78rem; ${statusBadgeStyle}">
                        ${escapeHtml(status)}
                      </span>
                    </td>
                    <td style="padding: 1rem 1.25rem; font-size: 0.8rem; color: #64748b;">
                      ${escapeHtml(template.split(' ')[0] || template)}
                    </td>
                    <td style="padding: 1rem 1.25rem; font-size: 0.8rem; color: #475569; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(note)}">
                      ${escapeHtml(note)}
                    </td>
                    <td style="padding: 1rem 1.25rem; text-align: center;">
                      ${cleanPhone ? `
                        <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn btn-sm" style="background: #22c55e; color: #fff; padding: 0.35rem 0.75rem; border-radius: 6px; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem;">
                          ${getIcon('whatsapp', 14, '#fff')}
                          محادثة واتساب
                        </a>
                      ` : '-'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${filteredLeads.length > 50 ? `
          <div style="padding: 0.85rem; text-align: center; background: #f8fafc; color: #64748b; font-size: 0.85rem; border-top: 1px solid #f1f5f9;">
            يتم عرض أول 50 سجل من أصل ${filteredLeads.length} سجلاً. استخدم خانة البحث بالأعلى للوصول لأي مدرس مباشرة.
          </div>
        ` : ''}
      </div>

    </div>
  `;
}
