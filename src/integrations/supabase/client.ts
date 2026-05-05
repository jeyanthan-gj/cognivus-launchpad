import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['VITE_SUPABASE_URL'] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ['VITE_SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Ensure these are set in your .env file.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  // SECURITY: Only the anon/publishable key is used here. This key is safe to
  // expose to the browser because Supabase's Row Level Security (RLS) policies
  // enforce access control. The service-role key (which bypasses RLS) is
  // exclusively read in server-only code (client.server.ts) via process.env
  // and is never bundled into the client-side JavaScript.
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // SECURITY: Use localStorage for session persistence (standard for SPAs).
      // Sessions are scoped to the origin and not accessible cross-origin.
      // The JWT is validated server-side on every protected server function call.
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      // SECURITY: detect session in URL hash (for OAuth/magic-link flows)
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
