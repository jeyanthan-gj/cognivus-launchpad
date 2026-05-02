import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessages,
});

type Message = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMessages(data as Message[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    void load();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">Contact form submissions.</p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : messages.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-12 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No messages yet.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <a href={`mailto:${m.email}`} className="text-sm text-muted-foreground hover:text-foreground">
                    {m.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                  <button onClick={() => remove(m.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
