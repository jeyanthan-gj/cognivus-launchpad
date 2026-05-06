import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Cognivus" },
      { name: "description", content: "Terms governing your use of Cognivus services." },
      { property: "og:title", content: "Terms of Service — Cognivus" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TermsPage,
});

const EFFECTIVE_DATE = "1 May 2025";
const CONTACT_EMAIL = "legal@cognivus.ai";
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

function TermsPage() {
  return (
    <SiteLayout>
      <div className="bg-hero">
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-24">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
              <FileText className="h-5 w-5 text-primary" />
            </span>
            <p className="text-sm font-medium uppercase tracking-wider text-primary-glow">Legal</p>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-soft md:p-10">

          <Section title="1. Acceptance of terms">
            <p>
              By accessing or using {DOMAIN} and any services provided by {COMPANY} ("Service"),
              you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not
              use the Service.
            </p>
            <p>
              These Terms apply to all visitors, users, and others who access or use the Service.
            </p>
          </Section>

          <Section title="2. Description of service">
            <p>
              {COMPANY} provides an AI-driven technology consultancy and product development service.
              The public website at {DOMAIN} is an informational and contact surface. Specific
              services, deliverables, and engagement terms are agreed separately in writing between{" "}
              {COMPANY} and each client.
            </p>
          </Section>

          <Section title="3. Acceptable use">
            <p>You agree not to:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>Use the Service for any unlawful purpose or in violation of any regulations.</li>
              <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure.</li>
              <li>Submit false, misleading, or fraudulent information through any form.</li>
              <li>Use automated scripts, bots, or scrapers to access or interact with the Service without prior written consent.</li>
              <li>Attempt to circumvent rate limits, security controls, or abuse-prevention measures.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>Transmit any malicious code, viruses, or harmful data.</li>
            </ul>
          </Section>

          <Section title="4. Intellectual property">
            <p>
              All content on the Service — including text, graphics, logos, and software — is the
              property of {COMPANY} or its licensors and is protected by applicable intellectual
              property laws.
            </p>
            <p>
              You may not reproduce, distribute, modify, or create derivative works of any content
              without our prior written consent.
            </p>
          </Section>

          <Section title="5. User-submitted content">
            <p>
              When you submit a contact form enquiry or other content, you grant {COMPANY} a
              non-exclusive, worldwide, royalty-free licence to use, store, and process that content
              solely to provide and improve the Service and to respond to your enquiry.
            </p>
            <p>
              You represent that you have all rights necessary to grant this licence and that your
              content does not violate any third-party rights.
            </p>
          </Section>

          <Section title="6. Disclaimers">
            <p>
              The Service is provided "as is" and "as available" without warranties of any kind,
              express or implied, including but not limited to warranties of merchantability, fitness
              for a particular purpose, and non-infringement.
            </p>
            <p>
              {COMPANY} does not warrant that the Service will be uninterrupted, error-free, or free
              of harmful components.
            </p>
          </Section>

          <Section title="7. Limitation of liability">
            <p>
              To the fullest extent permitted by law, {COMPANY} shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits or
              revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill,
              or other intangible losses, resulting from your use of or inability to use the Service.
            </p>
            <p>
              Our total liability for any claim arising from these Terms or the Service shall not
              exceed the greater of £100 or the amount you paid us in the 12 months preceding the claim.
            </p>
          </Section>

          <Section title="8. Indemnification">
            <p>
              You agree to indemnify and hold harmless {COMPANY} and its officers, directors,
              employees, and agents from any claims, damages, losses, liabilities, and expenses
              (including legal fees) arising out of your use of the Service, your violation of these
              Terms, or your violation of any third-party right.
            </p>
          </Section>

          <Section title="9. Third-party links">
            <p>
              The Service may contain links to third-party websites. These links are provided for
              convenience only. {COMPANY} has no control over, and assumes no responsibility for,
              the content or practices of any third-party sites.
            </p>
          </Section>

          <Section title="10. Governing law">
            <p>
              These Terms are governed by and construed in accordance with the laws of England and
              Wales. Any disputes arising from these Terms shall be subject to the exclusive
              jurisdiction of the courts of England and Wales.
            </p>
          </Section>

          <Section title="11. Changes to terms">
            <p>
              We reserve the right to modify these Terms at any time. We will update the effective
              date and, for material changes, provide at least 14 days' notice via the email address
              associated with your account (if applicable) or a prominent notice on the Service.
            </p>
            <p>
              Continued use of the Service after changes take effect constitutes acceptance of the
              revised Terms.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              For questions about these Terms, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-2 hover:text-primary-glow">
                {CONTACT_EMAIL}
              </a>.
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
