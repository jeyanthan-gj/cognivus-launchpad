import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  FileText,
  Inbox,
  KeyRound,
  LogOut,
} from "lucide-react";
import logoSrc from "@/assets/logo.png";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Cognivus" }] }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true as boolean },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban, exact: false as boolean },
  { to: "/admin/services", label: "Services", icon: Sparkles, exact: false as boolean },
  { to: "/admin/content", label: "Content", icon: FileText, exact: false as boolean },
  { to: "/admin/messages", label: "Messages", icon: Inbox, exact: false as boolean },
  { to: "/admin/account", label: "Account", icon: KeyRound, exact: false as boolean },
] as const;

function AdminLayout() {
  const { loading, user, isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user && location.pathname !== "/admin/login") {
      navigate({ to: "/admin/login" });
    }
  }, [loading, user, navigate, location.pathname]);

  if (location.pathname === "/admin/login") {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elegant">
          <h1 className="text-2xl font-bold">Access pending</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({user.email}) does not have admin access yet. Ask an existing admin to grant you the
            <code className="mx-1 rounded bg-accent px-1">admin</code> role.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/admin/login" });
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <Link to="/" className="mt-4 block text-xs text-muted-foreground hover:text-foreground">
            ← Back to website
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background p-4 md:flex">
        <Link to="/admin" className="mb-6 flex items-center gap-2 px-2 font-semibold">
          <img src={logoSrc} alt="Cognivus" className="h-8 w-auto rounded-md" />
          Cognivus
        </Link>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
                activeOptions={{ exact: !!n.exact }}
              >
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-border pt-4">
          <p className="px-3 text-xs text-muted-foreground">{user.email}</p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/admin/login" });
            }}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <Link to="/" className="mt-1 block px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            ← View website
          </Link>
        </div>
      </aside>

      <div className="flex-1">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
          <Link to="/admin" className="flex items-center gap-2 font-semibold">
            <img src={logoSrc} alt="Cognivus" className="h-5 w-auto rounded-md" /> Admin
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/admin/login" });
            }}
            className="text-sm text-muted-foreground"
          >
            Sign out
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2 md:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent",
              )}
              activeProps={{ className: "bg-accent text-foreground" }}
              activeOptions={{ exact: !!n.exact }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="mx-auto max-w-6xl p-6 md:p-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
