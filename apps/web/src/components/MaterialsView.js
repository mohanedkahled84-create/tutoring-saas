import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";

/**
 * Centrly Teacher Study Materials & Homework Component
 * Allows teachers to upload/link:
 * - Study notes (PDFs)
 * - Video explanations (YouTube/Drive)
 * - External links
 * - Assign as homework with due dates
 * - Target specific groups or all groups
 */

function resolveSafeMaterialUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (trimmed.includes('/storage/v1/object/sign/homework-submissions/')) {
    return trimmed
      .replace('/storage/v1/object/sign/homework-submissions/', '/storage/v1/object/public/homework-submissions/')
      .split('?')[0];
  }
  return trimmed;
}

export function renderMaterialsView(materials = [], groups = [], selectedGroupId = 'all') {
  const materialList = (materials || []).filter(m => m.type !== 'online_quiz');

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
      
      <!-- Top Title & Action Header (Swiss Minimalist) -->
      <div class="card" style="margin: 0; padding: 0.85rem 1.15rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <h2 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a;">
                المذكرات والماتريال التعليمية
              </h2>
              <span style="font-size: 0.72rem; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                ${totalMaterials} ملف
              </span>
            </div>
            <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #64748b;">
              إرفاق المذكرات بصيغة PDF وروابط الشروحات لتظهر مباشرة للطلاب في بواباتهم
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="window.centrlyApp.navigate('video-lessons')" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
              ${getIcon('video', 16, '#1d4ed8')}
              <span>فيديوهات الشرح والحل</span>
            </button>
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddMaterialModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800;">
              ${getIcon('add', 16, '#ffffff')}
              <span>إضافة مذكرة / رابط شرح جديد</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.openAddHomeworkModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('add', 16, 'var(--centrly-blue-700)')}
              <span>إضافة واجب</span>
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الملفات والمذكرات</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${totalMaterials} <span style="font-size: 0.85rem; font-weight: 500;">ملف</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            مذكرات وشروحات مفعلة للطلاب
          </div>
        </div>

        <div class="card" style="margin: 0; border-top: 4px solid #059669;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">مذكرات وملازم PDF</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #047857; margin-top: 0.35rem;">
            ${pdfCount} <span style="font-size: 0.85rem; font-weight: 500;">مذكرة</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            جاهزة للعرض والتحميل المباشر
          </div>
        </div>

        <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-success);">
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
                const isGatingMeta = m.book_name === 'approved_homework' || m.book_name === 'open' || (typeof m.questions === 'string' && m.questions.trim().startsWith('{'));
                const isTextbook = !isVideo && !isGatingMeta && Boolean(m.book_name || m.pages || m.questions);
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
                      ${isVideo && m.book_name === 'approved_homework' ? `
                        <div style="margin-top: 0.25rem;">
                          <span style="font-size: 0.72rem; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                            ${getIcon('lock', 11, '#92400e')}
                            <span>مشروط باعتماد الواجب</span>
                          </span>
                        </div>
                      ` : ''}
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
                        <a href="${escapeHtml(resolveSafeMaterialUrl(m.url))}" target="_blank" rel="noopener noreferrer"
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

