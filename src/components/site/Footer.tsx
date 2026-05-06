import { Link } from "@tanstack/react-router";
import logoPart1 from "@/assets/logo-part1.jpg";
import logoPart2 from "@/assets/logo-part2.jpg";
import { Mail, Bug } from "lucide-react";

const SUPPORT_EMAIL = "support@cognivus.ai";
const BUG_EMAIL = "bugs@cognivus.ai";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-4">

        {/* Brand */}
        <div className="md:col-span-1">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <img
              src={logoPart2}
              alt="Cognivus Icon"
              className="h-10 w-auto rounded-xl object-contain mix-blend-multiply dark:mix-blend-normal"
            />
            <img
              src={logoPart1}
              alt="Cognivus"
              className="mt-1 h-11 w-auto object-contain mix-blend-multiply dark:mix-blend-normal"
            />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            The mind behind every solution. AI-powered systems engineered for real-world business impact.
          </p>
        </div>

        {/* Company */}
        <div>
          <h4 className="text-sm font-semibold">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about"    className="hover:text-foreground">About</Link></li>
            <li><Link to="/services" className="hover:text-foreground">Services</Link></li>
            <li><Link to="/projects" className="hover:text-foreground">Projects</Link></li>
            <li><Link to="/contact"  className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="text-sm font-semibold">Support</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5" />
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${BUG_EMAIL}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Bug className="h-3.5 w-3.5" />
                Report a bug
              </a>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground">
                Send a message →
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-sm font-semibold">Legal</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/terms"   className="hover:text-foreground">Terms of Service</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Cognivus. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms"   className="hover:text-foreground">Terms</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
