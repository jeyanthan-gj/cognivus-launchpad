/**
 * Server-side environment variable validation.
 *
 * Call validateServerEnv() once at startup (or at the top of any server
 * entrypoint) to fail fast if required secrets are missing, rather than
 * propagating undefined into live request handlers.
 *
 * RULES:
 *  - Required variables throw on missing/empty values.
 *  - Never log the values of secrets — only their names.
 *  - VITE_* variables are public (bundled into the client). Everything else
 *    must be server-only.
 *
 * Usage:
 *   import { env, validateServerEnv } from "@/lib/env";
 *   validateServerEnv();          // call once at startup
 *   const key = env.serviceRoleKey;   // typed, never undefined
 */

import { log } from "./logger";

// ── Variable descriptors ──────────────────────────────────────────────────────

interface EnvVar {
  key: string;
  /** If true, the process exits when missing. If false, a warning is logged. */
  required: boolean;
  /** Human-readable description for error messages. */
  description: string;
  /** If true, validate the value looks like a URL. */
  isUrl?: boolean;
  /** If true, validate the value looks like a JWT (starts with eyJ). */
  isJwt?: boolean;
}

const SERVER_ENV_VARS: EnvVar[] = [
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    description: "Supabase service-role key (bypasses RLS — server only)",
    isJwt: true,
  },
  {
    key: "VITE_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
    isUrl: true,
  },
  {
    key: "VITE_SUPABASE_PUBLISHABLE_KEY",
    required: true,
    description: "Supabase anon/publishable key (safe for browser)",
    isJwt: true,
  },
];

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  missing: string[];
  malformed: string[];
}

function validateVar(descriptor: EnvVar): { ok: boolean; reason?: string } {
  const value = process.env[descriptor.key];

  if (!value || value.trim() === "") {
    return { ok: false, reason: "missing or empty" };
  }

  if (descriptor.isUrl) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol)) {
        return { ok: false, reason: "must be a valid URL with https: or http: scheme" };
      }
      // In production, require HTTPS
      if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
        return { ok: false, reason: "must use HTTPS in production" };
      }
    } catch {
      return { ok: false, reason: "not a valid URL" };
    }
  }

  if (descriptor.isJwt) {
    // JWTs start with eyJ (base64url of {"alg":...})
    if (!value.startsWith("eyJ") || value.split(".").length !== 3) {
      return { ok: false, reason: "does not look like a valid JWT" };
    }
  }

  return { ok: true };
}

let _validated = false;

/**
 * Validates all required server environment variables.
 * Throws if any required variable is missing or malformed.
 * Safe to call multiple times — validation runs only once per process.
 */
export function validateServerEnv(): ValidationResult {
  if (_validated) return { valid: true, missing: [], malformed: [] };

  const missing: string[] = [];
  const malformed: string[] = [];

  for (const descriptor of SERVER_ENV_VARS) {
    const { ok, reason } = validateVar(descriptor);

    if (!ok) {
      const category = !process.env[descriptor.key] ? "missing" : "malformed";
      if (category === "missing") {
        missing.push(descriptor.key);
      } else {
        malformed.push(descriptor.key);
      }

      const message = `[env] ${category.toUpperCase()}: ${descriptor.key} — ${descriptor.description}. Reason: ${reason}`;

      if (descriptor.required) {
        // Log the variable name (never the value) then throw
        log.suspiciousActivity("missing_env_var", { detail: `${descriptor.key}: ${reason}` });
        console.error(message);
        throw new Error(
          `Required environment variable ${descriptor.key} is ${category}. ` +
          `Check your Netlify environment variable settings.`,
        );
      } else {
        console.warn(message);
      }
    }
  }

  _validated = true;
  log.info("env_validated", { requiredCount: SERVER_ENV_VARS.filter(v => v.required).length });
  return { valid: missing.length === 0 && malformed.length === 0, missing, malformed };
}

/**
 * Typed, validated environment accessors.
 * These throw if the variable is missing — call validateServerEnv() first.
 */
export const env = {
  get supabaseUrl(): string {
    const v = process.env.VITE_SUPABASE_URL;
    if (!v) throw new Error("VITE_SUPABASE_URL is not set");
    return v;
  },
  get publishableKey(): string {
    const v = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!v) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is not set");
    return v;
  },
  get serviceRoleKey(): string {
    const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!v) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    return v;
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },
  get isProduction(): boolean {
    return this.nodeEnv === "production";
  },
};
