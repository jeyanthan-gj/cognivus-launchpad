import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// ── Security: token length bounds ────────────────────────────────────────────
// JWTs are typically 300–1000 chars. Reject anything outside a sane range to
// prevent log-flooding and CPU exhaustion from huge payloads.
const TOKEN_MIN_LEN = 20;
const TOKEN_MAX_LEN = 2048;

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {

    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    // SECURITY: use the anon/publishable key for token verification — never the
    // service-role key. The service-role key bypasses RLS and must only be used
    // in admin-scoped server functions (client.server.ts), never here.
    const SUPABASE_PUBLISHABLE_KEY =
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ['SUPABASE_URL (or VITE_SUPABASE_URL)'] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)'] : []),
      ];
      // Log server-side only — never forward internal error details to the client
      console.error(`[auth-middleware] Missing env vars: ${missing.join(', ')}`);
      throw new Response('Internal server error', { status: 500 });
    }

    const request = getRequest();

    if (!request?.headers) {
      throw new Response('Unauthorized', { status: 401 });
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Response('Unauthorized', { status: 401 });
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.slice(7); // safer than .replace('Bearer ', '')

    // Reject tokens outside reasonable length bounds
    if (!token || token.length < TOKEN_MIN_LEN || token.length > TOKEN_MAX_LEN) {
      throw new Response('Unauthorized', { status: 401 });
    }

    // Basic structural sanity check: JWTs have exactly 3 dot-separated parts
    if (token.split('.').length !== 3) {
      throw new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Verify the token cryptographically via Supabase's JWKS endpoint.
    // getClaims() validates signature + expiry — reject expired/tampered tokens.
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      throw new Response('Unauthorized', { status: 401 });
    }

    const { sub: userId, exp } = data.claims as { sub?: string; exp?: number };

    if (!userId) {
      throw new Response('Unauthorized', { status: 401 });
    }

    // Double-check expiry in case the SDK ever changes leniency behaviour
    if (!exp || exp * 1000 < Date.now()) {
      throw new Response('Unauthorized: session expired', { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId,
        claims: data.claims,
      },
    });
  }
);