export function registerMaterialsActions(app) {
  app.filterMaterialsByGroup = function(groupId) {
    this.materialsGroupId = groupId;
    this.renderMainContent();
  };

  app.openAddMaterialModal = function() {
    this._selectedMatPdfFile = null;
    this._currentMatPdfSource = 'upload';

    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddMaterialForm" onsubmit="window.centrlyApp.handleAddMaterialSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">عنوان المذكرة أو المحتوى التعليمي *</label>
          <input type="text" id="modalMatTitle" class="form-input" placeholder="عنوان المذكرة أو المحتوى التعليمي" required>
        </div>

        <div class="modal-form-grid">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">المجموعة المستهدفة</label>
            <select id="modalMatGroupId" class="form-select">
              <option value="">جميع المجموعات (متاح للكل)</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">نوع المحتوى *</label>
            <select id="modalMatType" class="form-select" onchange="window.centrlyApp.onMaterialTypeChange(this.value)">
              <option value="pdf">ملف PDF أو مذكرة</option>
              <option value="video">فيديو شرح (YouTube / Drive)</option>
              <option value="link">رابط خارجي أو موقع</option>
            </select>
          </div>
        </div>

        <!-- PDF Source Segmented Switch & Upload Area (Visible when type == 'pdf') -->
        <div id="matPdfSourceWrapper" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0.4rem; display: block;">مصدر ملف الـ PDF *</label>
          <div style="display: flex; gap: 0.4rem; background: #f1f5f9; padding: 4px; border-radius: 0.5rem; margin-bottom: 0.75rem;">
            <button type="button" id="matPdfSourceBtn-upload" onclick="window.centrlyApp.switchMatPdfSource('upload')"
              style="flex: 1; border: none; background: #ffffff; color: var(--centrly-blue-800); padding: 0.5rem 0.6rem; border-radius: 0.4rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.08); transition: all 0.2s; text-align: center;">
              رفع ملف PDF من جهازك
            </button>
            <button type="button" id="matPdfSourceBtn-link" onclick="window.centrlyApp.switchMatPdfSource('link')"
              style="flex: 1; border: none; background: transparent; color: #64748b; padding: 0.5rem 0.6rem; border-radius: 0.4rem; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; text-align: center;">
              رابط سحابي (Google Drive)
            </button>
          </div>

          <!-- Dropzone file picker -->
          <div id="matPdfUploadContainer">
            <input type="file" id="modalMatPdfFileInput" accept="application/pdf" style="display: none;" onchange="window.centrlyApp.handleMatPdfSelected(event)">
            
            <div id="matPdfDropzone" onclick="document.getElementById('modalMatPdfFileInput').click()" 
              ondragover="event.preventDefault(); this.style.borderColor='#2563eb'; this.style.background='#dbeafe';" 
              ondragleave="this.style.borderColor='#3b82f6'; this.style.background='#eff6ff';" 
              ondrop="event.preventDefault(); window.centrlyApp.handleMatPdfDrop(event)"
              style="border: 2px dashed #3b82f6; border-radius: 0.75rem; padding: 1.35rem 1rem; text-align: center; cursor: pointer; background: #eff6ff; transition: all 0.2s;">
              <div style="display: flex; justify-content: center; margin-bottom: 0.4rem;">
                ${getIcon('upload', 32, '#2563eb')}
              </div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #1e40af; margin-bottom: 0.2rem;">
                اضغط هنا لاختيار ملف PDF من اللابتوب أو الموبايل
              </div>
              <div style="font-size: 0.78rem; color: #64748b;">
                ملفات PDF فقط (الحد الأقصى 25 ميجابايت) — أو اسحب الملف وأفلته هنا
              </div>
            </div>

            <div id="matPdfSelectedPreview" style="display: none; margin-top: 0.6rem; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 0.65rem; padding: 0.75rem 0.9rem; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                <span style="display: flex; align-items: center; color: #15803d;">${getIcon('file', 22, '#15803d')}</span>
                <div style="overflow: hidden;">
                  <div id="matPdfSelectedName" style="font-weight: 800; font-size: 0.875rem; color: #166534; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
                  <div id="matPdfSelectedSize" style="font-size: 0.75rem; color: #15803d; font-weight: 600;"></div>
                </div>
              </div>
              <button type="button" onclick="window.centrlyApp.clearMatPdfFile()" class="btn btn-sm" style="background: #ffffff; border: 1px solid #fca5a5; color: #dc2626; font-weight: 700; font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: 0.4rem; cursor: pointer;">
                تغيير الملف
              </button>
            </div>
          </div>
        </div>

        <!-- URL Input Container (Used when PDF Link or Video or External Link) -->
        <div id="matUrlContainer" style="display: none; margin-bottom: 0.85rem;">
          <label id="matUrlLabel" class="form-label" style="font-weight: 700;">الرابط المباشر للملف أو الفيديو *</label>
          <input type="url" id="modalMatUrl" class="form-input" placeholder="https://drive.google.com/..." dir="ltr">
          <div id="matUrlHint" style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
            تأكد أن الرابط متاح للعرض والمشاركة مع الطلاب
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0.5rem;">
          <label class="form-label" style="font-weight: 700;">وصف أو توجيهات للطلاب (اختياري)</label>
          <textarea id="modalMatDescription" class="form-input" rows="2" placeholder="اكتب تعليمات المذاكرة أو أي ملحوظات للطلاب..."></textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddMaterialForm" id="btnPublishMaterial" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">
        إضافة المذكرة الآن
      </button>
    `;
    this.showModal('إضافة مذكرة تعليمية أو شرح جديد', bodyHtml, footerHtml);
  };

  app.handleMatPdfSelected = function(e) {
    const file = e.target.files?.[0];
    if (file) this._processSelectedMatPdf(file);
  };

  app.handleMatPdfDrop = function(e) {
    const file = e.dataTransfer?.files?.[0];
    if (file) this._processSelectedMatPdf(file);
  };

  app._processSelectedMatPdf = function(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.showToast('يرجى اختيار ملف PDF صالح فقط', 'error');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      this.showToast('حجم الملف كبير جداً (أقصى حد مسموح 25 ميجابايت)', 'error');
      return;
    }

    this._selectedMatPdfFile = file;

    const preview = document.getElementById('matPdfSelectedPreview');
    const dropzone = document.getElementById('matPdfDropzone');
    const nameEl = document.getElementById('matPdfSelectedName');
    const sizeEl = document.getElementById('matPdfSelectedSize');

    if (preview && nameEl && sizeEl) {
      nameEl.textContent = file.name;
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      sizeEl.textContent = `${sizeMB} ميجابايت`;
      preview.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
    }
  };

  app.clearMatPdfFile = function() {
    this._selectedMatPdfFile = null;
    const input = document.getElementById('modalMatPdfFileInput');
    if (input) input.value = '';
    const preview = document.getElementById('matPdfSelectedPreview');
    const dropzone = document.getElementById('matPdfDropzone');
    if (preview) preview.style.display = 'none';
    if (dropzone) {
      dropzone.style.display = 'block';
      dropzone.style.borderColor = '#3b82f6';
      dropzone.style.background = '#eff6ff';
    }
  };

  app.switchMatPdfSource = function(source) {
    this._currentMatPdfSource = source;
    const btnUpload = document.getElementById('matPdfSourceBtn-upload');
    const btnLink = document.getElementById('matPdfSourceBtn-link');
    const uploadContainer = document.getElementById('matPdfUploadContainer');
    const urlContainer = document.getElementById('matUrlContainer');
    const urlLabel = document.getElementById('matUrlLabel');
    const urlHint = document.getElementById('matUrlHint');
    const urlInput = document.getElementById('modalMatUrl');

    if (source === 'upload') {
      if (btnUpload) {
        btnUpload.style.background = '#ffffff';
        btnUpload.style.color = 'var(--centrly-blue-800)';
        btnUpload.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
        btnUpload.style.fontWeight = '800';
      }
      if (btnLink) {
        btnLink.style.background = 'transparent';
        btnLink.style.color = '#64748b';
        btnLink.style.boxShadow = 'none';
        btnLink.style.fontWeight = '700';
      }
      if (uploadContainer) uploadContainer.style.display = 'block';
      if (urlContainer) urlContainer.style.display = 'none';
    } else {
      if (btnLink) {
        btnLink.style.background = '#ffffff';
        btnLink.style.color = 'var(--centrly-blue-800)';
        btnLink.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
        btnLink.style.fontWeight = '800';
      }
      if (btnUpload) {
        btnUpload.style.background = 'transparent';
        btnUpload.style.color = '#64748b';
        btnUpload.style.boxShadow = 'none';
        btnUpload.style.fontWeight = '700';
      }
      if (uploadContainer) uploadContainer.style.display = 'none';
      if (urlContainer) {
        urlContainer.style.display = 'block';
        if (urlLabel) urlLabel.textContent = 'رابط ملف الـ PDF (Google Drive أو سحابي) *';
        if (urlHint) urlHint.textContent = 'تأكد من تفعيل صلاحية المشاركة (Anyone with the link can view)';
        if (urlInput) {
          urlInput.placeholder = 'https://drive.google.com/...';
          setTimeout(() => urlInput.focus(), 50);
        }
      }
    }
  };

  app.onMaterialTypeChange = function(type) {
    const pdfWrapper = document.getElementById('matPdfSourceWrapper');
    const urlContainer = document.getElementById('matUrlContainer');
    const urlLabel = document.getElementById('matUrlLabel');
    const urlHint = document.getElementById('matUrlHint');
    const urlInput = document.getElementById('modalMatUrl');

    if (type === 'pdf') {
      if (pdfWrapper) pdfWrapper.style.display = 'block';
      this.switchMatPdfSource(this._currentMatPdfSource || 'upload');
    } else if (type === 'video') {
      if (pdfWrapper) pdfWrapper.style.display = 'none';
      if (urlContainer) urlContainer.style.display = 'block';
      if (urlLabel) urlLabel.textContent = 'رابط فيديو الشرح (YouTube / Google Drive) *';
      if (urlHint) urlHint.textContent = 'يمكنك وضع رابط يوتيوب أو فيديو على جوجل درايف ليظهر مباشرة للطلاب';
      if (urlInput) {
        urlInput.placeholder = 'https://www.youtube.com/watch?v=... أو https://drive.google.com/...';
        setTimeout(() => urlInput.focus(), 50);
      }
    } else {
      if (pdfWrapper) pdfWrapper.style.display = 'none';
      if (urlContainer) urlContainer.style.display = 'block';
      if (urlLabel) urlLabel.textContent = 'الرابط المباشر للموقع أو المنصة *';
      if (urlHint) urlHint.textContent = 'رابط صفحة أو موقع تعليمي يريد الطالب الرجوع إليه';
      if (urlInput) {
        urlInput.placeholder = 'https://...';
        setTimeout(() => urlInput.focus(), 50);
      }
    }
  };

  app.handleAddMaterialSubmit = async function(e) {
    e.preventDefault();
    const title = document.getElementById('modalMatTitle')?.value.trim();
    const group_id = document.getElementById('modalMatGroupId')?.value || null;
    const type = document.getElementById('modalMatType')?.value || 'pdf';
    const description = document.getElementById('modalMatDescription')?.value.trim();
    const submitBtn = document.getElementById('btnPublishMaterial');

    if (!title) {
      this.showToast('يرجى كتابة عنوان المذكرة أو المحتوى التعليمي', 'error');
      return;
    }

    let url = '';
    let file_data = null;
    let file_name = null;

    if (type === 'pdf') {
      const source = this._currentMatPdfSource || 'upload';
      if (source === 'upload') {
        if (!this._selectedMatPdfFile) {
          this.showToast('يرجى اختيار ملف PDF لرفعه من جهازك', 'error');
          return;
        }
        file_name = this._selectedMatPdfFile.name;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>جاري قراءة ورفع الملف للسحابة...</span>`;
        }

        try {
          file_data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('فشل قراءة الملف من الجهاز'));
            reader.readAsDataURL(this._selectedMatPdfFile);
          });
        } catch (readErr) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>إضافة المذكرة الآن</span>`;
          }
          this.showToast('فشل قراءة ملف الـ PDF، يرجى المحاولة مرة أخرى', 'error');
          return;
        }
      } else {
        url = document.getElementById('modalMatUrl')?.value.trim();
        if (!url) {
          this.showToast('يرجى إدخال رابط ملف الـ PDF (Google Drive أو رابط مباشر)', 'error');
          return;
        }
      }
    } else {
      url = document.getElementById('modalMatUrl')?.value.trim();
      if (!url) {
        this.showToast('يرجى إدخال الرابط المطلوب', 'error');
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>جاري إضافة وحفظ المذكرة...</span>`;
    }

    try {
      await request('/materials', {
        method: 'POST',
        body: {
          title,
          group_id,
          type,
          url,
          file_data,
          file_name,
          description,
          is_homework: false,
          due_date: null,
        },
      });
      this.closeModal();
      this.showToast('تمت إضافة المذكرة بنجاح وستظهر فوراً في بوابات الطلاب وأولياء الأمور!', 'success');
      await this.loadRouteData('materials');
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>إضافة المذكرة الآن</span>`;
      }
      this.showToast(`فشل إضافة المذكرة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  };

  app.deleteMaterial = function(id, title) {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('trash', 40, '#ef4444')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">تأكيد حذف المذكرة</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          هل أنت متأكد من حذف المذكرة <strong>"${escapeHtml(title)}"</strong>؟ لن يتمكن الطلاب من تحميلها بعد الآن.
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;" onclick="window.centrlyApp.confirmDeleteMaterial('${id}')">
            حذف نهائي
          </button>
        </div>
      </div>
    `;
    this.showModal('حذف مذكرة', bodyHtml);
  };

  app.confirmDeleteMaterial = async function(id) {
    this.closeModal();
    try {
      await request(`/materials/${id}`, { method: 'DELETE' });
      this.showToast('تم حذف المذكرة بنجاح', 'success');
      await this.loadRouteData('materials');
    } catch (err) {
      this.showToast(`فشل حذف المذكرة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  };
}
