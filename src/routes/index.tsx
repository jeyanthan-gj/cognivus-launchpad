import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Workflow, BookOpen, MessageSquare, Cog, Sparkles } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ServiceIcon } from "@/components/site/icon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cognivus — The mind behind every solution" },
      {
        name: "description",
        content:
          "Cognivus builds intelligent AI-powered solutions — automation, RAG assistants, custom chatbots, and workflow intelligence — that solve real-world business problems.",
      },
      { property: "og:title", content: "Cognivus — The mind behind every solution" },
      {
        property: "og:description",
        content:
          "AI-driven technology company building scalable real-world solutions.",
      },
    ],
  }),
  component: HomePage,
});

type Service = { id: string; icon: string; title: string; description: string };
type Project = { id: string; title: string; description: string; tech_stack: string[]; demo_url: string | null };
type Content = Record<string, string>;

function HomePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [content, setContent] = useState<Content>({});

  useEffect(() => {
    void (async () => {
      const [s, p, c] = await Promise.all([
        supabase.from("services").select("id,icon,title,description").order("display_order"),
        supabase
          .from("projects")
          .select("id,title,description,tech_stack,demo_url")
          .eq("published", true)
          .order("display_order")
          .limit(3),
        supabase.from("site_content").select("key,value"),
      ]);
      if (s.data) setServices(s.data as Service[]);
      if (p.data) setProjects(p.data as Project[]);
      if (c.data) setContent(Object.fromEntries(c.data.map((r) => [r.key, r.value])));
    })();
  }, []);

  const tagline = content.hero_tagline ?? "The mind behind every solution.";
  const heroDesc =
    content.hero_description ??
    "We build intelligent AI-powered solutions that solve real-world business problems.";

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="bg-hero relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-24 md:pt-32 md:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary-glow" />
              AI-driven technology company
            </span>
            <h1 className="animate-fade-up animate-delay-100 mt-6 text-balance text-5xl font-bold tracking-tight md:text-7xl">
              Cognivus
            </h1>
            <p className="animate-fade-up animate-delay-100 mt-4 text-pretty text-2xl font-medium text-foreground/80 md:text-3xl">
              {tagline}
            </p>
            <p className="animate-fade-up animate-delay-200 mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              {heroDesc}
            </p>
            <div className="animate-fade-up animate-delay-300 mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/services"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-all hover:shadow-elegant"
              >
                Explore Solutions
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/projects"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                View Projects
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services teaser */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-primary-glow">What we do</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Intelligent systems, end to end.</h2>
          </div>
          <Link to="/services" className="hidden text-sm font-medium text-foreground hover:text-primary-glow md:inline-flex">
            All services →
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(services.length
            ? services
            : [
                { id: "1", icon: "Workflow", title: "AI Automation", description: "Intelligent end-to-end automation." },
                { id: "2", icon: "BookOpen", title: "RAG Assistants", description: "Context-aware knowledge agents." },
                { id: "3", icon: "MessageSquare", title: "AI Chatbots", description: "Custom conversational AI." },
                { id: "4", icon: "Cog", title: "Workflow Automation", description: "AI-driven process orchestration." },
              ]
          ).slice(0, 4).map((s) => (
            <div
              key={s.id}
              className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-foreground">
                <ServiceIcon name={s.icon} className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured projects */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-primary-glow">Selected work</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Projects in production.</h2>
            </div>
            <Link to="/projects" className="text-sm font-medium text-foreground hover:text-primary-glow">
              All projects →
            </Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {projects.map((p) => (
              <article key={p.id} className="rounded-xl border border-border bg-card p-6 shadow-soft">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.tech_stack.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="rounded-2xl border border-border bg-gradient-primary p-10 text-center text-primary-foreground shadow-elegant md:p-16">
          <h2 className="text-balance text-3xl font-bold md:text-4xl">Ready to build something intelligent?</h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-primary-foreground/85">
            Let's talk about your problem and design an AI system that solves it.
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-background px-5 py-3 text-sm font-medium text-foreground shadow-soft hover:bg-background/90"
          >
            Start a conversation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
