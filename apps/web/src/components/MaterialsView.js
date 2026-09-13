import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Teacher Study Materials & Homework Component
 * Allows teachers to upload/link:
 * - Study notes (PDFs)
 * - Video explanations (YouTube/Drive)
 * - External links
 * - Assign as homework with due dates
 * - Target specific groups or all groups
 */

export function renderMaterialsView(materials = [], groups = [], selectedGroupId = 'all') {
  const materialList = materials || [];

  // Filter if selectedGroupId is provided
  const filtered = selectedGroupId === 'all' 
    ? materialList 
    : materialList.filter(m => !m.group_id || m.group_id === selectedGroupId);

  const totalMaterials = materialList.length;
  const homeworkCount = materialList.filter(m => m.is_homework).length;
  const pdfCount = materialList.filter(m => m.type === 'pdf').length;
  const videoCount = materialList.filter(m => m.type === 'video').length;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title & Action Header -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('materials', 22, 'var(--centrly-blue-700)')}</span>
              <span>المذكرات والماتريال التعليمية (Study Materials)</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              إرفاق المذكرات بصيغة PDF وروابط شروحات الفيديو لتظهر مباشرة للطلاب وأولياء الأمور في بواباتهم.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddMaterialModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800;">
              ${getIcon('add', 16, '#ffffff')}
              <span>إضافة مذكرة / رابط شرح جديد</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.navigateTo('homework')" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('homework', 16, 'var(--centrly-blue-700)')}
              <span>الواجبات المنزلية (قسم منفصل)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الملفات والمذكرات</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${totalMaterials} <span style="font-size: 0.85rem; font-weight: 500;">ملف</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            مذكرات وشروحات مفعلة للطلاب
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #059669;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">مذكرات وملازم PDF</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #047857; margin-top: 0.35rem;">
            ${pdfCount} <span style="font-size: 0.85rem; font-weight: 500;">مذكرة</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            جاهزة للعرض والتحميل المباشر
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نوعية المحتوى</div>
          <div style="font-size: 1rem; font-weight: 800; color: var(--centrly-ink); margin-top: 0.5rem; display: flex; gap: 0.85rem; align-items: center;">
            <span style="display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('file', 14, '#1d4ed8')} ${pdfCount} PDF</span>
            <span style="display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('video', 14, '#b45309')} ${videoCount} فيديو</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            موزعة على كافة المجاميع
          </div>
        </div>
      </div>

      <!-- Filters & Materials Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
            ${getIcon('materials', 18, 'var(--centrly-blue-700)')}
            <span>قائمة المذكرات والشروحات التعليمية (${filtered.length})</span>
          </h3>

          <!-- Group Filter Dropdown -->
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.85rem; font-weight: 700; color: #475569;">تصفية بالمجموعة:</label>
            <select class="form-control" style="padding: 0.35rem 0.75rem; font-size: 0.85rem; border-radius: 0.5rem; min-width: 160px;"
              onchange="window.centrlyApp.filterMaterialsByGroup(this.value)">
              <option value="all" ${selectedGroupId === 'all' ? 'selected' : ''}>جميع المجموعات</option>
              ${groups.map(g => `
                <option value="${g.id}" ${selectedGroupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>عنوان المذكرة / الواجب</th>
                <th>المجموعة المستهدفة</th>
                <th>نوع الملف</th>
                <th>واجب منزلي؟</th>
                <th>موعد التسليم</th>
                <th>الرابط المباشر</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length > 0 ? filtered.map(m => {
                const grp = groups.find(g => g.id === m.group_id);
                const groupName = grp ? grp.name : 'جميع المجموعات (عام)';

                const isPdf = m.type === 'pdf';
                const isVideo = m.type === 'video';
                const isTextbook = Boolean(m.book_name || m.pages || m.questions);
                const hasUrl = Boolean(m.url && m.url !== '#' && m.url.trim().length > 0);
                const typeBadge = isTextbook
                  ? `<span class="badge badge-amber" style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('book', 12, 'currentColor')} كتاب / كشكول</span>`
                  : (isPdf 
                    ? `<span class="badge badge-blue" style="display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('file', 12, 'currentColor')} PDF</span>` 
                    : (isVideo ? `<span class="badge badge-amber" style="display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('video', 12, 'currentColor')} فيديو</span>` : `<span class="badge badge-secondary" style="display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('link', 12, 'currentColor')} رابط خارجي</span>`));

                return `
                  <tr>
                    <td style="font-weight: 800; color: #0f172a; max-width: 280px;">
                      <div>${escapeHtml(m.title)}</div>
                      ${isTextbook ? `
                        <div style="font-size: 0.75rem; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; padding: 0.2rem 0.45rem; border-radius: 0.35rem; margin-top: 0.25rem; display: inline-flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;">
                          <span style="display: inline-flex; align-items: center; gap: 0.2rem;">${getIcon('book', 12, '#1e40af')} ${escapeHtml(m.book_name || 'الكتاب')}</span>
                          ${m.pages ? `<span>• ص: ${escapeHtml(m.pages)}</span>` : ''}
                          ${m.questions ? `<span style="color: #b45309; font-weight: 700;">• س: ${escapeHtml(m.questions)}</span>` : ''}
                        </div>
                      ` : ''}
                      ${m.description ? `
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem; font-weight: 400;">
                          ${escapeHtml(m.description)}
                        </div>
                      ` : ''}
                    </td>
                    <td>
                      <span class="badge ${grp ? 'badge-blue' : 'badge-secondary'}">
                        ${escapeHtml(groupName)}
                      </span>
                    </td>
                    <td>
                      ${typeBadge}
                    </td>
                    <td>
                      ${m.is_homework ? `
                        <span class="badge badge-warning" style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.25rem;">
                          ${getIcon('homework', 12, 'currentColor')}
                          <span>نعم (واجب)</span>
                        </span>
                      ` : `
                        <span style="font-size: 0.8rem; color: #94a3b8;">مذكرة عادية</span>
                      `}
                    </td>
                    <td>
                      ${m.is_homework && m.due_date ? `
                        <span style="font-size: 0.85rem; font-weight: 700; color: #b45309; font-family: monospace;">
                          ${escapeHtml(m.due_date)}
                        </span>
                      ` : `
                        <span style="font-size: 0.8rem; color: #94a3b8;">—</span>
                      `}
                    </td>
                    <td>
                      ${hasUrl ? `
                        <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer"
                          style="display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; font-weight: 700; color: #1d4ed8; text-decoration: none; background: #eff6ff; padding: 0.25rem 0.6rem; border-radius: 0.4rem; border: 1px solid #bfdbfe;">
                          ${getIcon('link', 12, '#1d4ed8')}
                          <span>فتح الرابط</span>
                        </a>
                      ` : (m.is_homework ? `
                        <span style="font-size: 0.75rem; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 0.25rem 0.5rem; border-radius: 0.4rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                          ${getIcon('edit', 12, '#047857')}
                          <span>حل في الكشكول</span>
                        </span>
                      ` : `
                        <span style="font-size: 0.8rem; color: #94a3b8;">—</span>
                      `)}
                    </td>
                    <td>
                      <button class="btn btn-sm btn-danger" onclick="window.centrlyApp.deleteMaterial('${m.id}', '${escapeHtml(m.title)}')" title="حذف المذكرة">
                        ${getIcon('delete', 14)}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
                    <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('materials', 36, '#94a3b8')}</div>
                    لا توجد مذكرات أو ملفات تعليمية مسجلة هنا بعد.<br>
                    اضغط على زر <b>"إضافة مذكرة / واجب جديد"</b> لرفع الروابط والمذكرات لطلابك.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
