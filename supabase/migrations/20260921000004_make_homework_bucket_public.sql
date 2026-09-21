-- ============================================================================
-- Migration: 20260921000004_make_homework_bucket_public.sql
-- Description: Ensures the homework-submissions storage bucket is set to public
--              so preview links (/storage/v1/object/public/...) can be viewed
--              by teachers and students without 404 NoSuchBucket errors.
-- ============================================================================

UPDATE storage.buckets
SET public = true
WHERE id = 'homework-submissions';
