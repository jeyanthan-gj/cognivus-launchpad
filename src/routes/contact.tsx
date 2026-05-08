import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Mail, Send, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "919384019167"; // +91 93840 19167
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { submitContact } from "@/api_functions/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Cognivus" },
      { name: "description", content: "Get in touch with Cognivus to discuss your AI project." },
      { property: "og:title", content: "Contact — Cognivus" },
      { property: "og:description", content: "Let's talk about your AI project." },
    ],
  }),
  component: ContactPage,
});

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Invalid email").max(320),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  // Honeypot: bots fill hidden fields; humans don't see them
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Record the time the form mounted — server validates minimum elapsed time
  const [mountedAt] = useState(() => Date.now());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation (UX only — server re-validates everything)
    const parsed = clientSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitContact({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          message: parsed.data.message,
          // Honeypot — server checks this independently
          _hp: honeypot,
          // Timing signal — server validates ≥ 3 seconds elapsed
          _mountedAt: mountedAt,
        },
      });

      if (!result.ok) {
        toast.error(result.error ?? "Could not send message. Please try again.");
        return;
      }

      toast.success("Message sent. We'll be in touch shortly.");
      setForm({ name: "", email: "", message: "" });
    } catch (err: unknown) {
      // Handle rate-limit response (429) from the server function
      if (err instanceof Response && err.status === 429) {
        const retryAfter = err.headers.get("Retry-After");
        const waitMin = retryAfter ? Math.ceil(Number(retryAfter) / 60) : 60;
        toast.error(`Too many messages sent. Please wait ${waitMin} minute${waitMin !== 1 ? "s" : ""} before trying again.`);
        return;
      }
      // Handle bot-detection block (403)
      if (err instanceof Response && err.status === 403) {
        toast.error("Your request was blocked. Please try again later.");
        return;
      }
      toast.error("Could not send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SiteLayout>
      <section className="bg-hero">
        <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
          <p className="animate-fade-up text-sm font-medium uppercase tracking-wider text-primary-glow">Contact</p>
          <h1 className="animate-fade-up animate-delay-100 mt-3 text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Let's build something intelligent.
          </h1>
          <p className="animate-fade-up animate-delay-200 mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Tell us about your project. We typically respond within one business day.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={`mailto:cognivus88@gmail.com`}
            className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-soft transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Mail className="h-5 w-5 shrink-0 text-primary" />
            <span>cognivus88@gmail.com</span>
          </a>
          <a
            href={`mailto:support@cognivus.ai`}
            className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-soft transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Mail className="h-5 w-5 shrink-0 text-primary" />
            <span>support@cognivus.ai</span>
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-soft transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <MessageCircle className="h-5 w-5 shrink-0 text-[#25D366]" />
            <span>Chat on WhatsApp</span>
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-8 shadow-soft md:p-10"
        >
          {/* Honeypot — hidden from real users via CSS, bots fill it */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
          >
            <label htmlFor="website">Website (leave blank)</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className="text-sm font-medium" htmlFor="name">Name</label>
              <input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={200}
                required
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={320}
                required
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="message">Message</label>
              <textarea
                id="message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                maxLength={5000}
                minLength={10}
                required
                rows={6}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> We'll never share your email.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:shadow-elegant disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Send message"}
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </SiteLayout>
  );
}
