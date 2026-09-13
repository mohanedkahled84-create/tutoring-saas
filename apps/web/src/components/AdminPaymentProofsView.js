import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Centrly Superadmin - Payment Proofs Review View
 * Allows platform administrators to review incoming transfer receipts,
 * zoom into screenshots, and approve or reject subscriptions with 1 click.
 */

function formatArabicDate(dateStr) {
  if (!dateStr) return 'غير محدد';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} - ${timeStr}`;
  } catch {
    return dateStr;
  }
}

export function renderAdminPaymentProofsView(data = {}, currentFilter = 'pending') {
  const proofs = data.payment_proofs || [];
  const filter = currentFilter || 'pending';

  const pendingCount = proofs.filter(p => p.status === 'pending').length;
  const approvedCount = proofs.filter(p => p.status === 'approved').length;
  const rejectedCount = proofs.filter(p => p.status === 'rejected').length;

  const filteredProofs = proofs.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      
      <!-- Top Action Bar -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #fff; border: none; border-radius: 16px; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('billing', 24, '#38bdf8')}</span>
              <h2 style="margin: 0; font-size: 1.3rem; font-weight: 900; color: #fff;">
                مراجعة وتأكيد إيصالات التحويل (Payment Proofs)
              </h2>
              <span class="badge" style="background: #0284c7; color: #fff; font-weight: 700;">
                خاص بالإدارة العليا
              </span>
            </div>
            <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 0.35rem;">
              مراجعة اسكرينات تحويلات إنستاباي والمحافظ الإلكترونية، واعتماد الاشتراكات الشهرية والسنوية بضغطة زر.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.refreshAdminPaymentProofs()" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); color: #fff; display: inline-flex; align-items: center; gap: 0.35rem;">
              ${getIcon('refresh', 14)}
              <span>تحديث القائمة</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('admin-dashboard')" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
              ${getIcon('dashboard', 14)}
              <span>لوحة الإدارة</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Status Filter Tabs -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; border-bottom: 2px solid var(--centrly-line); padding-bottom: 0.75rem;">
        <button type="button" 
          onclick="window.centrlyApp.setAdminProofsFilter('pending')"
          class="btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 10px;">
          <span>بانتظار المراجعة</span>
          <span style="background: ${filter === 'pending' ? '#f59e0b' : '#cbd5e1'}; color: ${filter === 'pending' ? '#0f172a' : '#334155'}; font-size: 0.75rem; font-weight: 900; padding: 0.1rem 0.45rem; border-radius: 9999px;">
            ${pendingCount}
          </span>
        </button>

        <button type="button" 
          onclick="window.centrlyApp.setAdminProofsFilter('approved')"
          class="btn ${filter === 'approved' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 10px;">
          <span>المعتمدة</span>
          <span style="background: ${filter === 'approved' ? '#10b981' : '#cbd5e1'}; color: #fff; font-size: 0.75rem; font-weight: 900; padding: 0.1rem 0.45rem; border-radius: 9999px;">
            ${approvedCount}
          </span>
        </button>

        <button type="button" 
          onclick="window.centrlyApp.setAdminProofsFilter('rejected')"
          class="btn ${filter === 'rejected' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 10px;">
          <span>المرفوضة</span>
          <span style="background: ${filter === 'rejected' ? '#ef4444' : '#cbd5e1'}; color: #fff; font-size: 0.75rem; font-weight: 900; padding: 0.1rem 0.45rem; border-radius: 9999px;">
            ${rejectedCount}
          </span>
        </button>

        <button type="button" 
          onclick="window.centrlyApp.setAdminProofsFilter('all')"
          class="btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 10px;">
          <span>جميع الإيصالات (${proofs.length})</span>
        </button>
      </div>

      <!-- Proofs List / Grid -->
      ${filteredProofs.length === 0 ? `
        <div class="card" style="text-align: center; padding: 3rem 1.5rem; color: var(--centrly-text);">
          <div style="margin-bottom: 0.75rem; display: flex; justify-content: center;">
            ${getIcon('check', 36, '#10b981')}
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.4rem;">
            لا توجد إيصالات في هذا التبويب
          </h3>
          <p style="font-size: 0.85rem; margin: 0;">
            ${filter === 'pending' ? 'تمت مراجعة جميع طلبات الدفع بنجاح، لا توجد طلبات معلقة حالياً.' : 'لا توجد عناصر مطابقة للفلتر المحدد.'}
          </p>
        </div>
      ` : `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem;">
          ${filteredProofs.map(proof => {
            const isPending = proof.status === 'pending';
            const isApproved = proof.status === 'approved';
            const tenantName = proof.tenants?.name || proof.tenant_name || 'مؤسسة تعليمية';
            const methodLabel = proof.payment_method === 'vodafone_cash' ? 'محفظة إلكترونية (فودافون كاش)' : 'إنستاباي (InstaPay)';
            const hasImage = Boolean(proof.proof_image_url);

            let statusBadge = '';
            if (isPending) {
              statusBadge = `<span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 800;">بانتظار المراجعة (Pending)</span>`;
            } else if (isApproved) {
              statusBadge = `<span class="badge" style="background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; font-weight: 800;">تم الاعتماد وتفعيل الاشتراك</span>`;
            } else {
              statusBadge = `<span class="badge" style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; font-weight: 800;">مرفوض</span>`;
            }

            return `
              <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between; border-radius: 14px; border: 1.5px solid ${isPending ? '#f59e0b' : 'var(--centrly-line)'}; box-shadow: ${isPending ? '0 8px 20px rgba(245, 158, 11, 0.12)' : 'none'};">
                
                <div>
                  <!-- Header: Tenant Name & Status -->
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.85rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
                    <div>
                      <h3 style="font-size: 1.1rem; font-weight: 900; color: var(--centrly-ink); margin: 0 0 0.25rem;">
                        ${escapeHtml(tenantName)}
                      </h3>
                      <div style="font-size: 0.775rem; color: #64748b; display: flex; align-items: center; gap: 0.3rem;">
                        ${getIcon('clock', 12)}
                        <span>${formatArabicDate(proof.created_at)}</span>
                      </div>
                    </div>
                    <div>${statusBadge}</div>
                  </div>

                  <!-- Details Grid -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-bottom: 1rem; background: #f8fafc; padding: 0.75rem; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.825rem;">
                    <div>
                      <span style="color: #64748b;">المبلغ المحول:</span>
                      <div style="font-size: 1.15rem; font-weight: 900; color: var(--centrly-blue-800); margin-top: 0.15rem;">
                        ${Number(proof.amount || 0).toLocaleString('ar-EG')} ج.م
                      </div>
                    </div>
                    <div>
                      <span style="color: #64748b;">طريقة الدفع:</span>
                      <div style="font-weight: 800; color: #0f172a; margin-top: 0.15rem;">
                        ${methodLabel}
                      </div>
                    </div>
                    <div style="grid-column: 1 / -1;">
                      <span style="color: #64748b;">رقم المحفظة / المرجع:</span>
                      <span style="font-weight: 800; font-family: monospace; color: #1e293b; margin-right: 0.35rem; direction: ltr; display: inline-block;">
                        ${escapeHtml(proof.reference_number || 'غير مسجل')}
                      </span>
                    </div>
                    ${proof.notes ? `
                      <div style="grid-column: 1 / -1;">
                        <span style="color: #64748b;">الباقة والملاحظات:</span>
                        <div style="font-weight: 700; color: #0369a1; margin-top: 0.15rem; background: #f0f9ff; padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid #bae6fd;">
                          ${escapeHtml(proof.notes)}
                        </div>
                      </div>
                    ` : ''}
                  </div>

                  <!-- Screenshot Thumbnail & Preview -->
                  <div style="margin-bottom: 1.15rem;">
                    <span style="font-size: 0.8rem; font-weight: 800; color: var(--centrly-ink); display: block; margin-bottom: 0.4rem;">
                      صورة إيصال التحويل (الاسكرين شوت):
                    </span>
                    
                    ${hasImage ? `
                      <div style="position: relative; border-radius: 10px; overflow: hidden; border: 1.5px solid #cbd5e1; background: #0f172a; cursor: pointer; max-height: 190px;" onclick="window.centrlyApp.openProofFullscreenModal('${proof.id}')">
                        <img id="proofThumb_${proof.id}" src="${proof.proof_image_url}" alt="إيصال التحويل" style="width: 100%; height: 180px; object-fit: contain; display: block; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <div style="position: absolute; bottom: 8px; left: 8px; right: 8px; background: rgba(15, 23, 42, 0.85); color: #fff; padding: 0.35rem 0.65rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                          ${getIcon('search', 14, '#38bdf8')}
                          <span>انقر لتكبير الاسكرين شوت بملء الشاشة</span>
                        </div>
                      </div>
                    ` : `
                      <div style="padding: 1rem; border: 1.5px dashed #cbd5e1; border-radius: 10px; text-align: center; color: #94a3b8; font-size: 0.8rem; background: #f8fafc;">
                        لم يتم إرفاق صورة (بيانات رقمية فقط)
                      </div>
                    `}
                  </div>
                </div>

                <!-- Admin Action Buttons -->
                ${isPending ? `
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 0.85rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                      <button type="button" class="btn btn-primary btn-sm" onclick="window.centrlyApp.handleApproveProof('${proof.id}', 30)" style="font-weight: 800; padding: 0.6rem; font-size: 0.825rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: #2563eb;">
                        ${getIcon('check', 14)}
                        <span>اعتماد 30 يوم</span>
                      </button>

                      <button type="button" class="btn btn-sm" onclick="window.centrlyApp.handleApproveProof('${proof.id}', 365)" style="font-weight: 800; padding: 0.6rem; font-size: 0.825rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: #059669; color: #fff; border: none; border-radius: 8px;">
                        ${getIcon('check', 14)}
                        <span>اعتماد سنة كاملة</span>
                      </button>
                    </div>

                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.handleRejectProofPrompt('${proof.id}')" style="font-weight: 700; padding: 0.45rem; font-size: 0.8rem; color: #dc2626; border-color: #fca5a5;">
                      رفض الإيصال
                    </button>
                  </div>
                ` : `
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 0.65rem; text-align: center; font-size: 0.775rem; color: #64748b;">
                    ${isApproved ? 'تم تفعيل الحساب وتمديد الاشتراك بنجاح.' : 'تم رفض هذا الطلب.'}
                  </div>
                `}

              </div>
            `;
          }).join('')}
        </div>
      `}

    </div>
  `;
}