-- Preserve the original signed session expiry across a domain transfer.
alter table public.portal_handoffs add column session_expires_at bigint not null
  default (extract(epoch from now())::bigint + 31536000);
