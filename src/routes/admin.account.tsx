import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateAndUpdatePassword, clearMustChangePassword } from "@/api_functions/admin.functions";

export const Route = createFileRoute("/admin/account")({
  head: () => ({ meta: [{ title: "Account — Cognivus Admin" }] }),
  component: AdminAccount,
});

// ── Password policy constants (mirrored from server) ─────────────────────────
// Client-side enforcement is UX-only. The server re-validates in
// validateAndUpdatePassword() — this cannot be bypassed via direct API calls.
const MIN_LENGTH = 12;

function checkStrength(pw: string) {
  return {
    length: pw.length >= MIN_LENGTH,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 text-xs ${
        ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </li>
  );
}

function AdminAccount() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = checkStrength(password);
  const allPass = Object.values(strength).every(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side guards (UX — not a security boundary)
    if (!allPass) {
      toast.error("Password does not meet all requirements.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }

    setBusy(true);

    try {
      // SECURITY: Retrieve the current session JWT to authenticate the
      // server-side password update. The token is sent in the Authorization
      // header only — never in the request body or URL.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error("Session expired. Please sign in again.");
        setBusy(false);
        return;
      }

      // SECURITY: Password update goes through the server function which:
      //   1. Re-validates the JWT (auth middleware)
      //   2. Re-validates the password policy server-side
      //   3. Calls supabase.auth.admin.updateUserById() — Supabase stores
      //      only a bcrypt hash, never the plaintext password
      // This prevents bypassing client-side policy checks via direct API calls.
      const result = await validateAndUpdatePassword({
        data: { password },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!result.ok) {
        toast.error(result.error ?? "Password update failed.");
        setBusy(false);
        return;
      }

      // Clear the must_change_password flag (fire-and-forget; non-blocking)
      void clearMustChangePassword({
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});

      toast.success("Password updated successfully.");
      setPassword("");
      setConfirm("");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground shadow-soft">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account</h1>
          <p className="text-sm text-muted-foreground">Change your admin password.</p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft"
        autoComplete="off"
      >
        <div>
          <label htmlFor="new-password" className="text-sm font-medium">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            name="new-password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {password.length > 0 && (
            <ul className="mt-2 space-y-1">
              <Rule ok={strength.length} label={`At least ${MIN_LENGTH} characters`} />
              <Rule ok={strength.upper} label="Uppercase letter" />
              <Rule ok={strength.lower} label="Lowercase letter" />
              <Rule ok={strength.digit} label="Number" />
              <Rule ok={strength.special} label="Special character (!@#$…)" />
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="confirm-password" className="text-sm font-medium">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            name="confirm-password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {confirm.length > 0 && password !== confirm && (
            <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || !allPass || password !== confirm}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
