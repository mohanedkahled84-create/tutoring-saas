-- Fix Row Level Security policies for study_materials and message_templates
-- Ensures backend operations (which authenticate with anon or service keys) can create and manage study materials and message templates.

DO $$
BEGIN
  -- 1. study_materials
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'study_materials' AND policyname = 'Public full access to study_materials'
  ) THEN
    CREATE POLICY "Public full access to study_materials" ON study_materials
      FOR ALL TO public
      USING (true)
      WITH CHECK (true);
  END IF;

  -- 2. message_templates
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'message_templates' AND policyname = 'Public full access to message_templates'
  ) THEN
    CREATE POLICY "Public full access to message_templates" ON message_templates
      FOR ALL TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
