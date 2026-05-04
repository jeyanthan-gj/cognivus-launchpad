import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/content")({
  head: () => ({ meta: [{ title: "Content — Cognivus Admin" }] }),
  component: AdminContent,
});

const FIELDS = [
  { key: "hero_tagline", label: "Homepage tagline", type: "text" },
  { key: "hero_description", label: "Homepage description", type: "textarea" },
  { key: "about_body", label: "About section text", type: "textarea" },
] as const;

function AdminContent() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("site_content").select("key,value");
      if (error) {
        setLoadError(error.message);
      } else if (data) {
        setValues(Object.fromEntries(data.map((r) => [r.key, r.value])));
      }
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const rows = FIELDS.map((f) => ({ key: f.key, value: values[f.key] ?? "" }));
    const { error } = await supabase.from("site_content").upsert(rows, { onConflict: "key" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Content saved");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Failed to load content: {loadError}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Content</h1>
      <p className="mt-1 text-sm text-muted-foreground">Edit copy that appears across the website.</p>

      <form onSubmit={save} className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6 shadow-soft">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium">{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                rows={5}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            ) : (
              <input
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft hover:shadow-elegant disabled:opacity-60">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
