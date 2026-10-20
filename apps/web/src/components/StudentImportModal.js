import { request } from '../services/api.js';
import { normalizeDigits } from '../utils/normalizeDigits.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { getIcon } from '../utils/icons.js';

/**
 * Centrly Student Excel / CSV Import Engine
 * Auto-detects columns, normalizes phone numbers, previews rows, and batch-imports students.
 */
export function registerStudentImportActions(app) {
  app.normalizeImportPhone = function(val) {
    if (!val && val !== 0) return '';
    let digits = normalizeDigits(String(val)).trim().replace(/[^\d+]/g, '');
    if (digits.startsWith('+20')) {
      digits = '0' + digits.slice(3);
    } else if (digits.startsWith('0020')) {
      digits = '0' + digits.slice(4);
    } else if (digits.startsWith('20') && digits.length === 12) {
      digits = '0' + digits.slice(2);
    }
    // Auto-fix 10-digit Egyptian numbers that lost leading 0 in Excel (e.g. 1012345678, 11..., 12..., 15...)
    if (!digits.startsWith('0') && digits.length === 10 && /^[1][0125]/.test(digits)) {
      digits = '0' + digits;
    }
    return digits;
  }

  app.isImportPhoneValid = function(phone) {
    return /^01[0125]\d{8}$/.test(phone);
  }

  app.ensureSheetJsLoaded = async function() {
    if (typeof window.XLSX !== 'undefined') return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('SheetJS CDN failed to load dynamically');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  app.parseCsvOrTsv = function(text) {
    if (!text || typeof text !== 'string') return [];
    const rawLines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rawLines.length === 0) return [];

    // Auto-detect delimiter from the first 5 non-empty lines: tab (\t), comma (,), semicolon (;)
    let tabCount = 0, commaCount = 0, semiCount = 0;
    const sampleLines = rawLines.slice(0, Math.min(rawLines.length, 5));
    for (const line of sampleLines) {
      tabCount += (line.match(/\t/g) || []).length;
      commaCount += (line.match(/,/g) || []).length;
      semiCount += (line.match(/;/g) || []).length;
    }

    let delimiter = ',';
    if (tabCount >= commaCount && tabCount >= semiCount && tabCount > 0) {
      delimiter = '\t';
    } else if (semiCount > commaCount && semiCount > tabCount && semiCount > 0) {
      delimiter = ';';
    }

    const rows = [];
    for (const line of rawLines) {
      if (delimiter === '\t') {
        const parts = line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (parts.some(p => p.length > 0)) rows.push(parts);
      } else {
        const row = [];
        let inQuotes = false;
        let currentField = '';
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            row.push(currentField.trim().replace(/^["']|["']$/g, ''));
            currentField = '';
          } else {
            currentField += char;
          }
        }
        row.push(currentField.trim().replace(/^["']|["']$/g, ''));
        if (row.some(p => p.length > 0)) rows.push(row);
      }
    }
    return rows;
  }

  app.renderGroupOptionsForImport = function renderGroupOptionsForImport(selectedGroupId = null) {
    const groups = this.groups || [];
    let html = `<option value="">-- اختر المجموعة التي تريد إضافة الطلاب إليها --</option>`;
    html += `<option value="__NEW_GROUP__" style="font-weight: 700; color: #2563eb; background: #eff6ff;">+ إضافة مجموعة جديدة الآن...</option>`;
    if (groups.length > 0) {
      html += `<optgroup label="المجموعات المسجلة لديك (${groups.length}):">`;
      groups.forEach(g => {
        const isSelected = String(g.id) === String(selectedGroupId) ? 'selected' : '';
        const center = g.center_name || g.centerName ? ` (${escapeHtml(g.center_name || g.centerName)})` : '';
        const schedule = g.day_of_week ? ` • ${escapeHtml(g.day_of_week)}` : '';
        html += `<option value="${escapeHtml(g.id)}" ${isSelected}>${escapeHtml(g.name)}${center}${schedule}</option>`;
      });
      html += `</optgroup>`;
    }
    return html;
  }

  app.handleImportGroupSelectChange = function(selectEl, step = 1) {
    const val = selectEl.value;
    if (val === '__NEW_GROUP__') {
      this.toggleQuickAddGroupInImport(step, true);
    } else {
      if (this.importWizardState) {
        this.importWizardState.groupId = val || null;
      }
      this.toggleQuickAddGroupInImport(step, false);
    }
  }

  app.toggleQuickAddGroupInImport = function(step = 1, forceState = null) {
    const container = document.getElementById(`quickGroupCreatorStep${step}`);
    if (!container) return;
    const isVisible = container.style.display !== 'none';
    const shouldShow = forceState !== null ? forceState : !isVisible;
    container.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) {
      const nameInput = document.getElementById(`quickGroupName${step}`);
      if (nameInput) setTimeout(() => nameInput.focus(), 80);
    } else {
      const selectEl = document.getElementById(step === 1 ? 'importGroupId' : 'importStep2GroupId');
      if (selectEl && selectEl.value === '__NEW_GROUP__') {
        selectEl.value = this.importWizardState?.groupId || '';
      }
    }
  }

  app.cancelQuickAddGroupInImport = function(step = 1) {
    this.toggleQuickAddGroupInImport(step, false);
  }

  app.executeQuickCreateGroupForImport = async function(step = 1) {
    const nameInput = document.getElementById(`quickGroupName${step}`);
    const centerInput = document.getElementById(`quickGroupCenter${step}`);
    const priceInput = document.getElementById(`quickGroupPrice${step}`);
    const dayInput = document.getElementById(`quickGroupDay${step}`);
    const saveBtn = document.getElementById(`btnSaveQuickGroup${step}`);

    const name = nameInput?.value?.trim();
    if (!name) {
      this.showToast('يرجى كتابة اسم المجموعة أولاً', 'warning');
      nameInput?.focus();
      return;
    }

    const center_name = centerInput?.value?.trim() || undefined;
    const price = Number(priceInput?.value) || 0;
    const day_of_week = dayInput?.value || 'السبت';
    const session_time = '04:00 م';
    const schedule = `${day_of_week} • ${session_time}`;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ... ⏳';
    }

    try {
      const res = await request('/groups', {
        method: 'POST',
        body: {
          name,
          center_name,
          price,
          session_price: price,
          day_of_week,
          session_time,
          sessions_per_week: 1,
          billing_model: 'percentage',
          center_cut_percentage: 20,
          schedule,
        },
      });

      const newGroup = res?.group || res;
      if (!newGroup || !newGroup.id) {
        throw new Error('لم يتم استلام بيانات المجموعة من الخادم');
      }

      if (!this.groups) this.groups = [];
      this.groups.unshift(newGroup);
      this.saveCache('groups', this.groups);

      if (this.importWizardState) {
        this.importWizardState.groupId = newGroup.id;
      }

      const sel1 = document.getElementById('importGroupId');
      if (sel1) {
        sel1.innerHTML = this.renderGroupOptionsForImport(newGroup.id);
        sel1.value = newGroup.id;
      }

      const sel2 = document.getElementById('importStep2GroupId');
      if (sel2) {
        sel2.innerHTML = this.renderGroupOptionsForImport(newGroup.id);
        sel2.value = newGroup.id;
      }

      const selStudent = document.getElementById('newStudentGroup');
      if (selStudent) {
        selStudent.innerHTML = this.renderGroupOptionsForImport(newGroup.id);
        selStudent.value = newGroup.id;
      }

      this.toggleQuickAddGroupInImport(step, false);
      this.showToast(`تم إنشاء مجموعة (${escapeHtml(name)}) واختيارها بنجاح! ✓`, 'success');
    } catch (err) {
      console.error('Quick group creation failed:', err);
      this.showToast(`تعذر إنشاء المجموعة: ${err.message || 'خطأ غير متوقع'}`, 'danger');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ واختيار المجموعة الآن ✓';
      }
    }
  }

  app.openImportModal = function(initialGroupId = null) {
    const studentLimit = this.billingState?.students_limit || 300;
    const currentCount = (this.students || []).length;
    if (currentCount >= studentLimit) {
      const storageKey = 'centrly_quota_exceeded_timestamp';
      let reachedTimestamp = null;
      try {
        reachedTimestamp = (typeof localStorage !== 'undefined') ? localStorage.getItem(storageKey) : null;
        if (!reachedTimestamp) {
          reachedTimestamp = Date.now().toString();
          localStorage.setItem(storageKey, reachedTimestamp);
        }
      } catch (_) {
        reachedTimestamp = Date.now().toString();
      }
      const elapsedDays = (Date.now() - Number(reachedTimestamp)) / (1000 * 60 * 60 * 24);
      if (elapsedDays > 3) {
        this.showQuotaBlockedModal(currentCount, studentLimit);
        return;
      }
    }

    if (!this.groups || this.groups.length === 0) {
      request('/groups').then(grpRes => {
        this.groups = Array.isArray(grpRes) ? grpRes : (grpRes?.groups || []);
        this.saveCache('groups', this.groups);
        const sel1 = document.getElementById('importGroupId');
        if (sel1) sel1.innerHTML = this.renderGroupOptionsForImport(this.importWizardState?.groupId);
      }).catch(err => console.warn('Failed to load groups for import modal:', err));
    }

    const targetGroupId = initialGroupId || (this.groups && this.groups.length === 1 ? this.groups[0].id : (initialGroupId || null));

    this.importWizardState = {
      file: null,
      fileName: '',
      groupId: targetGroupId,
      rawRows: [],
      headers: [],
      dataRows: [],
      mapping: {
        name: -1,
        parent_phone: -1,
        student_phone: -1,
        code: -1,
        fee: -1,
      },
    };

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(59, 130, 246, 0.04)); border: 1px solid rgba(37, 99, 235, 0.15); border-radius: 12px; padding: 0.9rem 1.1rem; display: flex; align-items: flex-start; gap: 0.75rem;">
          <div style="color: #2563eb; flex-shrink: 0; margin-top: 0.15rem;">
            ${getIcon('download', 22, '#2563eb')}
          </div>
          <div>
            <div style="font-weight: 700; color: #1e3a8a; font-size: 0.95rem; margin-bottom: 0.2rem;">المساعد الذكي لاستيراد الطلاب</div>
            <div style="font-size: 0.82rem; color: #475569; line-height: 1.5;">
              حدد المجموعة المستهدفة أو أنشئ مجموعة جديدة فوراً، ثم ارفع ملف Excel أو CSV أو الصق البيانات مباشرة. يمكنك مراجعة ومطابقة الأعمدة في الخطوة التالية.
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.35rem;">
            <label class="form-label" style="font-weight: 700; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0;">
              <span>المجموعة المستهدفة لإضافة الطلاب:</span>
              <span style="color: #dc2626;">*</span>
            </label>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleQuickAddGroupInImport(1)" style="font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.6rem; color: #2563eb; border-color: #cbd5e1;">
              ${getIcon('add', 14, '#2563eb')}
              <span>إضافة مجموعة جديدة</span>
            </button>
          </div>
          <select id="importGroupId" class="form-select" style="font-weight: 600; font-size: 0.95rem; border-color: #cbd5e1;" onchange="window.centrlyApp.handleImportGroupSelectChange(this, 1)">
            ${this.renderGroupOptionsForImport(this.importWizardState.groupId)}
          </select>

          <!-- Inline Quick Group Creator for Step 1 -->
          <div id="quickGroupCreatorStep1" style="display: none; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 0.9rem; margin-top: 0.65rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
              <div style="font-weight: 800; color: #166534; font-size: 0.9rem; display: flex; align-items: center; gap: 0.35rem;">
                ${getIcon('add', 16, '#16a34a')}
                <span>إنشاء مجموعة جديدة فوراً واختيارها</span>
              </div>
              <button type="button" onclick="window.centrlyApp.cancelQuickAddGroupInImport(1)" style="background: none; border: none; font-size: 1.25rem; line-height: 1; cursor: pointer; color: #64748b;" title="إغلاق">&times;</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.6rem;">
              <div>
                <label style="font-weight: 700; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 0.2rem;">اسم المجموعة *</label>
                <input type="text" id="quickGroupName1" class="form-input" placeholder="مثال: الصف الأول الثانوي (أ)" style="font-size: 0.85rem;" required>
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 0.2rem;">المقر / السنتر (اختياري)</label>
                <input type="text" id="quickGroupCenter1" class="form-input" placeholder="اسم السنتر أو القاعة" style="font-size: 0.85rem;">
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 0.2rem;">سعر الحصة (ج.م) *</label>
                <input type="number" id="quickGroupPrice1" class="form-input" value="50" min="0" step="5" style="font-size: 0.85rem;" required>
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 0.2rem;">يوم الحصة الأسبوعي</label>
                <select id="quickGroupDay1" class="form-input" style="font-size: 0.85rem;">
                  <option value="السبت">السبت</option>
                  <option value="الأحد">الأحد</option>
                  <option value="الإثنين">الإثنين</option>
                  <option value="الثلاثاء">الثلاثاء</option>
                  <option value="الأربعاء">الأربعاء</option>
                  <option value="الخميس">الخميس</option>
                  <option value="الجمعة">الجمعة</option>
                </select>
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.4rem; margin-top: 0.75rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.cancelQuickAddGroupInImport(1)">إلغاء</button>
              <button type="button" class="btn btn-primary btn-sm" id="btnSaveQuickGroup1" onclick="window.centrlyApp.executeQuickCreateGroupForImport(1)" style="background: #16a34a; border-color: #16a34a; font-weight: 700;">
                حفظ واختيار المجموعة الآن ✓
              </button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0.4rem;">
            رفع ملف الطلاب (Excel .xlsx / .xls أو CSV):
          </label>
          <div id="importDropZone" style="border: 2px dashed #94a3b8; border-radius: 12px; padding: 1.5rem; text-align: center; background: #f8fafc; cursor: pointer; transition: all 0.2s;"
               onclick="document.getElementById('importFileInput').click()"
               ondragover="event.preventDefault(); this.style.borderColor='#2563eb'; this.style.backgroundColor='#eff6ff';"
               ondragleave="this.style.borderColor='#94a3b8'; this.style.backgroundColor='#f8fafc';"
               ondrop="event.preventDefault(); this.style.borderColor='#94a3b8'; this.style.backgroundColor='#f8fafc'; window.centrlyApp.handleImportFileDrop(event);">
            <div id="dropZoneContent">
              <div style="font-size: 2rem; margin-bottom: 0.5rem; color: #64748b;">📄</div>
              <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">اسحب وأفلت ملف الطلاب هنا أو اضغط للاختيار من جهازك</div>
              <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.35rem;">يدعم صيغ Excel (.xlsx, .xls) وصيغ (.csv, .tsv, .txt)</div>
            </div>
            <input type="file" id="importFileInput" accept=".xlsx,.xls,.csv,.tsv,.txt" style="display: none;" onchange="window.centrlyApp.handleImportFileSelected(this)">
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem; margin: -0.25rem 0;">
          <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
          <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">أو الصق البيانات مباشرة من الجدول</span>
          <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0.4rem;">
            نسخ ولصق خلايا Excel أو Google Sheets هنا:
          </label>
          <textarea id="importRawText" class="form-input" rows="4" dir="rtl" placeholder="حدد الخلايا في ملف Excel ثم انسخها والصقها هنا مباشرة..." style="font-size: 0.85rem; font-family: monospace; resize: vertical;"></textarea>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.3rem;">
            💡 يمكنك نسخ صفوف الطلاب مباشرة من برنامج Excel وسيتعرف النظام تلقائياً على الفواصل والأعمدة.
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="button" class="btn btn-primary" onclick="window.centrlyApp.handleImportParseStep()" style="font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
        <span>معاينة ومطابقة الأعمدة</span>
        <span>←</span>
      </button>
    `;

    this.showModal('استيراد قائمة الطلاب (Excel / CSV / نسخ مباشر)', bodyHtml, footerHtml, '620px');
  }

  app.handleImportFileDrop = function(e) {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    this.processSelectedImportFile(file);
  }

  app.handleImportFileSelected = function(input) {
    const file = input.files?.[0];
    if (!file) return;
    this.processSelectedImportFile(file);
  }

  app.handleCsvFileSelected = function(input) {
    this.handleImportFileSelected(input);
  }

  app.processSelectedImportFile = function(file) {
    if (!this.importWizardState) {
      this.importWizardState = {};
    }
    this.importWizardState.file = file;
    this.importWizardState.fileName = file.name;

    const dropZone = document.getElementById('dropZoneContent');
    if (dropZone) {
      const sizeKb = (file.size / 1024).toFixed(1);
      dropZone.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: #16a34a; font-weight: 700; font-size: 1rem;">
          <span>✓</span>
          <span>تم اختيار الملف بنجاح</span>
        </div>
        <div style="margin-top: 0.3rem; font-weight: 700; color: #1e293b; font-size: 0.9rem;">${escapeHtml(file.name)}</div>
        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">الحجم: ${sizeKb} كيلوبايت — اضغط لتغيير الملف</div>
      `;
    }
  }

  app.handleImportParseStep = async function() {
    const groupId = document.getElementById('importGroupId')?.value;
    if (!groupId || groupId === '__NEW_GROUP__') {
      this.showToast('يرجى اختيار المجموعة المستهدفة أولاً أو إنشاء مجموعة جديدة للمتابعة', 'warning');
      const sel = document.getElementById('importGroupId');
      if (sel) sel.focus();
      return;
    }
    if (this.importWizardState) {
      this.importWizardState.groupId = groupId;
    }

    const pastedText = document.getElementById('importRawText')?.value?.trim();
    const file = this.importWizardState?.file;

    if (!file && !pastedText) {
      this.showToast('يرجى اختيار ملف أو لصق بيانات الطلاب للمتابعة', 'warning');
      return;
    }

    this.showToast('جاري قراءة وتحليل بيانات الملف...', 'info');

    let rawRows = [];

    try {
      if (file) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
          await this.ensureSheetJsLoaded();
          if (typeof window.XLSX === 'undefined') {
            this.showToast('تعذر تحميل مكتبة قراءة Excel، يرجى حفظ الملف كـ CSV أو نسخ ولصق الخلايا', 'danger');
            return;
          }
          const buffer = await file.arrayBuffer();
          const wb = window.XLSX.read(new Uint8Array(buffer), { type: 'array' });
          const sheetName = wb.SheetNames[0];
          if (!sheetName) {
            this.showToast('ملف Excel فارغ ولا يحتوي على صفحات', 'danger');
            return;
          }
          const ws = wb.Sheets[sheetName];
          const raw2D = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          rawRows = raw2D.map(row => Array.isArray(row) ? row.map(c => String(c ?? '').trim()) : []);
        } else {
          // CSV / TSV / TXT file
          const text = await file.text();
          rawRows = this.parseCsvOrTsv(text);
        }
      } else if (pastedText) {
        rawRows = this.parseCsvOrTsv(pastedText);
      }

      // Filter out rows that are completely empty
      rawRows = rawRows.filter(r => Array.isArray(r) && r.some(cell => String(cell).trim().length > 0));

      if (rawRows.length === 0) {
        this.showToast('لم يتم العثور على أي صفوف أو بيانات صالحة في الملف أو النص', 'danger');
        return;
      }

      // Standardize column count across all rows
      const maxCols = Math.max(...rawRows.map(r => r.length));
      rawRows = rawRows.map(r => {
        const padded = [...r];
        while (padded.length < maxCols) padded.push('');
        return padded;
      });

      // Header Detection & Auto-Matching
      const { headers, dataRows, mapping } = this.detectHeadersAndColumns(rawRows);

      if (dataRows.length === 0) {
        this.showToast('الملف يحتوي على رأس جدول فقط دون أي صفوف طلاب', 'warning');
        return;
      }

      this.importWizardState.rawRows = rawRows;
      this.importWizardState.headers = headers;
      this.importWizardState.dataRows = dataRows;
      this.importWizardState.mapping = mapping;

      this.renderColumnMappingModal();
    } catch (err) {
      console.error('Import parse error:', err);
      this.showToast('حدث خطأ أثناء قراءة الملف: ' + (err.message || 'بيانات تالفة'), 'danger');
    }
  }

  app.detectHeadersAndColumns = function(rawRows) {
    if (!rawRows || rawRows.length === 0) {
      return { headers: [], dataRows: [], mapping: {} };
    }

    const firstRow = rawRows[0];

    // Header keywords
    const headerKeywords = [
      'اسم', 'طالب', 'الاسم', 'ولي', 'امر', 'أمر', 'هاتف', 'موبايل', 'تليفون',
      'كود', 'مسلسل', 'باركود', 'مصاريف', 'رسوم', 'name', 'student', 'phone',
      'mobile', 'parent', 'guardian', 'code', 'id', 'fee'
    ];

    // Check if first row looks like a header:
    // If any cell in first row contains a phone number, it's definitely NOT a header row.
    const row0HasPhone = firstRow.some(cell => this.isImportPhoneValid(this.normalizeImportPhone(cell)));
    
    // Check keyword matches in row 0
    const row0KeywordMatches = firstRow.filter(cell => {
      const lower = String(cell).toLowerCase();
      return headerKeywords.some(kw => lower.includes(kw));
    }).length;

    const isHeader = !row0HasPhone && (row0KeywordMatches >= 1 || rawRows.length > 1);

    let headers = [];
    let dataRows = [];

    if (isHeader) {
      headers = firstRow.map((h, i) => {
        const str = String(h || '').trim();
        return str.length > 0 ? str : `العمود ${i + 1}`;
      });
      dataRows = rawRows.slice(1);
    } else {
      headers = firstRow.map((_, i) => `العمود ${i + 1}`);
      dataRows = rawRows;
    }

    // Auto-detect column mapping
    const mapping = {
      name: -1,
      parent_phone: -1,
      student_phone: -1,
      code: -1,
      fee: -1,
    };

    const usedCols = new Set();

    // 1. Pass 1: Header name matches
    headers.forEach((h, colIdx) => {
      const norm = String(h).trim().toLowerCase().replace(/[\s_\-]+/g, '');

      // Name: contains "اسم" or "name" or "طالب" (without "هاتف"/"موبايل"/"كود"/"ولي")
      if (mapping.name === -1 && !norm.includes('ولي') && !norm.includes('هاتف') && !norm.includes('موبايل') && !norm.includes('كود')) {
        if (norm.includes('اسم') || norm.includes('طالب') || norm.includes('student') || norm.includes('name')) {
          mapping.name = colIdx;
          usedCols.add(colIdx);
          return;
        }
      }

      // Parent Phone: contains "ولي" or "parent" or "guardian" or "father" or "mother"
      if (mapping.parent_phone === -1) {
        if (norm.includes('ولي') || norm.includes('امر') || norm.includes('parent') || norm.includes('guardian') || norm.includes('father')) {
          mapping.parent_phone = colIdx;
          usedCols.add(colIdx);
          return;
        }
      }

      // Student Phone: contains "هاتف" or "موبايل" or "تليفون" or "phone" without "ولي"
      if (mapping.student_phone === -1 && !norm.includes('ولي') && !norm.includes('امر')) {
        if (norm.includes('هاتف') || norm.includes('موبايل') || norm.includes('تليفون') || norm.includes('phone') || norm.includes('mobile')) {
          mapping.student_phone = colIdx;
          usedCols.add(colIdx);
          return;
        }
      }

      // Code: contains "كود" or "مسلسل" or "باركود" or "code" or "barcode"
      if (mapping.code === -1) {
        if (norm.includes('كود') || norm.includes('مسلسل') || norm.includes('باركود') || norm.includes('code') || norm.includes('id')) {
          mapping.code = colIdx;
          usedCols.add(colIdx);
          return;
        }
      }

      // Fee: contains "مصاريف" or "رسوم" or "اشتراك" or "مبلغ" or "fee"
      if (mapping.fee === -1) {
        if (norm.includes('مصاريف') || norm.includes('رسوم') || norm.includes('اشتراك') || norm.includes('fee') || norm.includes('مبلغ')) {
          mapping.fee = colIdx;
          usedCols.add(colIdx);
          return;
        }
      }
    });

    // 2. Pass 2: Content-based heuristics for unassigned fields
    const sampleRows = dataRows.slice(0, Math.min(dataRows.length, 10));

    // Analyze phone columns
    const phoneCols = [];
    headers.forEach((_, colIdx) => {
      if (usedCols.has(colIdx)) return;
      let validPhoneCount = 0;
      let totalNonEmpty = 0;
      for (const row of sampleRows) {
        const val = row[colIdx];
        if (val && String(val).trim().length > 0) {
          totalNonEmpty++;
          if (this.isImportPhoneValid(this.normalizeImportPhone(val))) {
            validPhoneCount++;
          }
        }
      }
      if (totalNonEmpty > 0 && (validPhoneCount / totalNonEmpty) >= 0.5) {
        phoneCols.push(colIdx);
      }
    });

    // Assign detected phone columns
    for (const pCol of phoneCols) {
      if (mapping.parent_phone === -1) {
        mapping.parent_phone = pCol;
        usedCols.add(pCol);
      } else if (mapping.student_phone === -1) {
        mapping.student_phone = pCol;
        usedCols.add(pCol);
      }
    }

    // Analyze name column if still unassigned
    if (mapping.name === -1) {
      headers.forEach((_, colIdx) => {
        if (usedCols.has(colIdx)) return;
        let arabicNameCount = 0;
        let totalNonEmpty = 0;
        for (const row of sampleRows) {
          const val = String(row[colIdx] || '').trim();
          if (val) {
            totalNonEmpty++;
            // Check if string contains at least 2 words with Arabic characters and no digits
            const words = val.split(/\s+/);
            if (words.length >= 2 && /^[\u0600-\u06FF\s]+$/.test(val)) {
              arabicNameCount++;
            }
          }
        }
        if (totalNonEmpty > 0 && (arabicNameCount / totalNonEmpty) >= 0.5) {
          mapping.name = colIdx;
          usedCols.add(colIdx);
        }
      });
    }

    // Analyze code column if still unassigned
    if (mapping.code === -1) {
      headers.forEach((_, colIdx) => {
        if (usedCols.has(colIdx)) return;
        let codeCount = 0;
        let totalNonEmpty = 0;
        for (const row of sampleRows) {
          const val = String(row[colIdx] || '').trim();
          if (val) {
            totalNonEmpty++;
            // Short alphanumeric or numbers 2-8 chars
            if (/^[a-zA-Z0-9]{2,8}$/.test(val) && !this.isImportPhoneValid(val)) {
              codeCount++;
            }
          }
        }
        if (totalNonEmpty > 0 && (codeCount / totalNonEmpty) >= 0.6) {
          mapping.code = colIdx;
          usedCols.add(colIdx);
        }
      });
    }

    return { headers, dataRows, mapping };
  }

  app.renderColumnMappingModal = function() {
    const { headers, dataRows, mapping, groupId } = this.importWizardState;
    const group = (this.groups || []).find(g => String(g.id) === String(groupId));
    const groupName = group ? group.name : 'المجموعة المحددة';

    const renderColumnOptions = (selectedIdx) => {
      let html = `<option value="-1">— تجاهل هذا العمود —</option>`;
      headers.forEach((h, idx) => {
        const sampleVal = dataRows[0]?.[idx] ? ` (مثال: ${escapeHtml(String(dataRows[0][idx]).slice(0, 18))})` : '';
        const isSelected = selectedIdx === idx ? 'selected' : '';
        html += `<option value="${idx}" ${isSelected}>العمود ${idx + 1}: ${escapeHtml(h)}${sampleVal}</option>`;
      });
      return html;
    };

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <!-- Target Group Selector & Summary Bar in Step 2 -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.75rem 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 280px;">
              <label for="importStep2GroupId" style="font-weight: 700; font-size: 0.85rem; color: #1e293b; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0;">
                <span>${getIcon('groups', 16, '#2563eb')}</span>
                <span>المجموعة المستهدفة:</span>
              </label>
              <select id="importStep2GroupId" class="form-select" style="font-size: 0.85rem; font-weight: 700; flex: 1;" onchange="window.centrlyApp.handleImportGroupSelectChange(this, 2)">
                ${this.renderGroupOptionsForImport(groupId)}
              </select>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleQuickAddGroupInImport(2)" title="إضافة مجموعة جديدة" style="white-space: nowrap; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; color: #2563eb; border-color: #cbd5e1;">
                ${getIcon('add', 14, '#2563eb')}
                <span>مجموعة جديدة</span>
              </button>
            </div>
            <div style="font-size: 0.82rem; color: #64748b; white-space: nowrap;">
              إجمالي الصفوف المقروءة: <strong style="color: #0f172a;">${dataRows.length}</strong> صف
            </div>
          </div>

          <!-- Inline Quick Group Creator for Step 2 -->
          <div id="quickGroupCreatorStep2" style="display: none; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 0.9rem; margin-top: 0.65rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
              <div style="font-weight: 800; color: #166534; font-size: 0.9rem; display: flex; align-items: center; gap: 0.35rem;">
                ${getIcon('add', 16, '#16a34a')}
                <span>إنشاء مجموعة جديدة فوراً واختيارها</span>
              </div>
              <button type="button" onclick="window.centrlyApp.cancelQuickAddGroupInImport(2)" style="background: none; border: none; font-size: 1.25rem; line-height: 1; cursor: pointer; color: #64748b;" title="إغلاق">&times;</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.6rem;">
              <div>
                <label style="font-weight: 700; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 0.2rem;">اسم المجموعة *</label>
                <input type="text" id="quickGroupName2" class="form-input" placeholder="مثال: الصف الأول الثانوي (أ)" style="font-size: 0.85rem;" required>
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 0.2rem;">المقر / السنتر (اختياري)</label>
                <input type="text" id="quickGroupCenter2" class="form-input" placeholder="اسم السنتر أو القاعة" style="font-size: 0.85rem;">
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 0.2rem;">سعر الحصة (ج.م) *</label>
                <input type="number" id="quickGroupPrice2" class="form-input" value="50" min="0" step="5" style="font-size: 0.85rem;" required>
              </div>
              <div>
                <label style="font-weight: 700; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 0.2rem;">يوم الحصة الأسبوعي</label>
                <select id="quickGroupDay2" class="form-input" style="font-size: 0.85rem;">
                  <option value="السبت">السبت</option>
                  <option value="الأحد">الأحد</option>
                  <option value="الإثنين">الإثنين</option>
                  <option value="الثلاثاء">الثلاثاء</option>
                  <option value="الأربعاء">الأربعاء</option>
                  <option value="الخميس">الخميس</option>
                  <option value="الجمعة">الجمعة</option>
                </select>
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.4rem; margin-top: 0.75rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.cancelQuickAddGroupInImport(2)">إلغاء</button>
              <button type="button" class="btn btn-primary btn-sm" id="btnSaveQuickGroup2" onclick="window.centrlyApp.executeQuickCreateGroupForImport(2)" style="background: #16a34a; border-color: #16a34a; font-weight: 700;">
                حفظ واختيار المجموعة الآن ✓
              </button>
            </div>
          </div>
        </div>

        <!-- Mapping Fields Grid -->
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 1rem;">
          <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>${getIcon('settings', 16, '#2563eb')}</span>
            <span>مطابقة الأعمدة (حدد العمود المقابل لكل بيان):</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.85rem;">
            <!-- Student Name -->
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
                <span>اسم الطالب: <span style="color: #dc2626;">* (مطلوب)</span></span>
              </label>
              <select id="mapCol_name" class="form-select" style="font-size: 0.85rem; font-weight: 600;" onchange="window.centrlyApp.updateImportLivePreview()">
                ${renderColumnOptions(mapping.name)}
              </select>
            </div>

            <!-- Parent Phone -->
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
                <span>رقم ولي الأمر: <span style="color: #dc2626;">* (مطلوب)</span></span>
              </label>
              <select id="mapCol_parent_phone" class="form-select" style="font-size: 0.85rem; font-weight: 600;" onchange="window.centrlyApp.updateImportLivePreview()">
                ${renderColumnOptions(mapping.parent_phone)}
              </select>
            </div>

            <!-- Student Phone -->
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem;">
                <span>هاتف الطالب: <span style="color: #64748b; font-weight: 400;">(اختياري)</span></span>
              </label>
              <select id="mapCol_student_phone" class="form-select" style="font-size: 0.85rem;" onchange="window.centrlyApp.updateImportLivePreview()">
                ${renderColumnOptions(mapping.student_phone)}
              </select>
            </div>

            <!-- Student Code -->
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem;">
                <span>كود الطالب / الباركود: <span style="color: #64748b; font-weight: 400;">(اختياري - يولد تلقائياً إن ترك فارغاً)</span></span>
              </label>
              <select id="mapCol_code" class="form-select" style="font-size: 0.85rem;" onchange="window.centrlyApp.updateImportLivePreview()">
                ${renderColumnOptions(mapping.code)}
              </select>
            </div>

            <!-- Monthly Fee -->
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem;">
                <span>قيمة المصاريف الشهرية: <span style="color: #64748b; font-weight: 400;">(اختياري)</span></span>
              </label>
              <select id="mapCol_fee" class="form-select" style="font-size: 0.85rem;" onchange="window.centrlyApp.updateImportLivePreview()">
                ${renderColumnOptions(mapping.fee)}
              </select>
            </div>
          </div>
        </div>

        <!-- Live Preview Container -->
        <div id="importLivePreviewContainer">
          <!-- Filled by updateImportLivePreview() -->
        </div>
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.openImportModal('${escapeHtml(groupId || '')}')">
        ← تغيير الملف
      </button>
      <button type="button" class="btn btn-primary" id="btnExecuteImport" onclick="window.centrlyApp.executeImportStudents()" style="font-weight: 700;">
        بدء استيراد الطلاب الآن ✓
      </button>
    `;

    this.showModal('مطابقة الأعمدة وتأكيد الاستيراد (خطوة 2 من 2)', bodyHtml, footerHtml, '840px');
    this.updateImportLivePreview();
  }

  app.updateImportLivePreview = function() {
    if (!this.importWizardState || !this.importWizardState.dataRows) return;

    const nameCol = parseInt(document.getElementById('mapCol_name')?.value ?? -1, 10);
    const parentCol = parseInt(document.getElementById('mapCol_parent_phone')?.value ?? -1, 10);
    const studentCol = parseInt(document.getElementById('mapCol_student_phone')?.value ?? -1, 10);
    const codeCol = parseInt(document.getElementById('mapCol_code')?.value ?? -1, 10);
    const feeCol = parseInt(document.getElementById('mapCol_fee')?.value ?? -1, 10);

    this.importWizardState.mapping = {
      name: nameCol,
      parent_phone: parentCol,
      student_phone: studentCol,
      code: codeCol,
      fee: feeCol,
    };

    const dataRows = this.importWizardState.dataRows;
    let validCount = 0;
    let invalidCount = 0;

    const seenCodesInPreview = new Set();
    const existingCodeMap = new Map();
    (this.students || []).forEach(s => {
      const c1 = (s.code || '').trim();
      const c2 = (s.student_code || s.studentCode || '').trim();
      if (c1) existingCodeMap.set(c1, s.name);
      if (c2) existingCodeMap.set(c2, s.name);
    });

    const sampleRows = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const name = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
      const rawParent = parentCol >= 0 ? String(row[parentCol] || '').trim() : '';
      const parentPhone = this.normalizeImportPhone(rawParent);
      const rawStudent = studentCol >= 0 ? String(row[studentCol] || '').trim() : '';
      const studentPhone = this.normalizeImportPhone(rawStudent);
      const code = codeCol >= 0 ? String(row[codeCol] || '').trim() : '';

      const isNameValid = name.length > 0;
      const isParentValid = this.isImportPhoneValid(parentPhone);
      let isCodeDuplicate = false;
      let duplicateReason = '';
      if (code) {
        if (seenCodesInPreview.has(code)) {
          isCodeDuplicate = true;
          duplicateReason = 'كود مكرر في الملف';
        } else if (existingCodeMap.has(code)) {
          isCodeDuplicate = true;
          duplicateReason = `كود مكرر (${existingCodeMap.get(code)})`;
        } else {
          seenCodesInPreview.add(code);
        }
      }

      const isValid = isNameValid && isParentValid && !isCodeDuplicate;

      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
      }

      if (i < 4) {
        let statusHtml = '';
        if (isValid) {
          statusHtml = `<span style="background: #dcfce7; color: #15803d; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">✅ صالح</span>`;
        } else if (isCodeDuplicate) {
          statusHtml = `<span style="background: #fee2e2; color: #b91c1c; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">⚠️ ${duplicateReason}</span>`;
        } else if (!isNameValid) {
          statusHtml = `<span style="background: #fee2e2; color: #b91c1c; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">⚠️ الاسم مفقود</span>`;
        } else if (!isParentValid) {
          statusHtml = `<span style="background: #fef3c7; color: #b45309; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">⚠️ هاتف ولي الأمر غير صحيح</span>`;
        }
        sampleRows.push({
          rowNum: i + 1,
          name: name || '<span style="color: #94a3b8;">—</span>',
          parentPhone: parentPhone || '<span style="color: #94a3b8;">—</span>',
          studentPhone: studentPhone || '<span style="color: #94a3b8;">—</span>',
          code: code || '<span style="color: #94a3b8;">تلقائي</span>',
          statusHtml,
        });
      }
    }

    const previewContainer = document.getElementById('importLivePreviewContainer');
    if (!previewContainer) return;

    previewContainer.innerHTML = `
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff;">
        <div style="padding: 0.75rem 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <div style="font-weight: 700; font-size: 0.88rem; color: #1e293b;">
            معاينة عينة من البيانات المحددة (أول ${sampleRows.length} طلاب):
          </div>
          <div style="display: flex; gap: 0.5rem; font-size: 0.8rem;">
            <span style="background: #dcfce7; color: #166534; padding: 0.2rem 0.55rem; border-radius: 6px; font-weight: 700;">
              جاهز للاستيراد: ${validCount}
            </span>
            ${invalidCount > 0 ? `
              <span style="background: #fee2e2; color: #991b1b; padding: 0.2rem 0.55rem; border-radius: 6px; font-weight: 700;">
                بيانات غير مكتملة أو مكررة: ${invalidCount}
              </span>
            ` : ''}
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="table" style="width: 100%; margin: 0; font-size: 0.82rem; text-align: right; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9; color: #475569; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 0.5rem 0.75rem;">#</th>
                <th style="padding: 0.5rem 0.75rem;">اسم الطالب</th>
                <th style="padding: 0.5rem 0.75rem;">رقم ولي الأمر</th>
                <th style="padding: 0.5rem 0.75rem;">رقم هاتف الطالب</th>
                <th style="padding: 0.5rem 0.75rem;">كود الطالب</th>
                <th style="padding: 0.5rem 0.75rem;">حالة الفحص</th>
              </tr>
            </thead>
            <tbody>
              ${sampleRows.map(r => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 0.5rem 0.75rem; color: #64748b;">${r.rowNum}</td>
                  <td style="padding: 0.5rem 0.75rem; font-weight: 600; color: #0f172a;">${r.name}</td>
                  <td style="padding: 0.5rem 0.75rem; font-family: monospace; direction: ltr; text-align: right;">${r.parentPhone}</td>
                  <td style="padding: 0.5rem 0.75rem; font-family: monospace; direction: ltr; text-align: right;">${r.studentPhone}</td>
                  <td style="padding: 0.5rem 0.75rem;">${r.code}</td>
                  <td style="padding: 0.5rem 0.75rem;">${r.statusHtml}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const btnExecute = document.getElementById('btnExecuteImport');
    if (btnExecute) {
      if (validCount > 0) {
        btnExecute.disabled = false;
        btnExecute.innerHTML = `بدء استيراد (${validCount}) طالب الآن ✓`;
        btnExecute.className = 'btn btn-primary';
      } else {
        btnExecute.disabled = true;
        btnExecute.innerHTML = `يرجى تحديد أعمدة صالحة (0 طالب جاهز)`;
        btnExecute.className = 'btn btn-secondary';
      }
    }
  }

  app.executeImportStudents = async function() {
    if (!this.importWizardState) return;

    const step2Select = document.getElementById('importStep2GroupId');
    const selectedGroupId = step2Select?.value || this.importWizardState.groupId;

    if (!selectedGroupId || selectedGroupId === '__NEW_GROUP__') {
      this.showToast('يرجى اختيار المجموعة المستهدفة أولاً أو إنشاء مجموعة جديدة للمتابعة', 'warning');
      if (step2Select) step2Select.focus();
      return;
    }

    this.importWizardState.groupId = selectedGroupId;
    const { dataRows, mapping, groupId } = this.importWizardState;

    const { name: nameCol, parent_phone: parentCol, student_phone: studentCol, code: codeCol, fee: feeCol } = mapping;

    if (nameCol === -1 || parentCol === -1) {
      this.showToast('يرجى تحديد عمود اسم الطالب وعمود رقم ولي الأمر على الأقل للمتابعة', 'warning');
      return;
    }

    const validStudents = [];
    const skippedRows = [];
    const seenBatchCodes = new Set();
    const existingCodeMap = new Map();
    (this.students || []).forEach(s => {
      const c1 = (s.code || '').trim();
      const c2 = (s.student_code || s.studentCode || '').trim();
      if (c1) existingCodeMap.set(c1, s.name);
      if (c2) existingCodeMap.set(c2, s.name);
    });

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const name = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';
      const rawParent = parentCol >= 0 ? String(row[parentCol] || '').trim() : '';
      const parentPhone = this.normalizeImportPhone(rawParent);
      const rawStudent = studentCol >= 0 ? String(row[studentCol] || '').trim() : '';
      const studentPhone = this.normalizeImportPhone(rawStudent);
      const code = codeCol >= 0 ? String(row[codeCol] || '').trim() : '';
      const feeRaw = feeCol >= 0 ? String(row[feeCol] || '').trim().replace(/[^\d.-]/g, '') : '';
      const feeOverride = feeRaw.length > 0 && !isNaN(Number(feeRaw)) ? Number(feeRaw) : undefined;

      if (!name) {
        skippedRows.push({ row: i + 1, reason: 'اسم الطالب مفقود' });
        continue;
      }

      if (!parentPhone || !this.isImportPhoneValid(parentPhone)) {
        skippedRows.push({
          row: i + 1,
          name,
          reason: 'رقم ولي الأمر غير صالح (يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ومكون من 11 رقماً)',
        });
        continue;
      }

      // Check code uniqueness within batch and against existing DB students
      if (code) {
        if (seenBatchCodes.has(code)) {
          skippedRows.push({
            row: i + 1,
            name,
            reason: `كود الطالب (${code}) مكرر في الملف نفسه. لا يمكن تكرار الأكواد.`,
          });
          continue;
        }
        if (existingCodeMap.has(code)) {
          skippedRows.push({
            row: i + 1,
            name,
            reason: `كود الطالب (${code}) مسجل بالفعل في المنصة للطالب "${existingCodeMap.get(code)}". لا يمكن تكرار الأكواد.`,
          });
          continue;
        }
        seenBatchCodes.add(code);
      }

      validStudents.push({
        name,
        parent_phone: parentPhone,
        student_phone: (studentPhone && this.isImportPhoneValid(studentPhone)) ? studentPhone : undefined,
        code: code || undefined,
        fee_override: feeOverride,
      });
    }

    if (validStudents.length === 0) {
      this.showToast('لم يتم العثور على أي طلاب صالحين للاستيراد بالأعمدة المحددة', 'danger');
      return;
    }

    // Show active in-modal loading spinner so the user sees continuous progress
    const modalBody = document.querySelector('#centrlyModal .modal-body') || document.querySelector('.modal-body');
    const modalFooter = document.querySelector('#centrlyModal .modal-footer') || document.querySelector('.modal-footer');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem;">
          <div class="spinner" style="width: 52px; height: 52px; border-width: 4px; margin: 0 auto 1.5rem auto; border-color: #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">
            جاري استيراد وحفظ بيانات الطلاب...
          </h3>
          <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 1.5rem;">
            يتم الآن معالجة (${validStudents.length}) طالب وتسجيلهم في قاعدة البيانات وتوليد أكوادهم وباركود الحضور. يُرجى الانتظار وعدم إغلاق الصفحة.
          </p>
          <div style="background: #e2e8f0; border-radius: 9999px; height: 8px; width: 280px; margin: 0 auto; overflow: hidden; position: relative;">
            <div style="background: #2563eb; height: 100%; width: 100%; border-radius: 9999px; animation: pulse 1.5s ease-in-out infinite;"></div>
          </div>
        </div>
      `;
    }
    if (modalFooter) {
      modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" disabled style="opacity: 0.6; cursor: not-allowed; font-weight: 700;">
          جاري الحفظ في النظام... ⏳
        </button>
      `;
    }

    try {
      const res = await request(`/groups/${groupId}/students/import`, {
        method: 'POST',
        body: {
          rows: validStudents,
        },
      });

      const importedCount = res?.imported_count ?? 0;
      const skippedCount = (res?.skipped_count ?? 0) + skippedRows.length;

      if (importedCount > 0) {
        // Success state inside modal
        if (modalBody) {
          modalBody.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1.5rem;">
              <div style="font-size: 3.5rem; margin-bottom: 0.75rem;">🎉</div>
              <h3 style="font-size: 1.35rem; font-weight: 900; color: #16a34a; margin-bottom: 0.5rem;">
                تم استيراد وإضافة (${importedCount}) طالب بنجاح!
              </h3>
              <p style="font-size: 0.9rem; color: #475569; margin-bottom: 1rem;">
                تم تسجيل كافة بيانات الطلاب وتوليد أكوادهم وباركود الحضور الخاص بهم بنجاح.
              </p>
              ${skippedCount > 0 ? `
                <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 0.75rem 1rem; color: #92400e; font-size: 0.85rem; font-weight: 700; margin-top: 0.5rem; text-align: right;">
                  ⚠️ تم تخطي (${skippedCount}) سجل لعدم اكتمال بياناتها أو تكرارها.
                </div>
              ` : ''}
            </div>
          `;
        }
        if (modalFooter) {
          modalFooter.innerHTML = `
            <button type="button" class="btn btn-primary" onclick="window.centrlyApp.closeModal()" style="font-weight: 800; padding: 0.6rem 2.5rem;">
              تم ومتابعة ✓
            </button>
          `;
        }

        this.showToast(`تم استيراد وإضافة (${importedCount}) طالب بنجاح! 🎉`, 'success');

        if (Array.isArray(res?.imported_students) && res.imported_students.length > 0) {
          this.students = [...res.imported_students, ...(this.students || [])];
        }

        await this.loadRouteData('students');
      } else {
        // Zero students imported: detailed diagnostic feedback
        const errorsList = (res?.errors || []).slice(0, 5).map(e => `<li>صف ${e.row}: ${escapeHtml(e.error)}</li>`).join('');
        if (modalBody) {
          modalBody.innerHTML = `
            <div style="text-align: center; padding: 2rem 1.5rem;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
              <h3 style="font-size: 1.25rem; font-weight: 900; color: #dc2626; margin-bottom: 0.5rem;">
                لم يتم استيراد أي طالب (0 طالب)
              </h3>
              <p style="font-size: 0.88rem; color: #64748b; margin-bottom: 1rem; line-height: 1.5;">
                تعذر حفظ السجلات في قاعدة البيانات. يُرجى مراجعة الأعمدة والتأكد من تحديد عمود اسم الطالب وعمود رقم ولي الأمر بشكل صحيح.
              </p>
              ${errorsList ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 0.75rem 1rem; text-align: right; font-size: 0.82rem; color: #b91c1c; margin-bottom: 1rem;">
                  <div style="font-weight: 700; margin-bottom: 0.3rem;">أمثلة على تنبيهات الفحص:</div>
                  <ul style="margin: 0; padding-right: 1.25rem;">${errorsList}</ul>
                </div>
              ` : ''}
            </div>
          `;
        }
        if (modalFooter) {
          modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
            <button type="button" class="btn btn-primary" onclick="window.centrlyApp.renderColumnMappingModal()" style="font-weight: 700;">
              ← رجوع وتعديل مطابقة الأعمدة
            </button>
          `;
        }
        this.showToast('لم يتم إضافة أي طالب. يرجى مراجعة مطابقة الأعمدة.', 'warning');
      }
    } catch (err) {
      console.error('Import students bulk error:', err);
      if (modalBody) {
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 2rem 1.5rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
            <h3 style="font-size: 1.25rem; font-weight: 900; color: #dc2626; margin-bottom: 0.5rem;">
              حدث خطأ أثناء الاستيراد
            </h3>
            <p style="font-size: 0.88rem; color: #64748b; margin-bottom: 1rem;">
              ${escapeHtml(err.message || 'تعذر الاتصال بالخادم لحفظ الطلاب')}
            </p>
          </div>
        `;
      }
      if (modalFooter) {
        modalFooter.innerHTML = `
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>
          <button type="button" class="btn btn-primary" onclick="window.centrlyApp.renderColumnMappingModal()" style="font-weight: 700;">
            ← إعادة المحاولة
          </button>
        `;
      }
      this.showToast('حدث خطأ أثناء الاستيراد: ' + (err.message || 'تعذر حفظ الطلاب'), 'danger');
    }
  }

  app.handleImportStudents = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    this.handleImportParseStep();
  }
}
