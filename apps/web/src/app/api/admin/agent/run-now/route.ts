import { NextResponse } from "next/server";
import { enqueueAgentRun } from "@job-auto/queue";
import { requireAdminSession } from "@/lib/admin";

/**
 * Enqueues a one-off agent run — the worker's scheduler daemon (see
 * apps/worker/src/scheduler/daemon.ts) must be running to actually process
 * it. This only queues the job; it does not run inline in the web process.
 */
export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const userId: string | undefined = body.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  await enqueueAgentRun(userId);
  return NextResponse.json({ ok: true });
}
