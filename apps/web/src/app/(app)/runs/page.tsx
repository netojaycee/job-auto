"use client";

import { Inbox, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRunsQuery } from "@/lib/queries/runs";

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
      <Inbox className="h-6 w-6" />
      {label}
    </div>
  );
}

const SUCCESS_STATUSES = new Set(["completed", "applied"]);

function StatusBadge({ status }: { status: string }) {
  if (SUCCESS_STATUSES.has(status)) {
    return <Badge className="border-transparent bg-success/15 text-success hover:bg-success/15">{status}</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive">{status}</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export default function RunsPage() {
  const { data, isLoading } = useRunsQuery();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Agent activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">What job-auto found, scored, and prepared.</p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-base">Run history</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !data?.runs.length ? (
            <EmptyState label="No runs yet — they'll show up here once the agent runs for you." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted-foreground">
                    <th className="py-2 font-medium">Started</th>
                    <th className="font-medium">Status</th>
                    <th className="font-medium">Seen</th>
                    <th className="font-medium">Shortlisted</th>
                    <th className="font-medium">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 align-top last:border-0">
                      <td className="py-2 whitespace-nowrap">{new Date(r.startedAt).toLocaleString()}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>{r.jobsSeen}</td>
                      <td>{r.jobsShortlisted}</td>
                      <td>{r.jobsApplied}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-base">Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !data?.applications.length ? (
            <EmptyState label="No applications yet." />
          ) : (
            <ul className="flex flex-col gap-3">
              {data.applications.map((a) => (
                <li key={a.id} className="rounded-lg border border-border/60 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {a.title} <span className="text-muted-foreground">@ {a.company}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {a.matchScore != null && (
                        <Badge variant="secondary" className="font-mono">
                          {a.matchScore}
                        </Badge>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                  {a.matchReasoning && <p className="mt-2 text-muted-foreground">{a.matchReasoning}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!!data?.suggestions.length && (
        <Card className="border-brand/30 bg-brand-soft/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <Lightbulb className="h-4 w-4 text-brand" />
              Profile improvement suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/90">
              {data.suggestions.map((s) => (
                <li key={s.id}>{s.suggestionText}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
