import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Cognivus" },
      {
        name: "description",
        content: "Production AI systems built by Cognivus — automation platforms, knowledge assistants, and conversational copilots.",
      },
      { property: "og:title", content: "Projects — Cognivus" },
      { property: "og:description", content: "AI projects in production." },
    ],
  }),
  component: ProjectsPage,
});

type Project = {
  id: string;
  title: string;
  description: string;
  tech_stack: string[];
  demo_url: string | null;
};

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,title,description,tech_stack,demo_url")
        .eq("published", true)
        .order("display_order");
      if (data) setProjects(data as Project[]);
      setLoading(false);
    })();
  }, []);

  return (
    <SiteLayout>
      <section className="bg-hero">
        <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
          <p className="animate-fade-up text-sm font-medium uppercase tracking-wider text-primary-glow">Projects</p>
          <h1 className="animate-fade-up animate-delay-100 mt-3 text-balance text-4xl font-bold tracking-tight md:text-6xl">
            What we've built.
          </h1>
          <p className="animate-fade-up animate-delay-200 mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            A selection of AI systems we've shipped into production for partners across industries.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-center text-muted-foreground">No projects published yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <article
                key={p.id}
                className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.tech_stack.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                {p.demo_url && (
                  <a
                    href={p.demo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary-glow"
                  >
                    View demo <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
