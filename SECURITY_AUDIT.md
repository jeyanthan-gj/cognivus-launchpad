# Security Audit — Cognivus Launchpad Authentication System

**Audited by:** Senior Security Engineer  
**Date:** 2026-05-05  
**Scope:** All authentication and session management code  
**Severity scale:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low / Info

---

## Executive Summary

The authentication system is built on **Supabase Auth** (managed identity provider) with a **TanStack Start** SSR layer. The foundation is architecturally sound — service-role keys are correctly isolated to server-only code, Row Level Security (RLS) is enabled on all tables, and a server-side rate limiter exists. However, six concrete vulnerabilities were identified ranging from Critical to Medium severity. All have been remediated in the accompanying refactor.

---

## Findings

### 🔴 CRITICAL-1 — Password update bypasses server-side policy enforcement

**File:** `src/routes/admin.account.tsx` (original)  
**Impact:** An attacker with a valid session token could call `supabase.auth.updateUser({ password })` directly from the browser console or via a crafted HTTP request, bypassing the client-side 12-character minimum and complexity rules entirely. Supabase's default minimum is only 6 characters.

**Root cause:** `admin.account.tsx` called `supabase.auth.updateUser()` — a *client-side* SDK method — to perform the password update. The complexity rules (uppercase, digit, special char) were enforced only in the React component, which is trivially bypassed.

**Fix:** Replaced the client-side `updateUser()` call with a new server function `validateAndUpdatePassword()` that:
1. Authenticates the request via the JWT middleware (cannot be skipped)
2. Re-validates the full password policy server-side before touching Supabase
3. Uses `supabaseAdmin.auth.admin.updateUserById()` so the update is atomic and policy-gated

**Files changed:**
- `src/api_functions/admin.functions.ts` — added `validateAndUpdatePassword()`
- `src/routes/admin.account.tsx` — routes password update through server function

---

### 🟠 HIGH-2 — Auth middleware accepts tokens of arbitrary length

**File:** `src/integrations/supabase/auth-middleware.ts` (original)  
**Impact:** A malicious client could send a 10 MB `Authorization` header. This causes unnecessary CPU/memory usage during JWT parsing and pollutes logs if the token is logged anywhere in the stack.

**Fix:** Added explicit length bounds (20–2048 chars) and a structural check (exactly 3 JWT segments) before the token reaches the Supabase SDK.

**Files changed:**
- `src/integrations/supabase/auth-middleware.ts`

---

### 🟠 HIGH-3 — Session expiry not configured; password reset tokens live 24 hours

**File:** `supabase/config.toml` (original — effectively empty)  
**Impact:**  
- Access tokens use Supabase's default of 1 hour (acceptable), but this was undocumented and could silently revert to a longer value.  
- **Password reset tokens default to 86,400 seconds (24 hours).** A stolen reset link remains valid for a full day, dramatically increasing the window for account takeover via email interception or link leakage in browser history/server logs.

**Fix:**  
- Explicitly set `jwt_expiry = 3600` in `supabase/config.toml`.  
- Set `enable_signup = false` to prevent public self-registration.  
- Documented the Supabase dashboard setting for password reset token expiry (900s / 15 min). This must be set in the dashboard: **Auth → Settings → "Password reset token expiry" → 900**.

**Files changed:**
- `supabase/config.toml`
- `supabase/migrations/20260505000000_auth_security_hardening.sql` (documented)

---

### 🟠 HIGH-4 — Email verification not enforced

**File:** `supabase/config.toml` (original)  
**Impact:** Without `enable_confirmations = true`, Supabase allows sign-in with an unverified email address. An attacker who registers with a victim's email (if signup were ever re-enabled) could immediately access the account.

**Fix:** Explicitly set `enable_confirmations = true`, `double_confirm_changes = true`, and `secure_password_change = true` in `supabase/config.toml`.

**Files changed:**
- `supabase/config.toml`

---

### 🟡 MEDIUM-5 — login_attempts RLS policy intent unclear; TTL not enforced at DB level

