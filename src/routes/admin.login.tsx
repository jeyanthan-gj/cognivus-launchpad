import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import logoSrc from "@/assets/logo.png";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminReady, checkLoginRateLimit, recordFailedLogin } from "@/api_functions/admin.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — Cognivus" }] }),
  component: AdminLogin,
});

// ── Client-side rate limiting ─────────────────────────────────────────────────
// This is a UX convenience only — the server enforces the same limits.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function getRateLimit() {
  try {
    const raw = sessionStorage.getItem("__al");
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    return JSON.parse(raw) as { attempts: number; lockedUntil: number };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function setRateLimit(attempts: number, lockedUntil: number) {
  try {
    sessionStorage.setItem("__al", JSON.stringify({ attempts, lockedUntil }));
  } catch {
    // sessionStorage unavailable — server-side limits still apply
  }
}

type Status = { state: "checking" } | { state: "ready" } | { state: "no-admin" } | { state: "error" };

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ state: "checking" });
  const [lockedUntil, setLockedUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect already-authenticated users immediately
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/admin" });
    });
  }, [navigate]);

  // Check whether any admin account exists
  useEffect(() => {
    void getAdminReady()
      .then((res) => setStatus(res.ready ? { state: "ready" } : { state: "no-admin" }))
      .catch(() => setStatus({ state: "error" }));
  }, []);

  // Restore client-side lockout from sessionStorage on mount
  useEffect(() => {
    const { lockedUntil: saved } = getRateLimit();
    if (saved > Date.now()) setLockedUntil(saved);
  }, []);

  // Countdown timer for lockout display
  useEffect(() => {
    if (lockedUntil <= 0) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(0);
        setSecondsLeft(0);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setSecondsLeft(remaining);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lockedUntil]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side lockout check (UX only — server re-validates)
    const rl = getRateLimit();
    if (rl.lockedUntil > Date.now()) {
      const secs = Math.ceil((rl.lockedUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Try again in ${secs}s.`);
      return;
    }

    setBusy(true);

    try {
      // ── 1. Server-side rate limit check ────────────────────────────────────
      const limitResult = await checkLoginRateLimit({ data: { identifier: email } });
      if (!limitResult.allowed) {
        const newLockedUntil = Date.now() + (limitResult.retryAfterSeconds ?? LOCKOUT_MS / 1000) * 1000;
        setLockedUntil(newLockedUntil);
        setRateLimit(MAX_ATTEMPTS, newLockedUntil);
        toast.error(`Too many failed attempts. Try again in ${limitResult.retryAfterSeconds}s.`);
        setBusy(false);
        return;
      }

      // ── 2. Supabase authentication ─────────────────────────────────────────
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        // Record the failure server-side for rate limiting
        await recordFailedLogin({ data: { identifier: email } });

        // Update client-side counter
        const newAttempts = rl.attempts + 1;
        const newLockedUntil = newAttempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
        setRateLimit(newAttempts, newLockedUntil);
        if (newLockedUntil) setLockedUntil(newLockedUntil);

        // Generic error — never reveal whether the email exists
        toast.error("Invalid email or password.");
        setBusy(false);
        return;
      }

      // ── 3. Success ─────────────────────────────────────────────────────────
      // Clear client-side rate limit counter on successful login
      setRateLimit(0, 0);
      void navigate({ to: "/admin" });

    } catch {
      toast.error("An unexpected error occurred. Please try again.");
      setBusy(false);
    }
  }

  const isLocked = lockedUntil > Date.now();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/">
            <img src={logoSrc} alt="Cognivus" className="mx-auto h-10 w-auto" />
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Admin Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage your Cognivus site.
          </p>
        </div>

        {status.state === "checking" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking setup…
          </div>
        )}

        {status.state === "no-admin" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">No admin account found</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Run <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">npx tsx scripts/provision-admin.ts</code> to create one.
              </p>
            </div>
          </div>
        )}

        {status.state === "error" && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-destructive">Could not connect. Check your configuration.</p>
          </div>
        )}

        {isLocked && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-destructive">
              Too many failed attempts. Try again in <strong>{secondsLeft}s</strong>.
            </p>
          </div>
        )}

        {(status.state === "ready" || status.state === "no-admin") && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft"
            autoComplete="off"
          >
            <div>
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy || isLocked}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy || isLocked}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={busy || isLocked || status.state !== "ready"}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant disabled:opacity-60"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>
        )}

        {status.state === "ready" && (
          <p className="text-center text-xs text-muted-foreground">
            <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-500" />
            Admin account configured
          </p>
        )}
      </div>
    </div>
  );
}
