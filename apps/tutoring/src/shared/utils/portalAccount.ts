import type {SupabaseClient} from '@supabase/supabase-js';
import {verifyParentPortalToken} from './tokens.js';
import {verifiedPortalStudent} from './portalDestination.js';
import {normalizeMaterialUrl} from '../../features/materials/routes.js';
import {mergeLegacyPortalQuizzes, stripQuizAnswers as removeQuizAnswerKeys} from './legacyPortalQuizzes.js';
import {signHomeworkFile} from '../../features/homework/files.js';

export function parentMonitorPayload(data:any) {
  const pick=(value:any,keys:string[])=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
  return {
    student:pick(data.student,['id','tenant_id','name','student_code','group_name','teacher_name','subject_name','teacher_phone']),
    teacher_phone:data.teacher_phone,
    summary:pick(data.summary,['total_sessions','attended_count','absent_count','attendance_rate','quiz_average_percentage']),
    sessions:(data.sessions || []).map((row:any)=>pick(row,['session_number','session_date','attended','homework_status','comment'])),
    quizzes:(data.quizzes || []).map((row:any)=>({...pick(row,['id','title','score','max_score','percentage','tier','note']),date:row.date || row.quiz_date || ''})),
    materials:(data.materials || []).filter((row:any)=>row.is_homework || row.type==='homework').map((row:any)=>pick(row,['id','title','type','is_homework','submission_status','submitted_at','due_date'])),
  };
}

// verifiedContext is exclusively server-owned, from an atomically redeemed handoff.
export async function loadPortalAccount(supabase:SupabaseClient,token:string,monitorOnly=false,verifiedContext?:any) {
  const verified = verifyParentPortalToken(token);

  const studentId = verified?.student_id || null;
  const tenantId = verified?.tenant_id || null;

    const contextRequest = () => verifiedPortalStudent(supabase, token)
      .then(data => ({ data, error: null }), error => ({ data: null, error }));
    // Independent, verified identity/context and account payload reads run together.
    const contextFlight = verifiedContext ? Promise.resolve({data:verifiedContext,error:null}) : verified ? contextRequest() : null;
    const { data: portalData, error: rpcError } = await supabase.rpc("get_parent_portal_payload", {
      p_token: token,
      p_student_id: studentId,
      p_tenant_id: tenantId,
    });

    if (rpcError) throw Object.assign(new Error('تعذر تحديث البيانات مؤقتًا. يرجى إعادة المحاولة.'),{status:503});
    if (!portalData) throw Object.assign(new Error('رابط المتابعة غير صالح أو منتهي الصلاحية.'),{status:401});

    const contextResult = await (contextFlight || contextRequest());
    if (contextResult.error) throw contextResult.error;
    const context = contextResult.data;
    if (!context || context.id !== portalData.student?.id) {
      throw Object.assign(new Error('رابط المتابعة غير صالح'),{status:401});
    }
    portalData.student.tenant_id = context.tenant_id;
    // Run the small aggregate alongside material enrichment, not after it.
    const rankResult = monitorOnly ? Promise.resolve(null) : supabase.rpc("get_portal_monthly_group_rank", {
      p_student_id: context.id, p_tenant_id: context.tenant_id,
    }).abortSignal(AbortSignal.timeout(2500)).then(({ data, error }) => !error ? data : null, () => null);

    if (!monitorOnly && portalData && Array.isArray(portalData.materials)) {
      portalData.materials = portalData.materials.map((m: any) => {
        let questions = m.questions;
        if (m.type === "online_quiz" && questions) {
          try {
            const parsed = typeof questions === "string" ? JSON.parse(questions) : questions;
            const sanitized = removeQuizAnswerKeys(parsed);
            questions = typeof m.questions === "string" ? JSON.stringify(sanitized) : sanitized;
          } catch {
            questions = null;
          }
        }
        return {
          ...m,
          ...(m.type === "online_quiz" ? { questions } : {}),
          url: normalizeMaterialUrl(m.url),
          submission_url: normalizeMaterialUrl(m.submission_url),
        };
      });
    }

    if (portalData && portalData.student) {
      try {
        // Context contains only memberships whose group and student share this tenant.
        // Legacy capability tokens use the same exact-token verification as signed sessions.
        const studentId = context.id, tenantId = context.tenant_id;
        if (studentId && tenantId) {
          const allowedGroupIds = new Set<string>(context.group_ids || []);

          if (allowedGroupIds.size > 0) {
            const { data: legacy, error: legacyError } = await supabase.rpc("portal_legacy_quiz_payload", {
              p_student_id: studentId, p_tenant_id: tenantId,
              p_student_code: String(portalData.student.student_code || portalData.student.code || "").trim(),
            });
            if (legacyError) throw legacyError;
            mergeLegacyPortalQuizzes(portalData, legacy?.definitions || [], allowedGroupIds, legacy?.submissions || [], monitorOnly);
          }
        }

        const teacherPhone = portalData.teacher_phone || portalData.student.teacher_phone || context.teacher_phone || "";
        if (teacherPhone) {
          portalData.student.teacher_phone = teacherPhone;
          portalData.teacher_phone = teacherPhone;
        }
      } catch (_) {}
    }

    const fileTenantId = context.tenant_id;
    const fileStudentId = context.id;
    if (portalData.summary?.total_sessions === 0) portalData.summary.attendance_rate = "لا توجد بيانات";
    if (!monitorOnly && Array.isArray(portalData.materials) && fileStudentId && fileTenantId) {
      portalData.materials = await Promise.all(portalData.materials.map(async (material: any) => ({
        ...material,
        submission_url: await signHomeworkFile(supabase, material.submission_url, fileTenantId!, material.id, fileStudentId),
      })));
    }
    const rank = await rankResult;
    if (rank && portalData.summary) Object.assign(portalData.summary, rank);
    return monitorOnly ? parentMonitorPayload(portalData) : portalData;
}
