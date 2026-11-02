import {AsyncLocalStorage} from 'node:async_hooks';
import type {SupabaseClient} from '@supabase/supabase-js';

// Each delegated request and any work it starts keeps its own guarded client.
// Normal owner/internal requests never enter this store.
export const delegatedClientScope=new AsyncLocalStorage<SupabaseClient>();
