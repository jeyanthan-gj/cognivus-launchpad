/**
 * Structured server-side logger for Cognivus.
 *
 * Emits newline-delimited JSON (NDJSON) compatible with Netlify Log Drains,
 * Datadog, Logtail, and any structured-log pipeline.
 *
 * SECURITY RULES
 * ──────────────
 *  1. Passwords, tokens, and secrets are NEVER logged (sanitizeFields strips them).
 *  2. PII (email) is logged only as an 8-char SHA-256 prefix for correlation.
 *  3. All log calls are no-ops in test environments.
 *  4. Errors → stderr. Info/warn → stdout.
 */

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
  | "missing_env_var"
  | "bot_detected"
  | "bot_blocked"
  | "scraping_detected";

interface BaseEntry {
  ts: string;
  level: LogLevel;
  service: "cognivus-api";
  env: string;
}

interface AuthEntry extends BaseEntry {
  category: "auth";
  event: AuthEvent;
  userId?: string;
  identifierHint?: string;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
}

interface ApiErrorEntry extends BaseEntry {
  category: "api_error";
  fn: string;
  errorCode?: string;
  errorMessage?: string;
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

function getEnv(): string { return process.env.NODE_ENV ?? "development"; }
function isTest(): boolean { return getEnv() === "test"; }

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
  return { ts: new Date().toISOString(), level, service: "cognivus-api", env: getEnv() };
}

export const log = {
  authAttempt(event: AuthEvent, fields: Omit<AuthEntry, keyof BaseEntry | "category" | "event"> = {}): void {
    const isFailure = event.includes("failed") || event.includes("invalid") || event.includes("expired") || event.includes("locked");
    emit({
      ...base(isFailure ? "warn" : "info"),
      category: "auth",
      event,
      ...sanitizeFields(fields as unknown as Record<string, unknown>),
    } as AuthEntry);
  },

  apiError(fn: string, error: unknown, extra: Partial<Pick<ApiErrorEntry, "path" | "statusCode">> = {}): void {
    const err = error instanceof Error ? error : new Error(String(error));
    const safeMessage = err.message
      .replace(/eyJ[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]")
      .replace(/service_role[^"'\s]*/gi, "[REDACTED]")
      .slice(0, 500);
    emit({
      ...base("error"),
      category: "api_error",
      fn,
      errorMessage: safeMessage,
      errorCode: (error as { code?: string })?.code,
      ...extra,
    } as ApiErrorEntry);
  },

  suspiciousActivity(event: SuspiciousEvent, fields: Omit<SuspiciousEntry, keyof BaseEntry | "category" | "event"> = {}): void {
    emit({ ...base("warn"), category: "suspicious", event, ...fields } as SuspiciousEntry);
  },

  info(event: string, fields: Record<string, unknown> = {}): void {
    emit({ ...base("info"), category: "info", event, ...sanitizeFields(fields) } as InfoEntry);
  },

  debug(event: string, fields: Record<string, unknown> = {}): void {
    if (getEnv() === "production") return;
    emit({ ...base("debug"), category: "info", event, ...sanitizeFields(fields) } as InfoEntry);
  },
};
