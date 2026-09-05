/**
 * Universal Student Search Bar Component (DEV-80)
 * Reusable across every page that lists students (Reports, StudentsView, TeacherDashboard, CenterOwnerDashboard).
 * Searches universally by student code/barcode, name, OR phone number.
 */

export function renderStudentSearchBar(options = {}) {
  const {
    id = "universalStudentSearch",
    placeholder = "🔍 ابحث بكود الطالب / الباركود، الاسم، أو رقم ولي الأمر...",
    value = "",
    onInputHandler = "window.centrlyApp.handleUniversalStudentSearch(this.value)",
    extraControlsHtml = "",
  } = options;

  return `
    <div class="student-search-bar-wrapper" style="display: flex; gap: 0.75rem; align-items: center; width: 100%; flex-wrap: wrap;">
      <div style="position: relative; flex: 1; min-width: 260px;">
        <input
          type="text"
          id="${id}"
          class="form-input"
          value="${value || ''}"
          placeholder="${placeholder}"
          style="width: 100%; padding-right: 2.25rem; font-size: 0.9rem;"
          oninput="${onInputHandler}"
          autocomplete="off"
        />
        <span style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--centrly-muted, #64748b); pointer-events: none;">
          🏷️
        </span>
      </div>
      ${extraControlsHtml || ''}
    </div>
  `;
}
