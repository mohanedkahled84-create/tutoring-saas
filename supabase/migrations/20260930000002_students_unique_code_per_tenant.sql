-- Migration: 20260930000002_students_unique_code_per_tenant.sql
-- Enforce unique student codes per tenant to prevent duplicate codes across students

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_tenant_code_unique 
ON public.students (tenant_id, code) 
WHERE code IS NOT NULL AND code <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_tenant_student_code_unique 
ON public.students (tenant_id, student_code) 
WHERE student_code IS NOT NULL AND student_code <> '';
