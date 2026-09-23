"use client";

import Link from "next/link";
import { UserRound, SlidersHorizontal, Activity, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CARDS = [
  {
    href: "/profile",
    icon: UserRound,
    title: "Your profile",
    description: "Upload your CV, answer a few questions, and let AI build your canonical profile.",
  },
  {
    href: "/preferences",
    icon: SlidersHorizontal,
    title: "Job preferences",
    description: "Roles, locations, and remote preference — AI-suggested, fully editable.",
  },
  {
    href: "/runs",
    icon: Activity,
    title: "Agent activity",
    description: "See what job-auto found, scored, and prepared on your behalf.",
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything job-auto needs from you lives here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Card key={c.href} className="border-border/60">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft">
                <c.icon className="h-5 w-5 text-brand" />
              </div>
              <CardTitle className="font-heading text-base">{c.title}</CardTitle>
              <CardDescription>{c.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="px-0" render={<Link href={c.href} />}>
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
