-- ============================================================================
-- Migration: 20260924000001_fix_study_materials_permanent_public_urls.sql
-- Description: Converts any legacy signed temporary URLs (/object/sign/...)
--              in study_materials table to permanent public URLs (/object/public/...)
--              to prevent JWT expiration ("exp" claim timestamp check failed).
-- ============================================================================

UPDATE study_materials
SET url = split_part(replace(url, '/storage/v1/object/sign/homework-submissions/', '/storage/v1/object/public/homework-submissions/'), '?', 1)
WHERE url LIKE '%/storage/v1/object/sign/homework-submissions/%';
