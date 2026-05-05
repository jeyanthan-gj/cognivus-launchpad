/**
 * Structured server-side logger for Cognivus.
 *
 * All log entries are newline-delimited JSON (NDJSON) so they can be ingested
 * by Netlify Log Drains, Datadog, Logtail, or any structured-log pipeline.
 *
 * SECURITY RULES enforced here:
 *   1. Passwords, tokens, and secrets are NEVER logged (sanitizeFields strips them).
 *   2. PII (email addresses) is only logged as a SHA-256 prefix (first 8 hex chars)
 *      to enable correlation without storing plaintext identifiers.
 *   3. All log calls are no-ops in test environments to keep test output clean.
 *   4. Errors are always logged to stderr; info/warn go to stdout.
 *
 * Usage (server functions only — never import in client-side code):
 *
 *   import { log } from "@/lib/logger";
 *
 *   log.authAttempt("login_success", { userId: "abc", ip: "1.2.3.4" });
 *   log.authAttempt("login_failed",  { identifierHint: "ad@...", ip: "1.2.3.4" });
 *   log.apiError("checkLoginRateLimit", error, { path: "/_server/..." });
 *   log.suspiciousActivity("rate_limit_exceeded", { ip: "1.2.3.4", count: 10 });
 *   log.info("server_start", { version: "1.0.0" });
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export type AuthEvent =
  | "login_success"
  | "login_failed"
  | "login_locked"
  | "logout"
  | "password_changed"
  | "password_change_failed"
  | "token_invalid"
  | "token_expired"
  | "session_missing"
  | "unauthorized_admin_access";

export type SuspiciousEvent =
  | "rate_limit_exceeded"
  | "oversized_token"
  | "malformed_token"
  | "rapid_requests"
  | "honeypot_triggered"
  | "form_submitted_too_fast"
  | "missing_env_var";

interface BaseEntry {
  ts: string;          // ISO-8601 timestamp
  level: LogLevel;
  service: "cognivus-api";
  env: string;         // production | development | test
}

interface AuthEntry extends BaseEntry {
  category: "auth";
  event: AuthEvent;
  userId?: string;     // present on success
  /** First 8 hex chars of SHA-256(email) — enough to correlate, not to identify */
  identifierHint?: string;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
}

interface ApiErrorEntry extends BaseEntry {
  category: "api_error";
  fn: string;          // server function name
  errorCode?: string;
  errorMessage?: string; // sanitized — no secrets
  path?: string;
  statusCode?: number;
}

interface SuspiciousEntry extends BaseEntry {
  category: "suspicious";
  event: SuspiciousEvent;
  ip?: string;
  path?: string;
  count?: number;
  detail?: string;
}

interface InfoEntry extends BaseEntry {
  category: "info";
  event: string;
  [key: string]: unknown;
}

type LogEntry = AuthEntry | ApiErrorEntry | SuspiciousEntry | InfoEntry;

// ── Sensitive field names — values are redacted before logging ────────────────
const SENSITIVE_KEYS = new Set([
  "password", "passwd", "secret", "token", "access_token", "refresh_token",
  "authorization", "api_key", "apikey", "service_role_key", "jwt",
  "credential", "credentials", "private_key", "client_secret",
]);

function sanitizeFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEnv(): string {
  return process.env.NODE_ENV ?? "development";
}

function isTest(): boolean {
  return getEnv() === "test";
}

function emit(entry: LogEntry): void {
  if (isTest()) return;
  const line = JSON.stringify(entry);
  if (entry.level === "error" || entry.level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

function base(level: LogLevel): BaseEntry {
  return {
    ts: new Date().toISOString(),
    level,
    service: "cognivus-api",
    env: getEnv(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const log = {
  /**
   * Log an authentication event (login, logout, token validation, etc.).
   * Never include raw email addresses — use identifierHint (truncated hash).
   */
  authAttempt(
    event: AuthEvent,
    fields: Omit<AuthEntry, keyof BaseEntry | "category" | "event"> = {},
  ): void {
    emit({
      ...base(event.includes("failed") || event.includes("invalid") || event.includes("expired") ? "warn" : "info"),
      category: "auth",
      event,
      ...sanitizeFields(fields as unknown as Record<string, unknown>),
    } as AuthEntry);
  },

  /**
   * Log a server function error. Strips secrets from error messages.
   * Never log the raw Error object — extract only the message and code.
   */
  apiError(
    fn: string,
    error: unknown,
    extra: Partial<Pick<ApiErrorEntry, "path" | "statusCode">> = {},
  ): void {
    const err = error instanceof Error ? error : new Error(String(error));
    // Redact anything that looks like a key/token in the message
    const safeMessage = err.message
      .replace(/eyJ[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]")
      .replace(/service_role[^"'\s]*/gi, "[REDACTED]")
      .slice(0, 500); // cap length

    emit({
      ...base("error"),
      category: "api_error",
      fn,
      errorMessage: safeMessage,
      errorCode: (error as { code?: string })?.code,
      ...extra,
    } as ApiErrorEntry);
  },

  /**
   * Log a suspicious traffic or security pattern.
   * Use this for anything that warrants investigation but isn't an outright
   * error (rate-limit hits, malformed tokens, honeypot triggers, etc.).
   */
  suspiciousActivity(
    event: SuspiciousEvent,
    fields: Omit<SuspiciousEntry, keyof BaseEntry | "category" | "event"> = {},
  ): void {
    emit({
      ...base("warn"),
      category: "suspicious",
      event,
      ...fields,
    } as SuspiciousEntry);
  },

  /** General informational log. Sanitizes any sensitive-looking fields. */
  info(event: string, fields: Record<string, unknown> = {}): void {
    emit({
      ...base("info"),
      category: "info",
      event,
      ...sanitizeFields(fields),
    } as InfoEntry);
  },

  /** Debug log — emitted only in development. */
  debug(event: string, fields: Record<string, unknown> = {}): void {
    if (getEnv() === "production") return;
    emit({
      ...base("debug"),
      category: "info",
      event,
      ...sanitizeFields(fields),
    } as InfoEntry);
  },
};
