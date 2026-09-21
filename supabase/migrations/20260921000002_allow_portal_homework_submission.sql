-- ============================================================================
-- Migration: 20260921000002_allow_portal_homework_submission.sql
-- Description: Allows public student/parent portal homework queries and submissions
--              under RLS by granting select on homework materials, select on students
--              with active portal tokens, and insert/update on homework_submissions.
-- ============================================================================

-- 1. study_materials: allow anon to read homework materials
DROP POLICY IF EXISTS "study_materials_anon_select_homework" ON public.study_materials;
CREATE POLICY "study_materials_anon_select_homework"
  ON public.study_materials
  FOR SELECT
  TO anon
  USING (is_homework = true);

-- 2. students: allow anon to read students with portal token for validation
DROP POLICY IF EXISTS "students_anon_portal_select" ON public.students;
CREATE POLICY "students_anon_portal_select"
  ON public.students
  FOR SELECT
  TO anon
  USING (parent_portal_token IS NOT NULL);

-- 3. homework_submissions: allow anon to submit (insert/update) and select
DROP POLICY IF EXISTS "homework_submissions_anon_insert" ON public.homework_submissions;
CREATE POLICY "homework_submissions_anon_insert"
  ON public.homework_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "homework_submissions_anon_update" ON public.homework_submissions;
CREATE POLICY "homework_submissions_anon_update"
  ON public.homework_submissions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "homework_submissions_anon_select" ON public.homework_submissions;
CREATE POLICY "homework_submissions_anon_select"
  ON public.homework_submissions
  FOR SELECT
  TO anon
  USING (true);
