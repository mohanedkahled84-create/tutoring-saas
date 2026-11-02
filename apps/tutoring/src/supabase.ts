import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./shared/config/index.js";
import {delegatedClientScope} from './shared/delegatedClient.js';

// Anonymous / public client
export const supabasePublic: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Factory function to get client scoped to a user JWT token (enforces RLS)
export function getScopedSupabaseClient(token: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Service role client (for internal / admin operations if key provided)
export function getServiceSupabaseClient(): SupabaseClient {
  const delegated=delegatedClientScope.getStore();if(delegated)return delegated;
  const key = config.supabaseServiceRoleKey || config.supabaseAnonKey;
  return createClient(config.supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
