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

// Client-side rate limiting: max 5 attempts per 15-minute window
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
    // sessionStorage unavailable — fail open (server-side Supabase rate limits still apply)
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
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  // Check if at least one admin exists — no credentials exposed
  useEffect(() => {
    let cancelled = false;
    void getAdminReady()
      .then((r) => {
        if (!cancelled) setStatus(r.ready ? { state: "ready" } : { state: "no-admin" });
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "error" });
      });
    return () => { cancelled = true; };
  }, []);

  // Restore lockout state from sessionStorage on mount
  useEffect(() => {
    const { lockedUntil: lu } = getRateLimit();
    if (lu > Date.now()) startLockoutTimer(lu);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startLockoutTimer(until: number) {
    setLockedUntil(until);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(0);
        setSecondsLeft(0);
        clearInterval(timerRef.current!);
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const isLocked = lockedUntil > Date.now();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    const rl = getRateLimit();
    if (rl.lockedUntil > Date.now()) {
      startLockoutTimer(rl.lockedUntil);
      return;
    }

    // Basic email format guard before hitting the server
    if (!email.trim().includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }

    setBusy(true);

    // Server-side rate limit check — enforced independent of client state
    const rateLimitResult = await checkLoginRateLimit({ data: { identifier: email } }).catch(() => null);
    if (rateLimitResult && !rateLimitResult.allowed) {
      const until = Date.now() + (rateLimitResult.retryAfterSeconds ?? LOCKOUT_MS / 1000) * 1000;
      setRateLimit(MAX_ATTEMPTS, until);
      startLockoutTimer(until);
      toast.error("Too many failed attempts. Locked for 15 minutes.");
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);

    if (error) {
      // Record failed attempt server-side (hashed — no plaintext stored)
      void recordFailedLogin({ data: { identifier: email } }).catch(() => {});

      // Also increment client-side counter
      const newAttempts = rl.attempts + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setRateLimit(newAttempts, until);
        startLockoutTimer(until);
        toast.error("Too many failed attempts. Locked for 15 minutes.");
      } else {
        setRateLimit(newAttempts, 0);
        // Use a generic message — never expose whether email exists
        toast.error(`Invalid credentials. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
      }
      return;
    }

    // Success — clear the counter
    setRateLimit(0, 0);
    navigate({ to: "/admin" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <Link to="/" className="flex items-center justify-center gap-2 font-semibold">
          <img src={logoSrc} alt="Cognivus" className="h-8 w-auto rounded-md" />
          Cognivus Admin
        </Link>
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight">Sign in</h1>

        {/* System status indicator — no credential info exposed */}
        <div className="mt-5">
          {status.state === "checking" && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying system status…
            </div>
          )}
          {status.state === "ready" && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              System ready.
            </div>
          )}
          {status.state === "no-admin" && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No admin account found. Run the provisioning script to create one.
            </div>
          )}
          {status.state === "error" && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Unable to reach the server. Check your connection.
            </div>
          )}
          {isLocked && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Too many attempts — locked for {Math.floor(secondsLeft / 60)}m {secondsLeft % 60}s.
            </div>
          )}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" autoComplete="on">
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
              disabled={isLocked || busy}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLocked || busy}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={busy || isLocked || status.state === "checking"}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <Link to="/" className="mt-6 block text-center text-xs text-muted-foreground hover:text-foreground">
          ← Back to website
        </Link>
      </div>
    </div>
  );
}