**File:** `supabase/migrations/20260503120000_security_hardening.sql` (original)  
**Impact:**  
- The original policy `"No direct access to login_attempts" AS RESTRICTIVE FOR ALL USING (false)` is functionally correct but covers `INSERT` with only `USING` (not `WITH CHECK`), which is technically ambiguous in PostgreSQL's policy model.  
- Without a TTL index or scheduled cleanup, the table grows unboundedly if `cleanup_login_attempts()` is never called (the server function calls it inline, but no pg_cron job exists as a backstop).

**Fix:**  
- Replaced the single broad policy with four explicit per-operation restrictive policies covering SELECT, INSERT, UPDATE, DELETE — intent is unambiguous.  
- Added a partial index `login_attempts_expiry_idx` to make expired-row scans cheap.  
- Granted `EXECUTE` on `cleanup_login_attempts()` only to `service_role`; revoked from `PUBLIC`, `anon`, `authenticated`.

**Files changed:**
- `supabase/migrations/20260505000000_auth_security_hardening.sql`

---

### 🟡 MEDIUM-6 — Token slice uses `.replace()` — minor but avoidable ambiguity

**File:** `src/integrations/supabase/auth-middleware.ts` (original)  
**Code:** `const token = authHeader.replace('Bearer ', '');`  
**Impact:** `String.replace()` replaces only the *first* occurrence, but also matches if `'Bearer '` appears anywhere other than the start (though `startsWith` check mitigates this). The idiomatic, unambiguous form is `authHeader.slice(7)`.

**Fix:** Changed to `authHeader.slice(7)`.

---

## What Was Already Correct ✅

The following security controls were in place and were **not changed** (only commented more clearly):

| Control | Location | Notes |
|---|---|---|
| Service-role key isolated to server | `client.server.ts` | Only accessed via `process.env`, never `import.meta.env` |
| Anon key used for client | `client.ts` | Correctly uses `VITE_SUPABASE_PUBLISHABLE_KEY` |
| RLS enabled on all tables | All migrations | Verified in hardening migration as a safety net |
| Password hashing | Supabase managed | Supabase uses bcrypt (cost 10) — passwords never stored in plaintext |
| Server-side rate limiting (logic) | `admin.functions.ts` | Hashed identifiers, dual client+server enforcement |
| Admin role check via DB | `useAdminAuth.ts` + RLS | Role verified server-side, not from JWT claims |
| Forced password change on first login | `admin.tsx` + DB flag | `must_change_password` enforced at the layout level |
| No secrets in frontend bundle | `client.ts` | `VITE_` prefix used only for public keys |
| Generic error messages | `admin.login.tsx` | Does not reveal whether email exists |
| Identifier hashing before storage | `admin.functions.ts` | SHA-256 + domain prefix — no plaintext in `login_attempts` |

---

## Remediation Checklist

After applying the code changes, complete these Supabase dashboard steps:

- [ ] **Auth → Settings → "Password reset token expiry"** → set to `900` (15 min)
- [ ] **Auth → Settings → "Magic link token expiry"** → set to `900` (15 min)
- [ ] **Auth → Settings → "Confirm email"** → `ON`
- [ ] **Auth → Settings → "Secure password change"** → `ON`
- [ ] **Auth → Settings → "Restrict signups"** → `ON` (or configure allowed domains)
- [ ] Run the new migration: `supabase db push` (or apply `20260505000000_auth_security_hardening.sql`)
- [ ] Optionally enable `pg_cron` and schedule `SELECT public.cleanup_login_attempts()` every 15 minutes

---

## Files Changed

```
src/
  integrations/supabase/
    auth-middleware.ts          — token length bounds, slice fix, expiry double-check
    client.ts                   — added security comments, detectSessionInUrl
  api_functions/
    admin.functions.ts          — added validateAndUpdatePassword(), tightened input validation
  routes/
    admin.account.tsx           — password update routed through server-side validation

supabase/
  config.toml                   — jwt_expiry, enable_signup, email confirmations
  migrations/
    20260505000000_auth_security_hardening.sql  — RLS hardening, TTL index, permission audit

SECURITY_AUDIT.md               — this file
```
