/**
 * Contact form server function.
 *
 * Moves the contact form insert from the client (direct Supabase SDK call)
 * to a server function so we can enforce:
 *   - Server-side rate limiting (3/hour per IP)
 *   - Bot detection (honeypot + timing validated server-side)
 *   - Input validation (Zod schema — cannot be bypassed via direct API calls)
 *   - Structured logging for every submission
 *
 * The old client-side submit used supabase.from("contact_messages").insert()
 * directly. That means any bot with the anon key could spam the table.
 * This server function closes that gap.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireContactFormLimit } from "@/middleware/abuse-protection";
import { log } from "@/lib/logger";

// ── Input schema ──────────────────────────────────────────────────────────────
// Validated server-side — the client cannot bypass these constraints.

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Invalid email").max(320),
  message: z.string().trim().min(10, "Message too short").max(5000),
  // Honeypot field — bots fill it, humans don't see it.
  // Checked server-side so bots can't simply skip the client-side check.
  _hp: z.string().max(0, "Bot detected").optional(),
  // Client-side mount timestamp in ms since epoch.
  // Server validates that at least 3 seconds passed before submit.
  _mountedAt: z.number().int().positive(),
});

export type ContactPayload = z.infer<typeof contactSchema>;

// ── Server function ───────────────────────────────────────────────────────────

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator(contactSchema)
  .middleware([requireContactFormLimit])
  .handler(async ({ data }) => {
    // ── 1. Server-side honeypot check ───────────────────────────────────────
    // Even if a bot bypasses the client-side check, the server rejects it.
    if (data._hp && data._hp.length > 0) {
      log.suspiciousActivity("honeypot_triggered", {
        detail: "contact form honeypot filled — silently dropping",
      });
      // Return success to avoid giving the bot feedback
      return { ok: true };
    }

    // ── 2. Server-side timing check ─────────────────────────────────────────
    // Forms filled in under 3 seconds are almost certainly bots.
    // The mountedAt timestamp comes from the client — subtract from now().
    const elapsedMs = Date.now() - data._mountedAt;
    if (elapsedMs < 3000) {
      log.suspiciousActivity("form_submitted_too_fast", {
        detail: `contact form submitted in ${elapsedMs}ms`,
      });
      // Silently accept — don't train bots to slow down
      return { ok: true };
    }

    // ── 3. Insert the message ────────────────────────────────────────────────
    // Using supabaseAdmin so we bypass RLS — the rate limit + bot detection
    // above are the access control layer for this public endpoint.
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      message: data.message,
    });

    if (error) {
      log.apiError("submitContact", error);
      return { ok: false, error: "Could not send message. Please try again." };
    }

    log.info("contact_submitted", {
      // Log only the domain part of the email for correlation (not the local part)
      emailDomain: data.email.split("@")[1] ?? "unknown",
    });

    return { ok: true };
  });
