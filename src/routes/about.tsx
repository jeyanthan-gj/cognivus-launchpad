import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lightbulb, Cpu, Network } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Cognivus" },
      {
        name: "description",
        content:
          "Cognivus is an AI-driven technology company building scalable, real-world solutions across automation, knowledge systems, and conversational AI.",
      },
      { property: "og:title", content: "About — Cognivus" },
      {
        property: "og:description",
        content: "Innovation, automation, and intelligent systems engineered for impact.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const [body, setBody] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("site_content")
        .select("value")
        .eq("key", "about_body")
        .maybeSingle();
      if (data?.value) setBody(data.value);
    })();
  }, []);

  return (
    <SiteLayout>
      <section className="bg-hero">
        <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
          <p className="animate-fade-up text-sm font-medium uppercase tracking-wider text-primary-glow">About</p>
          <h1 className="animate-fade-up animate-delay-100 mt-3 text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Engineering the mind behind every solution.
          </h1>
          <p className="animate-fade-up animate-delay-200 mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {body ||
              "Cognivus is an AI-driven technology company focused on building scalable, real-world solutions. We combine cutting-edge research with pragmatic engineering to deliver intelligent systems that automate operations, surface insights, and unlock new capabilities for modern businesses."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Lightbulb, title: "Innovation", body: "We invest in emerging AI techniques and translate research into production-ready systems." },
            { icon: Cpu, title: "Automation", body: "We design intelligent automation that compounds — saving time, reducing errors, and scaling effortlessly." },
            { icon: Network, title: "Intelligent Systems", body: "We build connected systems that learn from data and improve continuously over time." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-soft">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">Our mission</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
            To make intelligent technology accessible, dependable, and transformative for every organization that wants to move faster, decide better, and build with confidence.
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
