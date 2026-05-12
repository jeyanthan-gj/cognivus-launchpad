// build: 1778547053
import { createFileRoute, useNavigate, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
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
function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
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
      onClick={() => navigate({ to: "/projects/$id", params: { id: project.id } })}
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
            className={`absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-500 ${
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
            className={`absolute inset-0 h-full w-full pointer-events-none transition-opacity duration-500 ${
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

// ─── Page ──────────────────────────────────────────────────────────────────────
function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if we're on a child route (e.g. /projects/$id)
  const isOnChildRoute = !useMatch({ from: "/projects", shouldThrow: false });

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

  // If navigated to a child route like /projects/$id, render that child
  if (isOnChildRoute) {
    return <Outlet />;
  }

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
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

