import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Image, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    playlist: id,
    controls: "1",
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

export const Route = createFileRoute("/admin/projects")({
  head: () => ({ meta: [{ title: "Projects — Cognivus Admin" }] }),
  component: AdminProjects,
});

type Project = {
  id: string;
  title: string;
  description: string;
  tech_stack: string[];
  demo_url: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  display_order: number;
  published: boolean;
};

const empty = {
  title: "",
  description: "",
  tech_stack: "",
  demo_url: "",
  thumbnail_url: "",
  video_url: "",
  display_order: 0,
  published: true,
};

function AdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("projects").select("*").order("display_order");
    if (data) setProjects(data as Project[]);
  };

  useEffect(() => { void load(); }, []);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };

  const startEdit = (p: Project) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description,
      tech_stack: p.tech_stack.join(", "),
      demo_url: p.demo_url ?? "",
      thumbnail_url: p.thumbnail_url ?? "",
      video_url: p.video_url ?? "",
      display_order: p.display_order,
      published: p.published,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      tech_stack: form.tech_stack.split(",").map((s) => s.trim()).filter(Boolean),
      demo_url: form.demo_url.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      video_url: form.video_url.trim() || null,
      display_order: Number(form.display_order) || 0,
      published: form.published,
    };
    const { error } = editing
      ? await supabase.from("projects").update(payload).eq("id", editing.id)
      : await supabase.from("projects").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Project updated" : "Project created");
    setOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    setDeleteTarget(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Project deleted");
    void load();
  };

  const field = (key: keyof typeof form, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage projects shown on the public site.</p>
        </div>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant"
        >
          <Plus className="h-4 w-4" /> New project
        </button>
      </div>

      {/* Table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-10">Media</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3 hidden md:table-cell">Tech</th>
              <th className="px-4 py-3 hidden sm:table-cell">Order</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {p.thumbnail_url
                      ? <img src={p.thumbnail_url} alt="" className="h-9 w-16 rounded object-cover border border-border" />
                      : <div className="h-9 w-16 rounded bg-muted border border-border flex items-center justify-center"><Image className="h-4 w-4 text-muted-foreground" /></div>
                    }
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{p.title}</p>
                  {p.video_url && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary-glow mt-0.5">
                      <Video className="h-3 w-3" /> Video
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                  {p.tech_stack.join(", ")}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">{p.display_order}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.published ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {p.published ? "Live" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(p)} className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(p.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No projects yet. Click "New project" to add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-dialog-title"
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <form
            onSubmit={save}
            className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-elegant overflow-y-auto max-h-[90vh]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close dialog"
              className="absolute right-3 top-3 rounded-md p-1 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 id="project-dialog-title" className="text-xl font-semibold">
              {editing ? "Edit project" : "New project"}
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => field("title", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => field("description", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Tech stack */}
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">
                  Tech stack <span className="text-muted-foreground">(comma separated)</span>
                </label>
                <input
                  value={form.tech_stack}
                  onChange={(e) => field("tech_stack", e.target.value)}
                  placeholder="React, Python, PostgreSQL"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Thumbnail URL */}
              <div className="sm:col-span-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Image className="h-4 w-4" /> Thumbnail URL
                  <span className="text-muted-foreground font-normal">(shown on card)</span>
                </label>
                <input
                  type="url"
                  value={form.thumbnail_url}
                  onChange={(e) => field("thumbnail_url", e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {form.thumbnail_url && (
                  <img
                    src={form.thumbnail_url}
                    alt="Thumbnail preview"
                    className="mt-2 h-24 w-full rounded-md object-cover border border-border"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
              </div>

              {/* Video URL */}
              <div className="sm:col-span-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Video className="h-4 w-4" /> Preview Video URL
                  <span className="text-muted-foreground font-normal">(plays on hover)</span>
                </label>
                <input
                  type="url"
                  value={form.video_url}
                  onChange={(e) => field("video_url", e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {form.video_url && (() => {
                  const isYT = !!getYouTubeId(form.video_url);
                  return isYT ? (
                    <iframe
                      src={getYouTubeEmbedUrl(form.video_url, false)}
                      allow="encrypted-media"
                      allowFullScreen
                      className="mt-2 h-36 w-full rounded-md border border-border"
                    />
                  ) : (
                    <video
                      src={form.video_url}
                      muted
                      loop
                      playsInline
                      controls
                      className="mt-2 h-24 w-full rounded-md object-cover border border-border"
                    />
                  );
                })()}
              </div>

              {/* Demo URL */}
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Demo URL <span className="text-muted-foreground">(optional)</span></label>
                <input
                  type="url"
                  value={form.demo_url}
                  onChange={(e) => field("demo_url", e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Order + Published */}
              <div>
                <label className="text-sm font-medium">Display order</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => field("display_order", Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => field("published", e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Published</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save project"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The project will be permanently removed from the site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && remove(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
