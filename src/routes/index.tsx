import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Workflow, BookOpen, MessageSquare, Cog, Sparkles, Play } from "lucide-react";
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
type Project = {
  id: string;
  title: string;
  description: string;
  tech_stack: string[];
  demo_url: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
};
type Content = Record<string, string>;

// ─── Home Project Card ────────────────────────────────────────────────────────
function HomeProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    if (videoRef.current && project.video_url) videoRef.current.play().catch(() => {});
  };
  const handleMouseLeave = () => {
    setHovered(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  };

  return (
    <article
      onClick={() => navigate({ to: "/projects/$id", params: { id: project.id } })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group cursor-pointer rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant overflow-hidden"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${hovered && videoReady && project.video_url ? "opacity-0" : "opacity-100"}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary-glow/10">
            <span className="text-3xl font-bold text-primary/20 select-none">{project.title.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        {project.video_url && (
          <video
            ref={videoRef}
            src={project.video_url}
            muted loop playsInline preload="metadata"
            onCanPlay={() => setVideoReady(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${hovered && videoReady ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {project.video_url && !hovered && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-foreground/70 px-2 py-0.5 text-xs font-medium text-background backdrop-blur-sm">
            <Play className="h-2.5 w-2.5 fill-current" /> Preview
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="rounded-full border border-background/60 bg-background/20 px-4 py-2 text-sm font-semibold text-background backdrop-blur-sm">View project</span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-semibold group-hover:text-primary-glow transition-colors">{project.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.tech_stack.slice(0, 4).map((t) => (
            <span key={t} className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}


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
          .select("id,title,description,tech_stack,demo_url,thumbnail_url,video_url")
          .eq("published", true)
          .order("display_order")
          .limit(3),
        supabase.from("site_content").select("key,value"),
      ]);
      if (s.data) setServices(s.data as Service[]);
      if (p.data) setProjects(p.data as Project[]);
      if (c.data) setContent(Object.fromEntries(c.data.map((r) => [r.key, r.value])));
      // Errors on the homepage are non-fatal — fallback content renders instead
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
              <HomeProjectCard key={p.id} project={p} />
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

