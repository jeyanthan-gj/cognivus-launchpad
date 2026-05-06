import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Cognivus" },
      { name: "description", content: "How Cognivus collects, uses, and protects your personal data." },
      { property: "og:title", content: "Privacy Policy — Cognivus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyPage,
});

const EFFECTIVE_DATE = "1 May 2025";
const CONTACT_EMAIL = "privacy@cognivus.ai";
const COMPANY = "Cognivus";
const DOMAIN = "cognivus.ai";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <SiteLayout>
      <div className="bg-hero">
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
              <Shield className="h-5 w-5 text-primary" />
            </span>
            <p className="text-sm font-medium uppercase tracking-wider text-primary-glow">Legal</p>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-soft md:p-10">

          <Section title="1. Who we are">
            <p>
              {COMPANY} operates the website <strong>{DOMAIN}</strong> and the services accessible
              through it (collectively, the "Service"). References to "we", "us", or "our" mean{" "}
              {COMPANY}.
            </p>
            <p>
              For privacy questions, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-2 hover:text-primary-glow">
                {CONTACT_EMAIL}
              </a>.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>We collect information you provide directly:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Contact form:</strong> name and email address when you submit an enquiry.</li>
              <li><strong>Account credentials:</strong> email and hashed password for admin accounts (admin users only).</li>
            </ul>
            <p>We collect information automatically when you visit the Service:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Log data:</strong> IP address, browser User-Agent, pages visited, and timestamps — retained for up to 90 days for security monitoring.</li>
              <li><strong>Rate-limit data:</strong> a one-way hash of your IP address stored in our database for up to 24 hours to prevent abuse. The hash cannot be reversed to recover your IP.</li>
              <li><strong>Cookies:</strong> a session cookie issued by Supabase Auth if you sign in as an admin. We do not use advertising or tracking cookies.</li>
            </ul>
          </Section>

          <Section title="3. How we use your information">
            <ul className="ml-4 list-disc space-y-1.5">
              <li>To respond to your contact form enquiries.</li>
              <li>To authenticate and authorise admin users.</li>
              <li>To detect and prevent fraud, abuse, and security incidents.</li>
              <li>To improve the reliability and performance of the Service.</li>
            </ul>
            <p>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
          </Section>

          <Section title="4. Legal basis for processing (GDPR)">
            <p>Where the GDPR applies, we process your data under the following lawful bases:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Legitimate interests</strong> — security monitoring, abuse prevention, and improving the Service.</li>
              <li><strong>Contract performance</strong> — providing admin access to authorised users.</li>
              <li><strong>Consent</strong> — contact form submissions, which you may withdraw at any time by emailing us.</li>
            </ul>
          </Section>

          <Section title="5. Data retention">
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Contact enquiries:</strong> retained until the enquiry is resolved, then deleted or anonymised within 12 months.</li>
              <li><strong>Security logs:</strong> deleted after 90 days.</li>
              <li><strong>Rate-limit hashes:</strong> deleted after 24 hours.</li>
              <li><strong>Admin accounts:</strong> retained for the duration of the engagement; deleted within 30 days of account closure on request.</li>
            </ul>
          </Section>

          <Section title="6. Third-party services">
            <p>We use the following sub-processors:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li><strong>Supabase</strong> (database and authentication) — data stored in EU or US regions depending on project configuration.</li>
              <li><strong>Netlify</strong> (hosting and edge network) — access logs retained per Netlify's policy.</li>
              <li><strong>Google Fonts</strong> — font files served from Google's CDN; Google may log font requests.</li>
            </ul>
          </Section>

          <Section title="7. Your rights">
            <p>Depending on your location you may have the right to:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request erasure of your data ("right to be forgotten").</li>
              <li>Object to or restrict processing.</li>
              <li>Request data portability.</li>
              <li>Lodge a complaint with your local supervisory authority.</li>
            </ul>
            <p>
              To exercise any right, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-2 hover:text-primary-glow">
                {CONTACT_EMAIL}
              </a>. We will respond within 30 days.
            </p>
          </Section>

          <Section title="8. Cookies">
            <p>
              We use only strictly necessary cookies: a session cookie issued when an admin signs in.
              This cookie is required for the Service to function and cannot be disabled while you are
              signed in. We do not use analytics, advertising, or tracking cookies.
            </p>
            <p>
              You can clear cookies at any time through your browser settings. Doing so will sign you
              out of any active admin session.
            </p>
          </Section>

          <Section title="9. Security">
            <p>
              We implement industry-standard security measures including HTTPS-only transport,
              bcrypt password hashing, Row Level Security on all database tables, server-side rate
              limiting, and structured security logging. No method of transmission or storage is 100%
              secure; we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="10. Children">
            <p>
              The Service is not directed at children under 16. We do not knowingly collect personal
              data from children. If you believe we have inadvertently collected such data, please
              contact us immediately and we will delete it.
            </p>
          </Section>

          <Section title="11. Changes to this policy">
            <p>
              We may update this policy from time to time. We will update the effective date at the
              top of this page and, for material changes, notify admin users by email. Your continued
              use of the Service after any change constitutes acceptance of the updated policy.
            </p>
          </Section>

          <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            <p>
              Questions?{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground hover:text-primary-glow">
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
