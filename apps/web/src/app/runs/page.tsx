"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

interface AgentRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  jobsSeen: number;
  jobsShortlisted: number;
  jobsApplied: number;
  errorSummary: string | null;
}

interface ApplicationRow {
  id: string;
  status: string;
  matchScore: number | null;
  matchReasoning: string | null;
  title: string;
  company: string;
  createdAt: string;
}

export default function RunsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [suggestions, setSuggestions] = useState<{ id: string; suggestionText: string }[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => {
        setRuns(data.runs);
        setApplications(data.applications);
        setSuggestions(data.suggestions);
      });
  }, [session]);

  if (isPending) return <main className="p-8">Loading…</main>;
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-xl font-semibold">Agent activity</h1>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Run history</h2>
        {runs.length === 0 && <p className="text-sm text-gray-500">No runs yet.</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1">Started</th>
              <th>Status</th>
              <th>Seen</th>
              <th>Shortlisted</th>
              <th>Applied</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="py-1">{new Date(r.startedAt).toLocaleString()}</td>
                <td>{r.status}</td>
                <td>{r.jobsSeen}</td>
                <td>{r.jobsShortlisted}</td>
                <td>{r.jobsApplied}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Applications</h2>
        {applications.length === 0 && <p className="text-sm text-gray-500">None yet.</p>}
        <ul className="flex flex-col gap-2">
          {applications.map((a) => (
            <li key={a.id} className="rounded border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">
                  {a.title} @ {a.company}
                </span>
                <span className="text-gray-500">
                  {a.matchScore != null ? `[${a.matchScore}]` : ""} {a.status}
                </span>
              </div>
              {a.matchReasoning && <p className="mt-1 text-gray-600">{a.matchReasoning}</p>}
            </li>
          ))}
        </ul>
      </section>

      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium">Profile improvement suggestions</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            {suggestions.map((s) => (
              <li key={s.id}>{s.suggestionText}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
