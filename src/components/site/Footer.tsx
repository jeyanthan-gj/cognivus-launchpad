import { Link } from "@tanstack/react-router";
import { BrainCircuit } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-3">
        <div>
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-primary text-primary-foreground shadow-soft">
              <BrainCircuit className="h-4 w-4" />
            </span>
            <span>Cognivus</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            The mind behind every solution. AI-powered systems engineered for real-world business impact.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-foreground">About</Link></li>
            <li><Link to="/services" className="hover:text-foreground">Services</Link></li>
            <li><Link to="/projects" className="hover:text-foreground">Projects</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Get in touch</h4>
          <p className="mt-3 text-sm text-muted-foreground">
            Have a project in mind? We'd love to hear about it.
          </p>
          <Link
            to="/contact"
            className="mt-3 inline-flex items-center text-sm font-medium text-foreground hover:text-primary-glow"
          >
            Start a conversation →
          </Link>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Cognivus. All rights reserved.</p>
          <p>Built with intelligence.</p>
        </div>
      </div>
    </footer>
  );
}
