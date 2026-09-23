import Link from "next/link";
import {
  Sparkles,
  ScanSearch,
  FileEdit,
  Send,
  ShieldCheck,
  Gauge,
  Users,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Real matches, not spam",
    description:
      "Your CV is parsed and scored against every job we find, with reasoning you can actually read — not a keyword match, a real fit assessment.",
  },
  {
    icon: FileEdit,
    title: "Every application tailored",
    description:
      "CVs are rewritten per role from your real experience — never invented. A second AI pass audits every tailored CV before it ships.",
  },
  {
    icon: ShieldCheck,
    title: "You're always in control",
    description:
      "Nothing is sent to an employer without your say-so. Review match scores, tailored CVs, and cover letters before anything goes out.",
  },
  {
    icon: Gauge,
    title: "Runs while you don't",
    description:
      "One daily pass finds, scores, and prepares applications automatically — check in when you want, not because you have to.",
  },
  {
    icon: Users,
    title: "Share credits with a team",
    description:
      "Pool usage across a cluster of accounts — friends, a job-search group, or a team — instead of paying for each seat separately.",
  },
  {
    icon: Sparkles,
    title: "Gets smarter about you",
    description:
      "Every low-scoring match becomes a concrete, specific suggestion for your profile — not generic resume advice.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Upload your CV",
    description:
      "We parse it, ask a few sharp follow-up questions, and synthesize a canonical profile that actually represents you.",
  },
  {
    step: "2",
    title: "Set your preferences",
    description: "Roles, locations, remote preference — AI-suggested from your CV, fully editable.",
  },
  {
    step: "3",
    title: "Let it run",
    description:
      "Daily, we find matching roles, score them, tailor a CV and cover letter for the strong ones, and keep you posted.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
          >
            <div className="aspect-[1155/678] w-[72rem] bg-gradient-to-tr from-[var(--brand)] to-[var(--success)] opacity-20" />
          </div>
          <div className="mx-auto max-w-4xl px-6 py-28 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              Real AI in the loop, not keyword matching
            </div>
            <h1 className="font-heading text-5xl font-extrabold tracking-tight text-balance sm:text-6xl">
              Job search on <span className="text-brand">autopilot</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
              Build your profile once. Every day, job-auto finds matching roles, scores your fit,
              and tailors a real application — so you keep showing up in front of employers even
              when you're not online.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" render={<Link href="/signup" />}>
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="#how-it-works" />}>
                See how it works
              </Button>
            </div>
          </div>
        </section>

        {/* Pipeline visual */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: ScanSearch, label: "Find" },
              { icon: Gauge, label: "Score" },
              { icon: FileEdit, label: "Tailor" },
              { icon: Send, label: "Apply" },
            ].map(({ icon: Icon, label }) => (
              <Card key={label} className="border-border/60 bg-card/60">
                <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft">
                    <Icon className="h-5 w-5 text-brand" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border/60 bg-secondary/30 py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">How it works</h2>
              <p className="mt-3 text-muted-foreground">Three steps, then it runs itself.</p>
            </div>
            <div className="mt-14 grid gap-8 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.step} className="relative">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand font-heading text-lg font-bold text-brand-foreground">
                    {s.step}
                  </div>
                  <h3 className="font-heading text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">
                Built to be trusted with your job search
              </h2>
              <p className="mt-3 text-muted-foreground">
                Automation that respects the fact that a bad application costs you a real
                opportunity.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title} className="border-border/60">
                  <CardContent className="pt-2">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                      <f.icon className="h-5 w-5 text-brand" />
                    </div>
                    <h3 className="font-heading text-base font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="border-t border-border/60 bg-foreground py-20 text-background">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Stop refreshing job boards
            </h2>
            <p className="mt-3 text-background/70">
              Set up your profile in a few minutes. job-auto takes it from there.
            </p>
            <div className="mt-8">
              <Button size="lg" variant="secondary" render={<Link href="/signup" />}>
                Create your account <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
