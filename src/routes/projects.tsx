import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, X, Play } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Cognivus" },
      {
        name: "description",
        content:
          "Production AI systems built by Cognivus — automation platforms, knowledge assistants, and conversational copilots.",
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
  thumbnail_url: string | null;
  video_url: string | null;
};

// ─── YouTube helpers ───────────────────────────────────────────────────────────
function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getYouTubeEmbedUrl(url: string, autoplay = false): string {
  const id = getYouTubeId(url);
  if (!id) return url;
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: "1",
    loop: "1",
    playlist: id, // required for loop to work
    controls: "1",
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isYouTube = !!project.video_url && !!getYouTubeId(project.video_url);

  const handleMouseEnter = () => {
    setHovered(true);
    if (videoRef.current && project.video_url && !isYouTube) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (videoRef.current && !isYouTube) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <article
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group cursor-pointer rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant overflow-hidden"
    >
      {/* Media */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              hovered && (isYouTube || videoReady) && project.video_url ? "opacity-0" : "opacity-100"
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary-glow/10">
            <span className="text-4xl font-bold tracking-tight text-primary/20 select-none">
              {project.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* YouTube embed on hover */}
        {project.video_url && isYouTube && (
          <iframe
            src={hovered ? getYouTubeEmbedUrl(project.video_url, true) : undefined}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
              hovered ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Regular video on hover */}
        {project.video_url && !isYouTube && (
          <video
            ref={videoRef}
            src={project.video_url}
            muted
            loop
            playsInline
            preload="metadata"
            onCanPlay={() => setVideoReady(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              hovered && videoReady ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {project.video_url && !hovered && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-medium text-background backdrop-blur-sm">
            <Play className="h-3 w-3 fill-current" />
            Preview
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="rounded-full border border-background/60 bg-background/20 px-4 py-2 text-sm font-semibold text-background backdrop-blur-sm">
            View project
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-base font-semibold leading-snug group-hover:text-primary-glow transition-colors">
          {project.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.tech_stack.slice(0, 5).map((t) => (
            <span key={t} className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {t}
            </span>
          ))}
          {project.tech_stack.length > 5 && (
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground">
              +{project.tech_stack.length - 5}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Project Modal ─────────────────────────────────────────────────────────────
function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-foreground/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-elegant overflow-hidden max-h-[90vh]">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Media */}
        <div className="relative aspect-video w-full shrink-0 bg-muted overflow-hidden">
          {project.thumbnail_url && !project.video_url && (
            <img
              src={project.thumbnail_url}
              alt={project.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {project.video_url && (() => {
            const isYT = !!getYouTubeId(project.video_url);
            return isYT ? (
              <iframe
                src={getYouTubeEmbedUrl(project.video_url, true)}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <video
                src={project.video_url}
                autoPlay
                muted
                loop
                playsInline
                controls
                poster={project.thumbnail_url ?? undefined}
                className="absolute inset-0 h-full w-full object-cover"
              />
            );
          })()}
          {!project.thumbnail_url && !project.video_url && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary-glow/10">
              <span className="text-6xl font-bold tracking-tight text-primary/20 select-none">
                {project.title.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="overflow-y-auto p-6 md:p-8">
          <h2 className="text-2xl font-bold tracking-tight">{project.title}</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{project.description}</p>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tech Stack</p>
            <div className="flex flex-wrap gap-2">
              {project.tech_stack.map((t) => (
                <span key={t} className="rounded-lg border border-border bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {project.demo_url && (
            <div className="mt-6">
              <a
                href={project.demo_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-elegant transition-shadow"
              >
                View live demo <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,title,description,tech_stack,demo_url,thumbnail_url,video_url")
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
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-4/5 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No projects published yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        )}
      </section>

      {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} />}
    </SiteLayout>
  );
}
