import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/projects_/$id")({
  component: ProjectDetailPage,
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
    playlist: id,
    controls: "1",
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

// Strip hashtags, emojis, URLs, and excessive whitespace from description
function cleanDescription(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.trim())
    // Remove lines that are mostly hashtags
    .filter((line) => !line.match(/^(#\w+\s*){2,}$/))
    // Remove lines that are URLs
    .filter((line) => !line.match(/^https?:\/\//))
    // Remove lines with "Like, Subscribe" type social CTAs
    .filter((line) => !/like|subscribe|share|follow/i.test(line) || line.length > 80)
    .join("\n")
    // Strip inline hashtags
    .replace(/#\w+/g, "")
    // Strip emojis
    .replace(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/gu, "")
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,title,description,tech_stack,demo_url,thumbnail_url,video_url")
        .eq("id", id)
        .eq("published", true)
        .single();
      if (data) setProject(data as Project);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-4xl px-6 py-24 animate-pulse space-y-6">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="aspect-video w-full rounded-2xl bg-muted" />
          <div className="h-8 w-2/3 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
        </div>
      </SiteLayout>
    );
  }

  if (!project) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <p className="text-muted-foreground">Project not found.</p>
          <button
            onClick={() => router.history.back()}
            className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to projects
          </button>
        </div>
      </SiteLayout>
    );
  }

  const isYouTube = !!project.video_url && !!getYouTubeId(project.video_url);
  const description = cleanDescription(project.description);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-20">

        {/* Back */}
        <button
          onClick={() => router.history.back()}
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </button>

        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl mb-6">
          {project.title}
        </h1>

        {/* Media */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-elegant">
          {project.video_url ? (
            isYouTube ? (
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
            )
          ) : project.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt={project.title}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary-glow/10">
              <span className="text-8xl font-bold tracking-tight text-primary/20 select-none">
                {project.title.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <div className="mt-8 prose prose-neutral dark:prose-invert max-w-none text-muted-foreground
            prose-headings:text-foreground prose-headings:font-semibold
            prose-h3:text-xl prose-h4:text-base
            prose-strong:text-foreground
            prose-li:marker:text-primary
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown>{description}</ReactMarkdown>
          </div>
        )}

        {/* Tech stack */}
        {project.tech_stack.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Tech Stack
            </p>
            <div className="flex flex-wrap gap-2">
              {project.tech_stack.map((t) => (
                <span
                  key={t}
                  className="rounded-lg border border-border bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Demo link */}
        {project.demo_url && (
          <div className="mt-10">
            <a
              href={project.demo_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-elegant transition-shadow"
            >
              View live demo <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}

      </div>
    </SiteLayout>
  );
}
