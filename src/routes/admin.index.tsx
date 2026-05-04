import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderKanban, Sparkles, Inbox, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const [counts, setCounts] = useState({ projects: 0, services: 0, messages: 0 });
  const [recent, setRecent] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [p, s, m, r] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("services").select("*", { count: "exact", head: true }),
        supabase.from("contact_messages").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("id,title,updated_at").order("updated_at", { ascending: false }).limit(5),
      ]);

      const firstError = p.error ?? s.error ?? m.error ?? r.error;
      if (firstError) {
        setError(firstError.message);
        return;
      }

      setCounts({
        projects: p.count ?? 0,
        services: s.count ?? 0,
        messages: m.count ?? 0,
      });
      if (r.data) setRecent(r.data);
    })();
  }, []);

  const stats = [
    { label: "Projects", value: counts.projects, icon: FolderKanban, to: "/admin/projects" },
    { label: "Services", value: counts.services, icon: Sparkles, to: "/admin/services" },
    { label: "Messages", value: counts.messages, icon: Inbox, to: "/admin/messages" },
  ] as const;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back. Here's what's happening.</p>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load dashboard data: {error}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              to={s.to}
              className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
              <p className="mt-3 inline-flex items-center text-xs font-medium text-muted-foreground group-hover:text-foreground">
                Manage <ArrowRight className="ml-1 h-3 w-3" />
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 rounded-xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-semibold">Recent project updates</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.updated_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
