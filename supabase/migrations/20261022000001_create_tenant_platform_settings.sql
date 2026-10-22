-- Migration: 20261022000001_create_tenant_platform_settings.sql
-- Description: Create tenant_platform_settings table for white-label teacher portals with subdomains and branding

CREATE TABLE IF NOT EXISTS public.tenant_platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    subdomain VARCHAR(60) UNIQUE NOT NULL,
    display_title VARCHAR(150) NOT NULL,
    subject_title VARCHAR(150) NOT NULL,
    headline_text TEXT,
    subtitle_text TEXT,
    cutout_avatar_url TEXT,
    theme_preset VARCHAR(30) DEFAULT 'navy' NOT NULL,
    custom_primary_color VARCHAR(10),
    is_active BOOLEAN DEFAULT true NOT NULL,
    allow_public_signup BOOLEAN DEFAULT true NOT NULL,
    require_approval BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for instant lookup by subdomain on public visitor hits
CREATE INDEX IF NOT EXISTS idx_tenant_platform_settings_subdomain ON public.tenant_platform_settings (LOWER(subdomain));
CREATE INDEX IF NOT EXISTS idx_tenant_platform_settings_tenant_id ON public.tenant_platform_settings (tenant_id);

-- Enable RLS
ALTER TABLE public.tenant_platform_settings ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Policy: Anyone (anon or authenticated) can view active platform settings by subdomain
-- This allows students and visitors to see the teacher's branded landing page and login form
DROP POLICY IF EXISTS "Public read platform settings by subdomain" ON public.tenant_platform_settings;
CREATE POLICY "Public read platform settings by subdomain"
ON public.tenant_platform_settings
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 2. Teacher Management Policy: Teachers can only view, insert, update or delete their own tenant's settings
DROP POLICY IF EXISTS "Tenant owners manage platform settings" ON public.tenant_platform_settings;
CREATE POLICY "Tenant owners manage platform settings"
ON public.tenant_platform_settings
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at_tenant_platform_settings()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_tenant_platform_settings ON public.tenant_platform_settings;
CREATE TRIGGER set_timestamp_tenant_platform_settings
BEFORE UPDATE ON public.tenant_platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at_tenant_platform_settings();
