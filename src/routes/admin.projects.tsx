import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
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
  display_order: number;
  published: boolean;
};

const empty = {
  title: "",
  description: "",
  tech_stack: "",
  demo_url: "",
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
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("display_order");
    if (data) setProjects(data as Project[]);
  };

  useEffect(() => { void load(); }, []);

  const startNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const startEdit = (p: Project) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description,
      tech_stack: p.tech_stack.join(", "),
      demo_url: p.demo_url ?? "",
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
      display_order: Number(form.display_order) || 0,
      published: form.published,
    };
    const { error } = editing
      ? await supabase.from("projects").update(payload).eq("id", editing.id)
      : await supabase.from("projects").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Project updated" : "Project created");
    setOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    setDeleteTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project deleted");
    void load();
  };

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

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Tech</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.tech_stack.join(", ")}</td>
                <td className="px-4 py-3">{p.display_order}</td>
                <td className="px-4 py-3">
                  <span className={p.published ? "text-foreground" : "text-muted-foreground"}>
                    {p.published ? "Yes" : "No"}
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
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No projects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-dialog-title"
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <form onSubmit={save} className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-elegant">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close dialog" className="absolute right-3 top-3 rounded-md p-1 hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
            <h2 id="project-dialog-title" className="text-xl font-semibold">{editing ? "Edit project" : "New project"}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Title</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Description</label>
                <textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Tech stack <span className="text-muted-foreground">(comma separated)</span></label>
                <input value={form.tech_stack} onChange={(e) => setForm({ ...form, tech_stack: e.target.value })}
                  placeholder="React, Python, PostgreSQL"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Demo URL <span className="text-muted-foreground">(optional)</span></label>
                <input type="url" value={form.demo_url} onChange={(e) => setForm({ ...form, demo_url: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Display order</label>
                <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 self-end pb-2">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                <span className="text-sm">Published</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant disabled:opacity-60">
                {busy ? "Saving…" : "Save project"}
              </button>
            </div>
          </form>
        </div>
      )}

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
