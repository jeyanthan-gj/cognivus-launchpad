import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ICON_OPTIONS, ServiceIcon } from "@/components/site/icon";
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

export const Route = createFileRoute("/admin/services")({
  head: () => ({ meta: [{ title: "Services — Cognivus Admin" }] }),
  component: AdminServices,
});

type Service = {
  id: string;
  icon: string;
  title: string;
  description: string;
  display_order: number;
};

const empty = { icon: "Sparkles", title: "", description: "", display_order: 0 };

function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("services").select("*").order("display_order");
    if (data) setServices(data as Service[]);
  };

  useEffect(() => { void load(); }, []);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (s: Service) => {
    setEditing(s);
    setForm({ icon: s.icon, title: s.title, description: s.description, display_order: s.display_order });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      icon: form.icon,
      title: form.title.trim(),
      description: form.description.trim(),
      display_order: Number(form.display_order) || 0,
    };
    const { error } = editing
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Service updated" : "Service created");
    setOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    setDeleteTarget(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Service deleted");
    void load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the services shown on the public site.</p>
        </div>
        <button onClick={startNew} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant">
          <Plus className="h-4 w-4" /> New service
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <ServiceIcon name={s.icon} className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Order: {s.display_order}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(s)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteTarget(s.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-dialog-title"
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <form onSubmit={save} className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-elegant">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close dialog" className="absolute right-3 top-3 rounded-md p-1 hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
            <h2 id="service-dialog-title" className="text-xl font-semibold">{editing ? "Edit service" : "New service"}</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium">Icon</label>
                <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Title</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Display order</label>
                <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant disabled:opacity-60">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the service from the public site. This action cannot be undone.
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
