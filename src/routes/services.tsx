import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ServiceIcon } from "@/components/site/icon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Cognivus" },
      {
        name: "description",
        content:
          "AI Automation Systems, RAG Knowledge Assistants, Custom AI Chatbots, and Business Workflow Automation — engineered for production.",
      },
      { property: "og:title", content: "Services — Cognivus" },
      {
        property: "og:description",
        content: "Production-ready AI services for modern businesses.",
      },
    ],
  }),
  component: ServicesPage,
});

type Service = { id: string; icon: string; title: string; description: string };

function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,icon,title,description")
        .order("display_order");
      if (error) setError(error.message);
      else if (data) setServices(data as Service[]);
      setLoading(false);
    })();
  }, []);

  return (
    <SiteLayout>
      <section className="bg-hero">
        <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
          <p className="animate-fade-up text-sm font-medium uppercase tracking-wider text-primary-glow">Services</p>
          <h1 className="animate-fade-up animate-delay-100 mt-3 text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Solutions designed for real-world impact.
          </h1>
          <p className="animate-fade-up animate-delay-200 mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            From automation to conversational AI, every service is engineered for reliability, security, and measurable business outcomes.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load services. Please try refreshing.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {services.map((s) => (
            <div
              key={s.id}
              className="group rounded-xl border border-border bg-card p-8 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-soft">
                <ServiceIcon name={s.icon} className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
              <p className="mt-3 text-pretty text-muted-foreground">{s.description}</p>
            </div>
          ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
