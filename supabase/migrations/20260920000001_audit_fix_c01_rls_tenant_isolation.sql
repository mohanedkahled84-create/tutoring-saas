-- ============================================================================
-- Migration: 20260920000001_audit_fix_c01_rls_tenant_isolation.sql
-- Description: Fixes Security Audit C-01 by removing all permissive USING (true)
--              and WITH CHECK (true) policies on tenant-scoped tables.
--              Enforces strict tenant isolation for authenticated users and
--              restricts service_role access strictly to backend workers.
-- ============================================================================

-- 1. study_materials
DROP POLICY IF EXISTS "Public full access to study_materials" ON public.study_materials;
DROP POLICY IF EXISTS "study_materials_tenant_isolation" ON public.study_materials;
DROP POLICY IF EXISTS "study_materials_service_role" ON public.study_materials;
DROP POLICY IF EXISTS "study_materials_tenant_select" ON public.study_materials;
DROP POLICY IF EXISTS "study_materials_tenant_modify" ON public.study_materials;

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_materials_tenant_select"
  ON public.study_materials
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY "study_materials_tenant_modify"
  ON public.study_materials
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  )
  WITH CHECK (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  );

CREATE POLICY "study_materials_service_role"
  ON public.study_materials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.study_materials FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_materials TO authenticated;
GRANT ALL ON public.study_materials TO service_role;


-- 2. message_templates
DROP POLICY IF EXISTS "Public full access to message_templates" ON public.message_templates;
DROP POLICY IF EXISTS "Tenant users can view their message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Tenant users can manage their message templates" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_tenant_select" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_tenant_modify" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_service_role" ON public.message_templates;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_templates_tenant_select"
  ON public.message_templates
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY "message_templates_tenant_modify"
  ON public.message_templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  )
  WITH CHECK (
    tenant_id = get_current_user_tenant_id()
  );

CREATE POLICY "message_templates_service_role"
  ON public.message_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.message_templates FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;


-- 3. quizzes
DROP POLICY IF EXISTS "Tenant users full access to quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_tenant_select" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_tenant_modify" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_service_role" ON public.quizzes;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quizzes_tenant_select"
  ON public.quizzes
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY "quizzes_tenant_modify"
  ON public.quizzes
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  )
  WITH CHECK (
    tenant_id = get_current_user_tenant_id()
  );

CREATE POLICY "quizzes_service_role"
  ON public.quizzes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.quizzes FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;


-- 4. teachers
DROP POLICY IF EXISTS "Allow authenticated or backend insert on teachers" ON public.teachers;
DROP POLICY IF EXISTS "Allow authenticated or backend update on teachers" ON public.teachers;
DROP POLICY IF EXISTS "Allow authenticated or backend delete on teachers" ON public.teachers;
DROP POLICY IF EXISTS "teachers_service_role" ON public.teachers;

CREATE POLICY "teachers_service_role"
  ON public.teachers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.teachers FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;


-- 5. assistants
DROP POLICY IF EXISTS "Allow authenticated or backend insert on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend update on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend delete on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend select on assistants" ON public.assistants;
DROP POLICY IF EXISTS "assistants_service_role" ON public.assistants;

CREATE POLICY "assistants_service_role"
  ON public.assistants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.assistants FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistants TO authenticated;
GRANT ALL ON public.assistants TO service_role;


-- 6. rooms
DROP POLICY IF EXISTS "Allow authenticated or backend insert on rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow authenticated or backend update on rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow authenticated or backend delete on rooms" ON public.rooms;
DROP POLICY IF EXISTS "rooms_service_role" ON public.rooms;

CREATE POLICY "rooms_service_role"
  ON public.rooms
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.rooms FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;


-- 7. homework_submissions
DROP POLICY IF EXISTS "Public select homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Public update homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Public insert homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_tenant_select" ON public.homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_tenant_modify" ON public.homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_service_role" ON public.homework_submissions;

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homework_submissions_tenant_select"
  ON public.homework_submissions
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY "homework_submissions_tenant_modify"
  ON public.homework_submissions
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  )
  WITH CHECK (
    tenant_id = get_current_user_tenant_id()
  );

CREATE POLICY "homework_submissions_service_role"
  ON public.homework_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.homework_submissions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_submissions TO authenticated;
GRANT ALL ON public.homework_submissions TO service_role;


-- 8. Storage bucket protection
-- Ensure homework-submissions bucket is strictly private
UPDATE storage.buckets SET public = false WHERE id = 'homework-submissions';
