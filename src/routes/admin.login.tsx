import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureDefaultAdmin, getAdminStatus } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — Cognivus" }] }),
  component: AdminLogin,
});

const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL = "admin@cognivus.local";

type Status =
  | { state: "checking" }
  | { state: "ready"; email: string }
  | { state: "missing-role"; email: string }
  | { state: "missing-user"; email: string }
  | { state: "error"; message: string };

function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(ADMIN_USERNAME);
  const [password, setPassword] = useState("admin@123");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Provision (idempotent), then read back the live status.
        await ensureDefaultAdmin().catch(() => {});
        const s = await getAdminStatus();
        if (cancelled) return;
        if (!s.exists) setStatus({ state: "missing-user", email: s.email });
        else if (!s.hasAdminRole) setStatus({ state: "missing-role", email: s.email });
        else setStatus({ state: "ready", email: s.email });
      } catch (e) {
        if (!cancelled) setStatus({ state: "error", message: (e as Error).message });
      }
    })();

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    // Map the "admin" username to the underlying email.
    const email = username.trim().toLowerCase() === ADMIN_USERNAME ? ADMIN_EMAIL : username.trim();

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/admin" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <Link to="/" className="flex items-center justify-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground shadow-soft">
            <BrainCircuit className="h-4 w-4" />
          </span>
          Cognivus Admin
        </Link>
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Default credentials: <code className="rounded bg-accent px-1">admin</code> /{" "}
          <code className="rounded bg-accent px-1">admin123</code>
        </p>

        <div className="mt-5">
          {status.state === "checking" && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking admin account…
            </div>
          )}
          {status.state === "ready" && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Admin access verified — <span className="font-mono">{status.email}</span> has the admin role.
            </div>
          )}
          {(status.state === "missing-role" || status.state === "missing-user") && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {status.state === "missing-user"
                  ? `Admin account ${status.email} is not provisioned yet. Refresh the page to retry.`
                  : `Account ${status.email} exists but is missing the admin role.`}
              </span>
            </div>
          )}
          {status.state === "error" && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Status check failed: {status.message}</span>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You can change the password from the dashboard after signing in.
        </p>

        <Link to="/" className="mt-6 block text-center text-xs text-muted-foreground hover:text-foreground">
          ← Back to website
        </Link>
      </div>
    </div>
  );
}
