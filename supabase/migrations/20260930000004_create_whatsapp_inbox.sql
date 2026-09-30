-- Migration: 20260930000004_create_whatsapp_inbox.sql
-- Creates public.whatsapp_inbox table for tracking incoming and outgoing WhatsApp messages, replies, and status.

CREATE TABLE IF NOT EXISTS public.whatsapp_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  student_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_body TEXT NOT NULL,
  meta_message_id TEXT,
  status TEXT DEFAULT 'unread',
  has_replied BOOLEAN DEFAULT false,
  reply_body TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_tenant ON public.whatsapp_inbox(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_phone ON public.whatsapp_inbox(phone);

ALTER TABLE public.whatsapp_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on whatsapp_inbox" ON public.whatsapp_inbox;
CREATE POLICY "Allow all access on whatsapp_inbox"
ON public.whatsapp_inbox
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);
