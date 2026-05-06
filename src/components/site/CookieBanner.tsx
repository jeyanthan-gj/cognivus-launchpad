/**
 * Cookie consent banner — GDPR / ePD compliant.
 *
 * Rules enforced:
 *  - Consent is explicit (user clicks Accept) — no implied consent.
 *  - Strictly necessary cookies (Supabase auth session) don't require consent.
 *  - Consent is stored in localStorage under "cookie_consent" with a timestamp.
 *  - Banner reappears after 365 days so consent stays fresh.
 *  - "Decline" is equally prominent — no dark patterns.
 *  - Links to the Privacy Policy for full cookie details.
 *
 * This component renders nothing until hydration, avoiding SSR flash.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "cookie_consent";
const CONSENT_TTL_DAYS = 365;

type ConsentStatus = "accepted" | "declined";

interface StoredConsent {
  status: ConsentStatus;
  ts: number; // Unix ms
}

function getStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    const ageMs = Date.now() - parsed.ts;
    if (ageMs > CONSENT_TTL_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setStoredConsent(status: ConsentStatus): void {
  try {
    const value: StoredConsent = { status, ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage unavailable — banner will reappear next visit
  }
}

export function CookieBanner() {
  // Three states:
  //   undefined — not yet hydrated (render nothing to avoid SSR flash)
  //   null      — hydrated, no stored consent → show banner
  //   ConsentStatus — already decided → hide banner
  const [consent, setConsent] = useState<ConsentStatus | null | undefined>(undefined);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) {
      setConsent(stored.status);
    } else {
      setConsent(null);
      // Small delay so the banner slides in after the page settles
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    setStoredConsent("accepted");
    setConsent("accepted");
    setVisible(false);
  }

  function decline() {
    setStoredConsent("declined");
    setConsent("declined");
    setVisible(false);
  }

  // Don't render until hydrated or if already decided
  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 p-4 transition-transform duration-500 md:bottom-4 md:left-auto md:right-4 md:max-w-sm",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="rounded-2xl border border-border bg-card shadow-elegant">
        <div className="flex items-start justify-between gap-2 px-5 pt-5">
          <p className="text-sm font-semibold text-foreground">Cookies &amp; Privacy</p>
          <button
            type="button"
            onClick={decline}
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-5 pt-2 text-xs leading-relaxed text-muted-foreground">
          We use strictly necessary cookies to keep you signed in. We don't use advertising or
          tracking cookies.{" "}
          <Link to="/privacy" className="font-medium text-foreground underline underline-offset-2 hover:text-primary-glow">
            Privacy Policy
          </Link>
        </p>

        <div className="flex gap-2 px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={decline}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-soft transition-all hover:shadow-elegant"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
